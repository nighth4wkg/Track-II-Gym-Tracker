"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  readNotificationCenter,
  saveNotificationCenter,
  TRACK_NOTIFICATION_EVENT,
  type TrackCenterNotification,
  type TrackNotificationEventDetail,
} from "../notificationCenter";
import { syncPhaseForLabel, type SyncPhase } from "../syncHealth";
import type { TimerRuntimeState, TrackAnnouncement, WorkoutDraft } from "../trackTypes";
import { recordNotificationDelivery } from "../notificationTelemetry";

type UseNotificationCenterOptions = {
  userId: string | null;
  syncLabel: string;
  announcement: TrackAnnouncement | null;
  draft: WorkoutDraft | null;
  timerMode: "stopwatch" | "rest";
  timerRunning: boolean;
  restRemaining: number;
  timerRuntime: TimerRuntimeState;
};

function notificationFor(
  id: string,
  kind: TrackCenterNotification["kind"],
  title: string,
  message: string,
  createdAt = Date.now(),
): TrackCenterNotification {
  return { id, kind, title, message, createdAt, unread: true };
}

export function useNotificationCenter({
  userId,
  syncLabel,
  announcement,
  draft,
  timerMode,
  timerRunning,
  restRemaining,
  timerRuntime,
}: UseNotificationCenterOptions) {
  const [items, setItems] = useState<TrackCenterNotification[]>(() => (userId ? readNotificationCenter(userId) : []));
  const [open, setOpen] = useState(false);
  const activeUserIdRef = useRef(userId);
  const previousSyncPhaseRef = useRef<SyncPhase | null>(null);
  const previousTimerRef = useRef<{
    mode: "stopwatch" | "rest";
    running: boolean;
    restRemaining: number;
    restEndsAtMs: number | null;
  } | null>(null);

  const commit = useCallback(
    (change: (current: TrackCenterNotification[]) => TrackCenterNotification[]) => {
      setItems((current) => {
        const next = change(current);
        if (userId) saveNotificationCenter(userId, next);
        return next;
      });
    },
    [userId],
  );

  const record = useCallback(
    (notification: TrackCenterNotification) => {
      recordNotificationDelivery({ notificationId: notification.id, status: "displayed", surface: "in-app" });
      commit((current) => {
        if (current.some((item) => item.id === notification.id)) return current;
        return [notification, ...current];
      });
    },
    [commit],
  );
  const scheduleRecord = useCallback(
    (notification: TrackCenterNotification) => {
      const timeout = window.setTimeout(() => record(notification), 0);
      return () => window.clearTimeout(timeout);
    },
    [record],
  );

  useEffect(() => {
    if (activeUserIdRef.current === userId) return;
    activeUserIdRef.current = userId;
    setItems(userId ? readNotificationCenter(userId) : []);
    setOpen(false);
    previousSyncPhaseRef.current = null;
    previousTimerRef.current = null;
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const handleNotification = (event: Event) => {
      // SAFETY: This listener is registered only for TRACK_NOTIFICATION_EVENT,
      // whose publisher below always dispatches TrackNotificationEventDetail.
      const detail = (event as CustomEvent<TrackNotificationEventDetail>).detail;
      if (!detail || (detail.userId && detail.userId !== userId)) return;
      record({
        id: detail.id,
        kind: detail.kind,
        title: detail.title,
        message: detail.message,
        createdAt: detail.createdAt,
        unread: detail.unread,
      });
    };
    window.addEventListener(TRACK_NOTIFICATION_EVENT, handleNotification);
    return () => window.removeEventListener(TRACK_NOTIFICATION_EVENT, handleNotification);
  }, [record, userId]);

  useEffect(() => {
    if (!userId || !announcement) return;
    return scheduleRecord(
      notificationFor(`announcement:${announcement.id}`, "announcement", "Track II announcement", announcement.message),
    );
  }, [announcement, scheduleRecord, userId]);

  useEffect(() => {
    if (!userId || !draft) return;
    return scheduleRecord(
      notificationFor(
        `draft:${draft.splitId}:${draft.updatedAt}`,
        "draft",
        "Workout draft recovered",
        `${draft.splitTitle} has unfinished sets ready to continue.`,
        draft.updatedAt,
      ),
    );
  }, [draft, scheduleRecord, userId]);

  const syncPhase = syncPhaseForLabel(syncLabel);
  useEffect(() => {
    const previous = previousSyncPhaseRef.current;
    previousSyncPhaseRef.current = syncPhase;
    if (!userId || previous === syncPhase || (syncPhase !== "offline" && syncPhase !== "attention")) return;
    record(
      notificationFor(
        `sync:${syncPhase}:${Date.now()}`,
        "sync",
        syncPhase === "offline" ? "Sync is offline" : "Sync needs attention",
        syncPhase === "offline"
          ? "Your changes stay safe on this device and will retry when you reconnect."
          : syncLabel,
      ),
    );
  }, [record, syncLabel, syncPhase, userId]);

  useEffect(() => {
    const current = {
      mode: timerRuntime.mode ?? timerMode,
      running: timerRunning,
      restRemaining,
      restEndsAtMs: timerRuntime.restEndsAtMs,
    } as const;
    const previous = previousTimerRef.current;
    previousTimerRef.current = current;
    if (!userId || !previous) return;
    const completed =
      previous.mode === "rest" &&
      previous.running &&
      !current.running &&
      (current.restRemaining <= 0 ||
        (current.restEndsAtMs === null && previous.restEndsAtMs !== null && previous.restEndsAtMs <= Date.now()));
    if (!completed) return;
    const completedAt = previous.restEndsAtMs ?? Date.now();
    record(notificationFor("rest:" + completedAt, "rest", "Rest complete", "Time for your next set.", completedAt));
  }, [record, restRemaining, timerMode, timerRunning, timerRuntime, userId]);

  const unreadCount = useMemo(() => items.reduce((count, item) => count + (item.unread ? 1 : 0), 0), [items]);
  const markRead = useCallback(
    (id: string) => {
      recordNotificationDelivery({ notificationId: id, status: "opened", surface: "in-app" });
      commit((current) => current.map((item) => (item.id === id && item.unread ? { ...item, unread: false } : item)));
    },
    [commit],
  );
  const markAllRead = useCallback(() => {
    items
      .filter((item) => item.unread)
      .forEach((item) => {
        recordNotificationDelivery({ notificationId: item.id, status: "opened", surface: "in-app" });
      });
    commit((current) => current.map((item) => (item.unread ? { ...item, unread: false } : item)));
  }, [commit, items]);
  const dismiss = useCallback(
    (id: string) => {
      recordNotificationDelivery({ notificationId: id, status: "dismissed", surface: "in-app" });
      commit((current) => current.filter((item) => item.id !== id));
    },
    [commit],
  );
  const clearAll = useCallback(() => {
    items.forEach((item) => {
      recordNotificationDelivery({ notificationId: item.id, status: "dismissed", surface: "in-app" });
    });
    commit(() => []);
  }, [commit, items]);
  const toggle = useCallback(() => setOpen((current) => !current), []);
  const close = useCallback(() => setOpen(false), []);

  return { items, unreadCount, open, toggle, close, markRead, markAllRead, clearAll, dismiss };
}
