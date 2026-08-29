"use client";

import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../supabase";
import { fetchOnlineLists, fetchSavedSplitIdsForToday, fetchTrackRevision, saveTrackState } from "../data/trackApi";
import type { TimerMode } from "../components/TimerScreen";
import { readTrackSnapshot, type TrackLocalSnapshot } from "../offlineStore";
import type { Checklist, TimerRuntimeState, TrackPreferences } from "../trackTypes";
import type { EquipmentType } from "../rankTypes";
import { SYNC_SAVE_DEBOUNCE_MS, TRACK_TIMING, TRACK_UI_COPY } from "../trackConstants";
import { useTrackSyncStatus } from "./useTrackSyncStatus";
import { useTrackLocalSnapshot } from "./useTrackLocalSnapshot";
import { useTrackPreferenceSync } from "./useTrackPreferenceSync";
import { useTrackRealtimeSync } from "./useTrackRealtimeSync";
import {
  accountStorageKey,
  cloudListSignature,
  mergeTrackLists,
  normalizeTask,
  promiseWithTimeout,
  restoreLocalCollapseState,
  safeStorageGet,
} from "../trackUtils";
import { useTrackOfflineQueue } from "./useTrackOfflineQueue";
import { useSyncConflictState } from "./useSyncConflictState";

type RankEquipmentOverrides = Record<string, EquipmentType>;
export type TrackSyncEventName =
  | "preferences-updated"
  | "workout-updated"
  | "workout-finished"
  | "workout-delete-pending"
  | "workout-restored"
  | "workout-deleted"
  | "rank-equipment-overrides";
export type TrackSyncEventPayload = Partial<{
  dateKey: string;
  splitId: string;
  revision: number;
  updatedAt: number;
  preferences: TrackPreferences;
  overrides: RankEquipmentOverrides;
}>;
type DateReader = (userId: string) => Promise<Set<string> | null>;
type DateMarker = (dateKey: string) => void;
type DateRemover = (dateKey: string, clearCompletion?: boolean) => void;
type DateRestorer = (dateKey: string) => void;
type SavedMarkerApplier = (savedToday: Set<string>, sourceLists: Checklist[], clearStaleDirty: boolean) => void;
function isOffline() {
  return globalThis.navigator?.onLine === false;
}

type UseTrackCloudSyncOptions = {
  user: User | null;
  ready: boolean;
  cloudReady: boolean;
  lists: Checklist[];
  activeId: string;
  rememberExercisesAcrossSplits: boolean;
  defaultUnit: TrackPreferences["defaultUnit"];
  timerMode: TimerMode;
  timerRunning: boolean;
  timerRuntime: TimerRuntimeState;
  applyTimerRuntime: (runtime: TimerRuntimeState) => void;
  restSeconds: number;
  restCustom: boolean;
  completionEnabled: boolean;
  accountLocalReadyFor: string | null;
  setLists: Dispatch<SetStateAction<Checklist[]>>;
  setActiveId: Dispatch<SetStateAction<string>>;
  setCloudReady: Dispatch<SetStateAction<boolean>>;
  setSyncLabel: Dispatch<SetStateAction<string>>;
  setLastSuccessfulSyncAt: Dispatch<SetStateAction<number | null>>;
  setDefaultUnit: Dispatch<SetStateAction<TrackPreferences["defaultUnit"]>>;
  setTimerMode: Dispatch<SetStateAction<TimerMode>>;
  setRestSeconds: Dispatch<SetStateAction<number>>;
  setRestCustom: Dispatch<SetStateAction<boolean>>;
  setCustomRestInput: Dispatch<SetStateAction<string>>;
  setRestRemaining: Dispatch<SetStateAction<number>>;
  setRememberExercisesAcrossSplits: Dispatch<SetStateAction<boolean>>;
  setCompletionEnabled: Dispatch<SetStateAction<boolean>>;
  setRankEquipmentOverrides: Dispatch<SetStateAction<RankEquipmentOverrides>>;
  setRankHistoryVersion: Dispatch<SetStateAction<number>>;
  setUser: Dispatch<SetStateAction<User | null>>;
  setSavedSplits: Dispatch<SetStateAction<Set<string>>>;
  applySavedTodayMarkersRef: MutableRefObject<SavedMarkerApplier>;
  readWorkoutDates: DateReader;
  applyWorkoutDates: (dates: Set<string>) => void;
  markWorkoutDate: DateMarker;
  removeWorkoutDate: DateRemover;
  restoreWorkoutDate: DateRestorer;
  workoutFinishInFlight: MutableRefObject<boolean>;
};

