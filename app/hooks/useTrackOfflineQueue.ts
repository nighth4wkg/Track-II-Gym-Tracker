import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import type { User } from "@supabase/supabase-js";
import { saveWorkoutSession } from "../data/trackApi";
import {
  enqueueOfflineWorkoutSession,
  getOfflineStorageStatus,
  readOfflineWorkoutQueueState,
  recordOfflineWorkoutFailure,
  removeOfflineWorkoutSession,
  resetOfflineWorkoutQueueFailures,
} from "../offlineStore";
import type { OfflineWorkoutQueueState } from "../offlineStore";
import type { JsonValue, WorkoutSessionPayload } from "../trackTypes";
import { TRACK_LIMITS, TRACK_TIMING, TRACK_UI_COPY } from "../trackConstants";
import {
  isJsonObject,
  isStringValue,
  promiseWithTimeout,
  safeStorageGet,
  safeStorageRemove,
  safeStorageSet,
} from "../trackUtils";
import { recordSyncTelemetry } from "../syncTelemetry";

function isOffline() {
  return globalThis.navigator?.onLine === false;
}

type QueueChannelMessage = { type: "queue-changed"; userId: string };

const QUEUE_LOCK_TTL_MS = 45_000;
const QUEUE_LOCK_PREFIX = "track-offline-flush-lock:";

function lockKey(userId: string) {
  return `${QUEUE_LOCK_PREFIX}${userId}`;
}

