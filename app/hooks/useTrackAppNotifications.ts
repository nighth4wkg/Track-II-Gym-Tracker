"use client";

import { LocalNotifications } from "@capacitor/local-notifications";
import { useCallback, useEffect } from "react";
import type { NotificationCenterProps } from "../components/NotificationCenter";
import { recordNotificationDelivery } from "../notificationTelemetry";
import { nativeLocalNotificationsAvailable, notificationIdForNativeDelivery } from "../notifications";
import type { IdentityState } from "./useIdentityState";
import { useNotificationCenter } from "./useNotificationCenter";
import type { TimerState } from "./useTimerState";
import type { useUndoNotice } from "./useUndoNotice";
import type { useWorkoutDraftRecovery } from "./useWorkoutDraftRecovery";

export function useTrackAppNotifications(
  identity: IdentityState,
  timer: TimerState,
  workoutDraftRecovery: ReturnType<typeof useWorkoutDraftRecovery>,
  undo: ReturnType<typeof useUndoNotice>,
): NotificationCenterProps {
  useEffect(() => {
    if (!nativeLocalNotificationsAvailable()) return;
    let disposed = false;
    let handles: Awaited<ReturnType<typeof LocalNotifications.addListener>>[] = [];

    void Promise.all([
      LocalNotifications.addListener("localNotificationReceived", (notification) => {
        const notificationId = notificationIdForNativeDelivery(notification);
        if (!notificationId) return;
        recordNotificationDelivery({ notificationId, status: "displayed", surface: "native" });
      }),
      LocalNotifications.addListener("localNotificationActionPerformed", ({ notification }) => {
        const notificationId = notificationIdForNativeDelivery(notification);
        if (!notificationId) return;
        recordNotificationDelivery({ notificationId, status: "opened", surface: "native" });
      }),
    ])
      .then((nextHandles) => {
        if (disposed) {
          void Promise.all(nextHandles.map((handle) => handle.remove()));
          return;
        }
        handles = nextHandles;
      })
      .catch(() => {
        // Notification telemetry is best-effort and must never block the app.
      });

    return () => {
      disposed = true;
      void Promise.all(handles.map((handle) => handle.remove()));
    };
  }, []);

  const center = useNotificationCenter({
    userId: identity.user?.id ?? null,
    syncLabel: identity.syncLabel,
    announcement: identity.announcement,
    draft: workoutDraftRecovery.notice?.draft ?? null,
    timerMode: timer.timerMode,
    timerRunning: timer.timerRunning,
    restRemaining: timer.restRemaining,
    timerRuntime: timer.timerRuntime,
  });
  const { items, clearAll: clearCenter, restore } = center;
  const { offerUndo } = undo;
  const clearAll = useCallback(() => {
    if (!items.length) return;
    const snapshot = items;
    clearCenter();
    offerUndo("Notifications cleared", () => restore(snapshot));
  }, [clearCenter, items, offerUndo, restore]);

  return {
    items,
    unreadCount: center.unreadCount,
    open: center.open,
    onToggle: center.toggle,
    onClose: center.close,
    onMarkRead: center.markRead,
    onMarkAllRead: center.markAllRead,
    onClearAll: clearAll,
    onDismiss: center.dismiss,
  };
}
