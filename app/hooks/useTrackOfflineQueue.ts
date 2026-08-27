import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import type { User } from "@supabase/supabase-js";
import { saveWorkoutSession } from "../data/trackApi";
import { enqueueOfflineWorkoutSession, readOfflineWorkoutQueue, removeOfflineWorkoutSession } from "../offlineStore";
import type { WorkoutSessionPayload } from "../trackTypes";
import { TRACK_TIMING, TRACK_UI_COPY } from "../trackConstants";
import { promiseWithTimeout } from "../trackUtils";

function isOffline() {
  return globalThis.navigator?.onLine === false;
}

type UseTrackOfflineQueueOptions = {
  user: User | null;
  cloudReady: boolean;
  queuePendingRef: MutableRefObject<boolean>;
  reportSyncStatus: (label: string, settleToSaved?: boolean) => void;
  broadcastWorkoutFinished: (payload: { dateKey: string; splitId: string }) => void;
};

export function useTrackOfflineQueue({
  user,
  cloudReady,
  queuePendingRef,
  reportSyncStatus,
  broadcastWorkoutFinished,
}: UseTrackOfflineQueueOptions) {
  const flushInProgress = useRef(false);
  const generation = useRef(0);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);

  const resetOfflineQueueState = useCallback(() => {
    queuePendingRef.current = false;
    flushInProgress.current = false;
    generation.current += 1;
    setOfflineQueueCount(0);
  }, [queuePendingRef]);

  const refreshOfflineQueue = useCallback(
    async (userId: string) => {
      const entries = await readOfflineWorkoutQueue(userId);
      if (user?.id === userId) {
        queuePendingRef.current = entries.length > 0;
        setOfflineQueueCount(entries.length);
      }
      return entries;
    },
    [queuePendingRef, user?.id],
  );

  const flushOfflineWorkoutQueue = useCallback(async () => {
    const userId = user?.id;
    if (!userId || !cloudReady || isOffline() || flushInProgress.current) return;
    const currentGeneration = generation.current;
    flushInProgress.current = true;
    try {
      const entries = await readOfflineWorkoutQueue(userId);
      if (currentGeneration !== generation.current || user?.id !== userId) return;
      queuePendingRef.current = entries.length > 0;
      setOfflineQueueCount(entries.length);
      if (!entries.length) return;

      reportSyncStatus(TRACK_UI_COPY.status.syncing);
      for (const entry of entries) {
        if (currentGeneration !== generation.current || user?.id !== userId || isOffline()) break;
        let result: Awaited<ReturnType<typeof saveWorkoutSession>>;
        try {
          result = await promiseWithTimeout(
            saveWorkoutSession(entry.splitId, entry.splitName, entry.logs, entry.clientMutationId, entry.occurredAt),
            TRACK_TIMING.cloudRequestTimeoutMs,
          );
        } catch (error) {
          result = { ok: false, message: error instanceof Error ? error.message : "The workout could not be saved." };
        }
        if (currentGeneration !== generation.current || user?.id !== userId) break;
        if (!result.ok) {
          reportSyncStatus(isOffline() ? TRACK_UI_COPY.status.offlineQueued : TRACK_UI_COPY.status.needsAttention);
          break;
        }
        const removed = await removeOfflineWorkoutSession(userId, entry.clientMutationId);
        if (!removed) {
          reportSyncStatus(TRACK_UI_COPY.status.needsAttention);
          break;
        }
        broadcastWorkoutFinished({ dateKey: entry.dateKey, splitId: entry.splitId });
      }

      const remaining = await readOfflineWorkoutQueue(userId);
      if (currentGeneration !== generation.current || user?.id !== userId) return;
      queuePendingRef.current = remaining.length > 0;
      setOfflineQueueCount(remaining.length);
      if (remaining.length) {
        reportSyncStatus(isOffline() ? TRACK_UI_COPY.status.offlineQueued : TRACK_UI_COPY.status.needsAttention);
      } else {
        reportSyncStatus("Saved", true);
      }
    } finally {
      if (currentGeneration === generation.current) flushInProgress.current = false;
    }
  }, [broadcastWorkoutFinished, cloudReady, queuePendingRef, reportSyncStatus, user?.id]);

  const queueWorkoutSession = useCallback(
    async (entry: WorkoutSessionPayload) => {
      const userId = user?.id;
      if (!userId) return false;
      const queued = await enqueueOfflineWorkoutSession(userId, entry);
      if (!queued || user?.id !== userId) return false;
      await refreshOfflineQueue(userId);
      reportSyncStatus(TRACK_UI_COPY.status.offlineQueued);
      if (!isOffline()) void flushOfflineWorkoutQueue();
      return true;
    },
    [flushOfflineWorkoutQueue, refreshOfflineQueue, reportSyncStatus, user?.id],
  );

  useEffect(() => {
    if (!user?.id || !cloudReady) return;
    let cancelled = false;
    const userId = user.id;
    const resume = () => {
      if (!document.hidden && !cancelled) void flushOfflineWorkoutQueue();
    };
    const initialRefresh = window.setTimeout(() => {
      void refreshOfflineQueue(userId).then(() => {
        if (!cancelled) resume();
      });
    }, 0);
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      cancelled = true;
      window.clearTimeout(initialRefresh);
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [cloudReady, flushOfflineWorkoutQueue, refreshOfflineQueue, user?.id]);

  return {
    flushOfflineWorkoutQueue,
    offlineQueueCount,
    queueWorkoutSession,
    resetOfflineQueueState,
  };
}