function parseStorageLease(value: string | null) {
  if (!value) return null;
  try {
    // SAFETY: leases are written by this module as JSON objects; the shared
    // JSON guard validates the shape before any lease field is read.
    const parsed: JsonValue = JSON.parse(value);
    return isJsonObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function acquireStorageLease(userId: string) {
  const key = lockKey(userId);
  const current = safeStorageGet(key);
  const parsed = parseStorageLease(current);
  if (parsed && Number.isFinite(Number(parsed.expiresAt)) && Number(parsed.expiresAt) > Date.now()) return null;
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  safeStorageSet(key, JSON.stringify({ token, expiresAt: Date.now() + QUEUE_LOCK_TTL_MS }));
  const confirmed = parseStorageLease(safeStorageGet(key));
  return confirmed && isStringValue(confirmed.token) && confirmed.token === token ? token : null;
}

function releaseStorageLease(userId: string, token: string) {
  const key = lockKey(userId);
  const current = parseStorageLease(safeStorageGet(key));
  if (current && isStringValue(current.token) && current.token === token) safeStorageRemove(key);
}

async function withQueueFlushLock<T>(userId: string, operation: () => Promise<T>) {
  const lockManager = globalThis.navigator?.locks;
  if (lockManager) {
    return lockManager.request(`track-offline-flush:${userId}`, { ifAvailable: true }, (lock) =>
      lock ? operation() : null,
    );
  }

  const token = acquireStorageLease(userId);
  if (!token) return null;
  try {
    return await operation();
  } finally {
    releaseStorageLease(userId, token);
  }
}

function retryDelayMs(attempt: number) {
  const base = Math.min(
    TRACK_TIMING.offlineQueueRetryMaxMs,
    TRACK_TIMING.offlineQueueRetryBaseMs * 2 ** Math.max(0, attempt - 1),
  );
  const jitter = Math.floor(base * 0.15 * Math.random());
  return base + jitter;
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
  const retryTimer = useRef<number | null>(null);
  const flushRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const queueChannelRef = useRef<BroadcastChannel | null>(null);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [offlineQueueStuckCount, setOfflineQueueStuckCount] = useState(0);

  const clearRetryTimer = useCallback(() => {
    if (retryTimer.current !== null) window.clearTimeout(retryTimer.current);
    retryTimer.current = null;
  }, []);

  const broadcastQueueChange = useCallback((userId: string) => {
    queueChannelRef.current?.postMessage({ type: "queue-changed", userId } satisfies QueueChannelMessage);
  }, []);

  const applyQueueState = useCallback(
    (userId: string, state: OfflineWorkoutQueueState) => {
      if (user?.id !== userId) return;
      const stuckCount = state.entries.filter((entry) => state.statuses[entry.clientMutationId]?.stuck).length;
      queuePendingRef.current = state.entries.length > 0;
      setOfflineQueueCount(state.entries.length);
      setOfflineQueueStuckCount(stuckCount);
    },
    [queuePendingRef, user?.id],
  );

  const refreshOfflineQueue = useCallback(
    async (userId: string) => {
      const state = await readOfflineWorkoutQueueState(userId);
      applyQueueState(userId, state);
      return state;
    },
    [applyQueueState],
  );

  const scheduleRetry = useCallback(
    (userId: string, retryAt: number) => {
      clearRetryTimer();
      if (retryAt <= 0 || !Number.isFinite(retryAt)) return;
      const delay = Math.max(750, retryAt - Date.now());
      retryTimer.current = window.setTimeout(() => {
        retryTimer.current = null;
        if (user?.id === userId && !isOffline() && !document.hidden) void flushRef.current();
      }, delay);
    },
    [clearRetryTimer, user?.id],
  );

  const resetOfflineQueueState = useCallback(() => {
    clearRetryTimer();
    queuePendingRef.current = false;
    flushInProgress.current = false;
    generation.current += 1;
    setOfflineQueueCount(0);
    setOfflineQueueStuckCount(0);
  }, [clearRetryTimer, queuePendingRef]);

  const flushOfflineWorkoutQueue = useCallback(async () => {
    const userId = user?.id;
    if (!userId || !cloudReady || isOffline() || flushInProgress.current) return;
    const currentGeneration = generation.current;
    const result = await withQueueFlushLock(userId, async () => {
      if (currentGeneration !== generation.current || user?.id !== userId) return;
      flushInProgress.current = true;
      try {
        const state = await refreshOfflineQueue(userId);
        if (currentGeneration !== generation.current || user?.id !== userId) return;
        if (!state.entries.length) return;

        reportSyncStatus(TRACK_UI_COPY.status.syncing);
        for (const entry of state.entries) {
          if (currentGeneration !== generation.current || user?.id !== userId || isOffline()) break;
          const status = state.statuses[entry.clientMutationId];
          if (status?.stuck) continue;
          if (status && status.nextRetryAt > Date.now()) {
            scheduleRetry(userId, status.nextRetryAt);
            continue;
          }

          const uploadStartedAt = Date.now();
          let saveResult: Awaited<ReturnType<typeof saveWorkoutSession>>;
          try {
            saveResult = await promiseWithTimeout(
              saveWorkoutSession(entry.splitId, entry.splitName, entry.logs, entry.clientMutationId, entry.occurredAt),
              TRACK_TIMING.cloudRequestTimeoutMs,
            );
          } catch (error) {
            saveResult = {
              ok: false,
              message: error instanceof Error ? error.message : "The workout could not be saved.",
            };
          }
          if (currentGeneration !== generation.current || user?.id !== userId) break;
          if (!saveResult.ok) {
            const attempts = (status?.attempts ?? 0) + 1;
            const stuck = attempts >= TRACK_LIMITS.maxOfflineQueueRetries;
            const nextRetryAt = Date.now() + retryDelayMs(attempts);
            const recorded = await recordOfflineWorkoutFailure(
              userId,
              entry.clientMutationId,
              saveResult.message ?? "The workout could not be saved.",
              nextRetryAt,
            );
            broadcastQueueChange(userId);
            const storageStatus = getOfflineStorageStatus();
            if (storageStatus !== "ok") {
              recordSyncTelemetry({ kind: "storage-error", storageStatus });
              reportSyncStatus(TRACK_UI_COPY.status.offlineStorage);
            } else if (!recorded) {
              reportSyncStatus(TRACK_UI_COPY.status.needsAttention);
            } else if (stuck) {
              recordSyncTelemetry({ kind: "stuck", attempts, queueDepth: state.entries.length });
              reportSyncStatus(TRACK_UI_COPY.status.offlineStuck);
            } else {
              recordSyncTelemetry({
                kind: "retry",
                attempts,
                queueDepth: state.entries.length,
                durationMs: Date.now() - uploadStartedAt,
              });
              reportSyncStatus(isOffline() ? TRACK_UI_COPY.status.offlineQueued : TRACK_UI_COPY.status.needsAttention);
              scheduleRetry(userId, nextRetryAt);
            }
            // Keep the queue FIFO after a transient failure. A later workout
            // should not leapfrog one that has not been acknowledged yet.
            break;
          }
          recordSyncTelemetry({
            kind: "uploaded",
            queueDepth: Math.max(0, state.entries.length - 1),
            durationMs: Date.now() - uploadStartedAt,
          });
          const removed = await removeOfflineWorkoutSession(userId, entry.clientMutationId);
          if (!removed) {
            reportSyncStatus(TRACK_UI_COPY.status.needsAttention);
            break;
          }
          broadcastQueueChange(userId);
          broadcastWorkoutFinished({ dateKey: entry.dateKey, splitId: entry.splitId });
        }

        const remaining = await refreshOfflineQueue(userId);
        if (currentGeneration !== generation.current || user?.id !== userId) return;
        if (!remaining.entries.length) {
          clearRetryTimer();
          reportSyncStatus("Saved", true);
        } else if (remaining.entries.every((entry) => remaining.statuses[entry.clientMutationId]?.stuck)) {
          reportSyncStatus(TRACK_UI_COPY.status.offlineStuck);
        }
      } finally {
        if (currentGeneration === generation.current) flushInProgress.current = false;
      }
    });
    // Another tab may own the lock. Its queue-change message will refresh
    // this tab, so a second writer is never started here.
    void result;
  }, [
    broadcastQueueChange,
    broadcastWorkoutFinished,
    clearRetryTimer,
    cloudReady,
    refreshOfflineQueue,
    reportSyncStatus,
    scheduleRetry,
    user?.id,
  ]);

  useEffect(() => {
    flushRef.current = flushOfflineWorkoutQueue;
  }, [flushOfflineWorkoutQueue]);

  const queueWorkoutSession = useCallback(
    async (entry: WorkoutSessionPayload) => {
      const userId = user?.id;
      if (!userId) return false;
      const queued = await enqueueOfflineWorkoutSession(userId, entry);
      if (!queued || user?.id !== userId) {
        const storageStatus = getOfflineStorageStatus();
        if (storageStatus !== "ok") {
          recordSyncTelemetry({ kind: "storage-error", storageStatus });
          reportSyncStatus(TRACK_UI_COPY.status.offlineStorage);
        }
        return false;
      }
      const state = await refreshOfflineQueue(userId);
      recordSyncTelemetry({ kind: "queued", queueDepth: state.entries.length });
      broadcastQueueChange(userId);
      reportSyncStatus(TRACK_UI_COPY.status.offlineQueued);
      if (!isOffline()) void flushOfflineWorkoutQueue();
      return true;
    },
    [broadcastQueueChange, flushOfflineWorkoutQueue, refreshOfflineQueue, reportSyncStatus, user?.id],
  );

  const retryOfflineQueue = useCallback(async () => {
    const userId = user?.id;
    if (!userId) return;
    await resetOfflineWorkoutQueueFailures(userId);
    await refreshOfflineQueue(userId);
    broadcastQueueChange(userId);
    void flushOfflineWorkoutQueue();
  }, [broadcastQueueChange, flushOfflineWorkoutQueue, refreshOfflineQueue, user?.id]);

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
    const channel = globalThis.BroadcastChannel ? new BroadcastChannel("track-offline-queue") : null;
    queueChannelRef.current = channel;
    const handleMessage = (event: MessageEvent<QueueChannelMessage>) => {
      if (event.data?.type !== "queue-changed" || event.data.userId !== userId) return;
      void refreshOfflineQueue(userId);
      resume();
    };
    channel?.addEventListener("message", handleMessage);
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      cancelled = true;
      window.clearTimeout(initialRefresh);
      clearRetryTimer();
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
      document.removeEventListener("visibilitychange", resume);
      channel?.removeEventListener("message", handleMessage);
      channel?.close();
      if (queueChannelRef.current === channel) queueChannelRef.current = null;
    };
  }, [clearRetryTimer, cloudReady, flushOfflineWorkoutQueue, refreshOfflineQueue, user?.id]);

  return {
    flushOfflineWorkoutQueue,
    offlineQueueCount,
    offlineQueueStuckCount,
    queueWorkoutSession,
    resetOfflineQueueState,
    retryOfflineQueue,
  };
}