export function useTrackCloudSync({
  user,
  ready,
  cloudReady,
  lists,
  activeId,
  rememberExercisesAcrossSplits,
  defaultUnit,
  timerMode,
  timerRunning,
  timerRuntime,
  applyTimerRuntime,
  restSeconds,
  restCustom,
  completionEnabled,
  accountLocalReadyFor,
  setLists,
  setActiveId,
  setCloudReady,
  setSyncLabel,
  setLastSuccessfulSyncAt,
  setDefaultUnit,
  setTimerMode,
  setRestSeconds,
  setRestCustom,
  setCustomRestInput,
  setRestRemaining,
  setRememberExercisesAcrossSplits,
  setCompletionEnabled,
  setRankEquipmentOverrides,
  setRankHistoryVersion,
  setUser,
  setSavedSplits,
  applySavedTodayMarkersRef,
  readWorkoutDates,
  applyWorkoutDates,
  markWorkoutDate,
  removeWorkoutDate,
  restoreWorkoutDate,
  workoutFinishInFlight,
}: UseTrackCloudSyncOptions) {
  const saveTimer = useRef<number | null>(null);
  const syncRefreshTimer = useRef<number | null>(null);
  const syncChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const syncClientId = useRef("");
  const syncRealtimeConnected = useRef(false);
  const syncReadRevision = useRef(0);
  const listsRef = useRef<Checklist[]>([]);
  const localChangesPending = useRef(false);
  const workoutFinishEpoch = useRef(0);
  const localRevision = useRef(0);
  const remoteRevision = useRef(0);
  const pendingLocalSnapshot = useRef<TrackLocalSnapshot<Checklist[]> | null>(null);
  const saveRetryAttempt = useRef(0);
  const lastSyncedSignature = useRef("");
  const lastSyncedLists = useRef<Checklist[]>([]);
  const cloudWriteInProgress = useRef(false);
  const applyingCloudUpdate = useRef(false);
  const initialSyncReconciliation = useRef(false);
  const lastOnlineListsLoad = useRef<{ userId: string; rememberExercisesAcrossSplits: boolean } | null>(null);
  const preferenceSaveInFlightRef = useRef<() => boolean>(() => false);
  const retrySyncRef = useRef<() => void>(() => undefined);
  const workoutQueuePending = useRef(false);
  const {
    clearConflictForUser,
    conflictRef: conflictState,
    syncConflict,
    updateConflictState,
  } = useSyncConflictState();

  const ensureSyncClientId = useCallback(() => {
    if (!syncClientId.current)
      syncClientId.current =
        globalThis.crypto?.randomUUID?.() ?? `track-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return syncClientId.current;
  }, []);

  const broadcastSyncEvent = useCallback(
    (event: TrackSyncEventName, payload: TrackSyncEventPayload = {}) => {
      const channel = syncChannel.current;
      if (!channel) return;
      void channel.send({ type: "broadcast", event, payload: { source: ensureSyncClientId(), ...payload } });
    },
    [ensureSyncClientId],
  );
  const broadcastWorkoutFinished = useCallback(
    (payload: { dateKey: string; splitId: string }) => broadcastSyncEvent("workout-finished", payload),
    [broadcastSyncEvent],
  );

  const invalidateCloudReads = useCallback(() => {
    syncReadRevision.current += 1;
    workoutFinishEpoch.current += 1;
  }, []);

  const isCloudSaveInFlight = useCallback(
    () =>
      localChangesPending.current ||
      cloudWriteInProgress.current ||
      preferenceSaveInFlightRef.current() ||
      workoutQueuePending.current,
    [],
  );
  const { clearSyncStatusTimer, showSyncStatus } = useTrackSyncStatus({
    setSyncLabel,
    setLastSuccessfulSyncAt,
    isBusy: isCloudSaveInFlight,
  });
  const reportSyncStatus = useCallback(
    (label: string, settleToSaved = false) => {
      if (initialSyncReconciliation.current && (label === "Loading…" || label === "Syncing…" || label === "Saving…"))
        return;
      const queueKeepsSyncing = workoutQueuePending.current && /^(saved|updated)$/i.test(label.trim());
      showSyncStatus(
        queueKeepsSyncing ? (isOffline() ? TRACK_UI_COPY.status.offlineQueued : TRACK_UI_COPY.status.syncing) : label,
        settleToSaved && !queueKeepsSyncing,
      );
    },
    [showSyncStatus],
  );
  const { offlineQueueCount, offlineQueueStuckCount, queueWorkoutSession, resetOfflineQueueState, retryOfflineQueue } =
    useTrackOfflineQueue({
      user,
      cloudReady,
      queuePendingRef: workoutQueuePending,
      reportSyncStatus,
      broadcastWorkoutFinished,
    });

  const { preferencesRef, resetPreferenceSync, applyIncomingPreferences, isPreferenceSaveInFlight } =
    useTrackPreferenceSync({
      user,
      defaultUnit,
      timerMode,
      timerRunning,
      timerRuntime,
      restSeconds,
      restCustom,
      rememberExercisesAcrossSplits,
      completionEnabled,
      syncRealtimeConnected,
      applyTimerRuntime,
      reportSyncStatus,
      broadcastPreferences: (preferences) => broadcastSyncEvent("preferences-updated", { preferences }),
      setDefaultUnit,
      setTimerMode,
      setRestSeconds,
      setRestCustom,
      setCustomRestInput,
      setRestRemaining,
      setRememberExercisesAcrossSplits,
      setCompletionEnabled,
      setRankEquipmentOverrides,
      setUser,
    });
  useEffect(() => {
    preferenceSaveInFlightRef.current = isPreferenceSaveInFlight;
  }, [isPreferenceSaveInFlight]);
  const { invalidateSnapshotWrites, writeSnapshot } = useTrackLocalSnapshot({
    ready,
    cloudReady,
    activeId,
    accountLocalReadyFor,
    lists,
    userId: user?.id ?? null,
    localChangesPending,
    remoteRevision,
  });

  const resetCloudSyncState = useCallback(() => {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    if (syncRefreshTimer.current !== null) window.clearTimeout(syncRefreshTimer.current);
    clearSyncStatusTimer();
    saveTimer.current = null;
    syncRefreshTimer.current = null;
    invalidateSnapshotWrites();
    syncReadRevision.current += 1;
    workoutFinishEpoch.current += 1;
    localChangesPending.current = false;
    cloudWriteInProgress.current = false;
    resetOfflineQueueState();
    updateConflictState(null);
    initialSyncReconciliation.current = false;
    lastOnlineListsLoad.current = null;
    pendingLocalSnapshot.current = null;
    listsRef.current = [];
    lastSyncedSignature.current = "";
    lastSyncedLists.current = [];
    remoteRevision.current = 0;
    resetPreferenceSync();
    syncRealtimeConnected.current = false;
    const channel = syncChannel.current;
    syncChannel.current = null;
    if (channel) void supabase.removeChannel(channel);
  }, [
    clearSyncStatusTimer,
    invalidateSnapshotWrites,
    resetOfflineQueueState,
    resetPreferenceSync,
    updateConflictState,
  ]);

  useEffect(() => {
    listsRef.current = lists;
  }, [lists]);

  useEffect(() => {
    if (!user || !ready) return;
    const userId = user.id;
    let cancelled = false;
    let retryTimer: number | null = null;
    let retryAttempt = 0;
    const rememberExercises = preferencesRef.current.rememberExercisesAcrossSplits;
    lastOnlineListsLoad.current = { userId, rememberExercisesAcrossSplits: rememberExercises };
    const scheduleRetry = () => {
      if (cancelled || retryTimer !== null) return;
      const delay = Math.min(
        TRACK_TIMING.initialSyncRetryMaxMs,
        TRACK_TIMING.initialSyncRetryBaseMs * 2 ** Math.min(retryAttempt, TRACK_TIMING.cloudSaveRetryMaxAttempts),
      );
      retryAttempt += 1;
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        void loadOnlineData().catch(() => {
          if (cancelled) return;
          reportSyncStatus("Retrying…");
          scheduleRetry();
        });
      }, delay);
    };
    const loadOnlineData = async () => {
      initialSyncReconciliation.current = true;
      reportSyncStatus("Loading…");
      const savedActiveId = safeStorageGet(accountStorageKey(userId, "active-split"));
      const [result, savedToday, localSnapshot, revision] = await Promise.all([
        promiseWithTimeout(fetchOnlineLists(rememberExercises), TRACK_TIMING.cloudRequestTimeoutMs).catch(() => ({
          lists: [],
          error: true,
        })),
        promiseWithTimeout(fetchSavedSplitIdsForToday(userId), TRACK_TIMING.cloudRequestTimeoutMs).catch(() => null),
        readTrackSnapshot<Checklist[]>(userId).catch(() => null),
        promiseWithTimeout(fetchTrackRevision(userId), TRACK_TIMING.cloudRequestTimeoutMs).catch(() => null),
      ]);
      if (cancelled) return;
      const chooseActiveId = (candidateLists: Checklist[]) =>
        savedActiveId && candidateLists.some((list) => list.id === savedActiveId)
          ? savedActiveId
          : (candidateLists[0]?.id ?? "");
      const pendingSnapshot = localSnapshot?.pending && Array.isArray(localSnapshot.lists) ? localSnapshot : null;
      pendingLocalSnapshot.current = pendingSnapshot;
      remoteRevision.current = pendingSnapshot
        ? Math.max(0, Number(pendingSnapshot.remoteRevision) || 0)
        : (revision ?? 0);
      if (result.error && !pendingSnapshot) {
        const cached = localSnapshot?.lists;
        if (Array.isArray(cached)) {
          const normalized = cached.map((list) => ({
            ...list,
            tasks: Array.isArray(list.tasks) ? list.tasks.map(normalizeTask) : [],
          }));
          listsRef.current = normalized;
          lastSyncedLists.current = normalized;
          lastSyncedSignature.current = cloudListSignature(normalized);
          setLists(normalized);
          setActiveId((current) =>
            normalized.some((list) => list.id === current) ? current : chooseActiveId(normalized),
          );
          setCloudReady(true);
          initialSyncReconciliation.current = false;
          reportSyncStatus(TRACK_UI_COPY.status.offline);
          return;
        }
        initialSyncReconciliation.current = false;
        reportSyncStatus(isOffline() ? TRACK_UI_COPY.status.offline : TRACK_UI_COPY.status.needsAttention);
        scheduleRetry();
        return;
      }
      retryAttempt = 0;
      if (pendingSnapshot) {
        const normalized = pendingSnapshot.lists.map((list) => ({
          ...list,
          tasks: Array.isArray(list.tasks) ? list.tasks.map(normalizeTask) : [],
        }));
        localChangesPending.current = true;
        lastSyncedLists.current = result.error ? [] : result.lists;
        lastSyncedSignature.current = cloudListSignature(result.lists);
        listsRef.current = normalized;
        setLists(normalized);
        setActiveId((current) =>
          normalized.some((list) => list.id === current) ? current : chooseActiveId(normalized),
        );
        reportSyncStatus("Syncing…");
      } else {
        applyingCloudUpdate.current = true;
        localChangesPending.current = false;
        const normalized = restoreLocalCollapseState(result.lists, localSnapshot?.lists);
        listsRef.current = normalized;
        lastSyncedLists.current = normalized;
        lastSyncedSignature.current = cloudListSignature(normalized);
        setLists(normalized);
        setActiveId((current) =>
          normalized.some((list) => list.id === current) ? current : (normalized[0]?.id ?? ""),
        );
      }
      if (savedToday)
        applySavedTodayMarkersRef.current(
          savedToday,
          pendingSnapshot ? pendingSnapshot.lists : result.lists,
          !pendingSnapshot,
        );
      setCloudReady(true);
      if (!pendingSnapshot) {
        initialSyncReconciliation.current = false;
        reportSyncStatus("Saved");
      }
    };
    const retryNow = () => {
      if (cancelled) return;
      retryAttempt = 0;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      retryTimer = null;
      void loadOnlineData().catch(() => {
        if (cancelled) return;
        reportSyncStatus(TRACK_UI_COPY.status.needsAttention);
        scheduleRetry();
      });
    };
    retrySyncRef.current = retryNow;
    void loadOnlineData().catch(() => {
      if (cancelled) return;
      initialSyncReconciliation.current = false;
      reportSyncStatus(TRACK_UI_COPY.status.needsAttention);
      scheduleRetry();
    });
    return () => {
      cancelled = true;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      if (retrySyncRef.current === retryNow) retrySyncRef.current = () => undefined;
      initialSyncReconciliation.current = false;
    };
  }, [applySavedTodayMarkersRef, preferencesRef, ready, reportSyncStatus, setActiveId, setCloudReady, setLists, user]);

  const retrySync = useCallback(() => {
    retrySyncRef.current();
    void retryOfflineQueue();
  }, [retryOfflineQueue]);

  useEffect(() => {
    const handleOnline = () => retrySync();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [retrySync]);

  useEffect(() => {
    if (!user || !cloudReady) return;
    if (applyingCloudUpdate.current) {
      applyingCloudUpdate.current = false;
      return;
    }
    const signature = cloudListSignature(lists);
    if (signature === lastSyncedSignature.current) {
      initialSyncReconciliation.current = false;
      return;
    }
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    const revision = ++localRevision.current;
    localChangesPending.current = true;
    reportSyncStatus("Saving…");
    const saveLatest = async () => {
      if (cloudWriteInProgress.current) {
        saveTimer.current = window.setTimeout(saveLatest, TRACK_TIMING.cloudWritePollMs);
        return;
      }
      cloudWriteInProgress.current = true;
      const failSave = () => {
        cloudWriteInProgress.current = false;
        if (revision === localRevision.current) {
          localChangesPending.current = true;
          initialSyncReconciliation.current = false;
          reportSyncStatus(isOffline() ? TRACK_UI_COPY.status.offlineQueued : TRACK_UI_COPY.status.needsAttention);
          saveRetryAttempt.current = Math.min(saveRetryAttempt.current + 1, TRACK_TIMING.cloudSaveRetryMaxAttempts);
          saveTimer.current = window.setTimeout(
            saveLatest,
            Math.min(
              TRACK_TIMING.preferenceSaveRetryMaxMs,
              TRACK_TIMING.preferenceSaveRetryBaseMs * 2 ** saveRetryAttempt.current,
            ),
          );
        }
      };
      const snapshot = lists.map((list) => ({ ...list, tasks: list.tasks.map(normalizeTask) }));
      writeSnapshot({
        userId: user.id,
        lists: snapshot,
        pending: true,
        updatedAt: Date.now(),
        remoteRevision: remoteRevision.current,
      });
      let result: Awaited<ReturnType<typeof saveTrackState>>;
      try {
        result = await promiseWithTimeout(
          saveTrackState(snapshot, remoteRevision.current),
          TRACK_TIMING.cloudRequestTimeoutMs,
        );
      } catch {
        failSave();
        return;
      }
      if (!result.ok) {
        if (result.conflict) {
          let remote: Awaited<ReturnType<typeof fetchOnlineLists>>;
          try {
            remote = await promiseWithTimeout(
              fetchOnlineLists(preferencesRef.current.rememberExercisesAcrossSplits),
              TRACK_TIMING.cloudRequestTimeoutMs,
            );
          } catch {
            failSave();
            return;
          }
          cloudWriteInProgress.current = false;
          if (remote.error) {
            failSave();
            return;
          }
          const merged = mergeTrackLists(remote.lists, snapshot, lastSyncedLists.current);
          remoteRevision.current = result.revision ?? remoteRevision.current;
          updateConflictState({
            userId: user.id,
            baseLists: lastSyncedLists.current,
            localLists: snapshot,
            remoteLists: remote.lists,
            mergedLists: merged,
            revision: remoteRevision.current,
          });
          lastSyncedLists.current = remote.lists;
          lastSyncedSignature.current = cloudListSignature(remote.lists);
          listsRef.current = merged;
          setLists(merged);
          writeSnapshot({
            userId: user.id,
            lists: merged,
            pending: true,
            updatedAt: Date.now(),
            remoteRevision: remoteRevision.current,
          });
          localChangesPending.current = true;
          reportSyncStatus("Conflict resolved — review changes");
          saveRetryAttempt.current = 0;
          return;
        }
        failSave();
        return;
      }
      remoteRevision.current = result.revision;
      cloudWriteInProgress.current = false;
      if (revision === localRevision.current) {
        updateConflictState(null);
        lastSyncedLists.current = snapshot;
        lastSyncedSignature.current = signature;
        localChangesPending.current = false;
        pendingLocalSnapshot.current = null;
        saveRetryAttempt.current = 0;
        writeSnapshot({
          userId: user.id,
          lists: snapshot,
          pending: false,
          updatedAt: Date.now(),
          remoteRevision: remoteRevision.current,
        });
        initialSyncReconciliation.current = false;
        reportSyncStatus("Saved");
        broadcastSyncEvent("workout-updated", { revision: remoteRevision.current, updatedAt: Date.now() });
      }
    };
    saveTimer.current = window.setTimeout(saveLatest, SYNC_SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    };
  }, [
    broadcastSyncEvent,
    cloudReady,
    lists,
    preferencesRef,
    reportSyncStatus,
    setLists,
    updateConflictState,
    user,
    writeSnapshot,
  ]);

  const resolveSyncConflict = useCallback(() => {
    const conflict = conflictState.current;
    if (!conflict || conflict.userId !== user?.id) return;
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = null;
    localRevision.current += 1;
    updateConflictState(null);
    applyingCloudUpdate.current = true;
    cloudWriteInProgress.current = false;
    localChangesPending.current = false;
    remoteRevision.current = conflict.revision;
    listsRef.current = conflict.remoteLists;
    lastSyncedLists.current = conflict.remoteLists;
    lastSyncedSignature.current = cloudListSignature(conflict.remoteLists);
    setLists(conflict.remoteLists);
    setActiveId((current) =>
      conflict.remoteLists.some((list) => list.id === current) ? current : (conflict.remoteLists[0]?.id ?? ""),
    );
    writeSnapshot({
      userId: conflict.userId,
      lists: conflict.remoteLists,
      pending: false,
      updatedAt: Date.now(),
      remoteRevision: conflict.revision,
    });
    initialSyncReconciliation.current = false;
    reportSyncStatus("Saved", true);
  }, [conflictState, reportSyncStatus, setActiveId, setLists, updateConflictState, user?.id, writeSnapshot]);

  useTrackRealtimeSync({
    user,
    cloudReady,
    preferencesRef,
    listsRef,
    localChangesPending,
    cloudWriteInProgress,
    syncRefreshTimer,
    syncChannelRef: syncChannel,
    syncClientId,
    syncRealtimeConnected,
    syncReadRevision,
    remoteRevision,
    syncedListsRef: lastSyncedLists,
    syncedSignatureRef: lastSyncedSignature,
    workoutFinishEpoch,
    workoutFinishInFlight,
    ensureSyncClientId,
    applyIncomingPreferences,
    applySavedTodayMarkersRef,
    readWorkoutDates,
    applyWorkoutDates,
    markWorkoutDate,
    removeWorkoutDate,
    restoreWorkoutDate,
    reportSyncStatus,
    setLists,
    setActiveId,
    setSavedSplits,
    setRankEquipmentOverrides,
    setRankHistoryVersion,
    setUser,
    writeSnapshot,
  });

  useEffect(() => {
    if (!user || !cloudReady || localChangesPending.current || cloudWriteInProgress.current) return;
    const loadKey = { userId: user.id, rememberExercisesAcrossSplits };
    if (
      lastOnlineListsLoad.current?.userId === loadKey.userId &&
      lastOnlineListsLoad.current.rememberExercisesAcrossSplits === loadKey.rememberExercisesAcrossSplits
    )
      return;
    lastOnlineListsLoad.current = loadKey;
    let cancelled = false;
    void promiseWithTimeout(fetchOnlineLists(rememberExercisesAcrossSplits), TRACK_TIMING.cloudRequestTimeoutMs)
      .then((result) => {
        if (cancelled || result.error) {
          if (!cancelled && lastOnlineListsLoad.current?.userId === loadKey.userId) lastOnlineListsLoad.current = null;
          return;
        }
        const nextLists = restoreLocalCollapseState(result.lists, listsRef.current);
        applyingCloudUpdate.current = true;
        listsRef.current = nextLists;
        lastSyncedLists.current = nextLists;
        lastSyncedSignature.current = cloudListSignature(nextLists);
        setLists(nextLists);
      })
      .catch(() => {
        if (!cancelled) {
          if (lastOnlineListsLoad.current?.userId === loadKey.userId) lastOnlineListsLoad.current = null;
          reportSyncStatus("Retrying…");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [cloudReady, rememberExercisesAcrossSplits, reportSyncStatus, setLists, user]);

  return {
    broadcastSyncEvent,
    invalidateCloudReads,
    resetCloudSyncState,
    isCloudSaveInFlight,
    retrySync,
    queueWorkoutSession,
    offlineQueueCount,
    offlineQueueStuckCount,
    syncConflict,
    keepMergedSyncConflict: () => clearConflictForUser(user?.id ?? null),
    resolveSyncConflict,
  };
}
