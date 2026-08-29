"use client";

import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../supabase";
import { fetchOnlineLists, fetchSavedSplitIdsForToday, fetchTrackRevision } from "../data/trackApi";
import type { Checklist, TrackPreferences } from "../trackTypes";
import type { EquipmentType } from "../rankTypes";
import { SYNC_FALLBACK_POLL_MS, SYNC_REFRESH_DEBOUNCE_MS, TRACK_TIMING } from "../trackConstants";
import type { TrackSnapshotWriter } from "./useTrackLocalSnapshot";
import {
  cloudListSignature,
  isStringValue,
  normalizePreferences,
  parsedRankEquipmentOverrides,
  parsedSyncRevision,
  promiseWithTimeout,
  restoreLocalCollapseState,
} from "../trackUtils";

type RankEquipmentOverrides = Record<string, EquipmentType>;
type DateReader = (userId: string) => Promise<Set<string> | null>;
type DateMarker = (dateKey: string) => void;
type DateRemover = (dateKey: string, clearCompletion?: boolean) => void;
type DateRestorer = (dateKey: string) => void;
type SavedMarkerApplier = (savedToday: Set<string>, sourceLists: Checklist[], clearStaleDirty: boolean) => void;
type SyncChannel = ReturnType<typeof supabase.channel>;
type RefreshRequest = { refreshDates?: boolean; includeHistory?: boolean };

type UseTrackRealtimeSyncOptions = {
  user: User | null;
  cloudReady: boolean;
  preferencesRef: MutableRefObject<TrackPreferences>;
  listsRef: MutableRefObject<Checklist[]>;
  localChangesPending: MutableRefObject<boolean>;
  cloudWriteInProgress: MutableRefObject<boolean>;
  syncRefreshTimer: MutableRefObject<number | null>;
  syncChannelRef: MutableRefObject<SyncChannel | null>;
  syncClientId: MutableRefObject<string>;
  syncRealtimeConnected: MutableRefObject<boolean>;
  syncReadRevision: MutableRefObject<number>;
  remoteRevision: MutableRefObject<number>;
  syncedListsRef: MutableRefObject<Checklist[]>;
  syncedSignatureRef: MutableRefObject<string>;
  workoutFinishEpoch: MutableRefObject<number>;
  workoutFinishInFlight: MutableRefObject<boolean>;
  ensureSyncClientId: () => string;
  applyIncomingPreferences: (preferences: TrackPreferences) => void;
  applySavedTodayMarkersRef: MutableRefObject<SavedMarkerApplier>;
  readWorkoutDates: DateReader;
  applyWorkoutDates: (dates: Set<string>) => void;
  markWorkoutDate: DateMarker;
  removeWorkoutDate: DateRemover;
  restoreWorkoutDate: DateRestorer;
  reportSyncStatus: (label: string, settleToSaved?: boolean) => void;
  setLists: Dispatch<SetStateAction<Checklist[]>>;
  setActiveId: Dispatch<SetStateAction<string>>;
  setSavedSplits: Dispatch<SetStateAction<Set<string>>>;
  setRankEquipmentOverrides: Dispatch<SetStateAction<RankEquipmentOverrides>>;
  setRankHistoryVersion: Dispatch<SetStateAction<number>>;
  setUser: Dispatch<SetStateAction<User | null>>;
  writeSnapshot: TrackSnapshotWriter;
};

export function useTrackRealtimeSync({
  user,
  cloudReady,
  preferencesRef,
  listsRef,
  localChangesPending,
  cloudWriteInProgress,
  syncRefreshTimer,
  syncChannelRef,
  syncClientId,
  syncRealtimeConnected,
  syncReadRevision,
  remoteRevision,
  syncedListsRef,
  syncedSignatureRef,
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
}: UseTrackRealtimeSyncOptions) {
  useEffect(() => {
    if (!user || !cloudReady) return;
    let cancelled = false;
    let refreshInFlight: Promise<void> | null = null;
    let refreshQueued = false;
    let refreshQueuedRevision: number | null = null;
    let refreshQueuedDates = false;
    let refreshQueuedHistory = false;
    let refreshTrailingTimer: number | null = null;
    ensureSyncClientId();

    const rememberQueuedRevision = (revision: number | null) => {
      if (revision !== null) refreshQueuedRevision = Math.max(refreshQueuedRevision ?? 0, revision);
    };

    const rememberQueuedRequest = ({ refreshDates = false, includeHistory = false }: RefreshRequest = {}) => {
      refreshQueuedDates = refreshQueuedDates || refreshDates;
      refreshQueuedHistory = refreshQueuedHistory || includeHistory;
    };

    const scheduleQueuedRefresh = (knownRevision: number | null = null, request: RefreshRequest = {}) => {
      rememberQueuedRevision(knownRevision);
      rememberQueuedRequest(request);
      if (cancelled || document.hidden || refreshTrailingTimer !== null) return;
      refreshTrailingTimer = window.setTimeout(() => {
        refreshTrailingTimer = null;
        const queuedRevision = refreshQueuedRevision;
        refreshQueuedRevision = null;
        const queuedRequest = { refreshDates: refreshQueuedDates, includeHistory: refreshQueuedHistory };
        refreshQueuedDates = false;
        refreshQueuedHistory = false;
        void refreshFromCloud(queuedRevision, queuedRequest).catch(() => {
          if (!cancelled) reportSyncStatus("Retrying…");
        });
      }, SYNC_REFRESH_DEBOUNCE_MS);
    };

    const runRefresh = async (knownRevision: number | null = null, request: RefreshRequest = {}) => {
      const { refreshDates = false, includeHistory = false } = request;
      const readRevision = ++syncReadRevision.current;
      const readFinishEpoch = workoutFinishEpoch.current;
      const serverRevision =
        knownRevision ?? (await promiseWithTimeout(fetchTrackRevision(user.id), TRACK_TIMING.cloudRequestTimeoutMs));
      if (cancelled || readRevision !== syncReadRevision.current || readFinishEpoch !== workoutFinishEpoch.current)
        return;
      const shouldReloadLists =
        localChangesPending.current || serverRevision === null || serverRevision !== remoteRevision.current;
      const [savedToday, dates] = await Promise.all([
        shouldReloadLists || refreshDates
          ? promiseWithTimeout(fetchSavedSplitIdsForToday(user.id), TRACK_TIMING.cloudRequestTimeoutMs)
          : Promise.resolve(null),
        refreshDates
          ? promiseWithTimeout(readWorkoutDates(user.id), TRACK_TIMING.cloudRequestTimeoutMs)
          : Promise.resolve(null),
      ]);
      if (
        cancelled ||
        readRevision !== syncReadRevision.current ||
        readFinishEpoch !== workoutFinishEpoch.current ||
        workoutFinishInFlight.current ||
        cloudWriteInProgress.current
      )
        return;
      if (savedToday) applySavedTodayMarkersRef.current(savedToday, listsRef.current, !localChangesPending.current);
      if (dates) applyWorkoutDates(dates);
      if (!shouldReloadLists) return;
      const result = await promiseWithTimeout(
        fetchOnlineLists(preferencesRef.current.rememberExercisesAcrossSplits, { includeHistory }),
        TRACK_TIMING.cloudRequestTimeoutMs,
      );
      if (
        cancelled ||
        readRevision !== syncReadRevision.current ||
        readFinishEpoch !== workoutFinishEpoch.current ||
        workoutFinishInFlight.current ||
        result.error ||
        cloudWriteInProgress.current
      )
        return;
      const nextLists = restoreLocalCollapseState(result.lists, listsRef.current);
      const remoteRevisionValue = serverRevision ?? remoteRevision.current;
      if (cloudListSignature(nextLists) === cloudListSignature(listsRef.current)) {
        remoteRevision.current = Math.max(remoteRevision.current, remoteRevisionValue);
        syncedListsRef.current = nextLists;
        syncedSignatureRef.current = cloudListSignature(nextLists);
        return;
      }
      if (localChangesPending.current) {
        if (remoteRevisionValue > 0) reportSyncStatus("Syncing…");
        return;
      }
      localChangesPending.current = false;
      remoteRevision.current = remoteRevisionValue;
      syncedListsRef.current = nextLists;
      syncedSignatureRef.current = cloudListSignature(nextLists);
      listsRef.current = nextLists;
      setLists(nextLists);
      setActiveId((current) => (nextLists.some((list) => list.id === current) ? current : (nextLists[0]?.id ?? "")));
      reportSyncStatus("Updated", true);
      writeSnapshot({
        userId: user.id,
        lists: nextLists,
        pending: false,
        updatedAt: Date.now(),
        remoteRevision: remoteRevisionValue,
      });
    };

    const refreshFromCloud = async (knownRevision: number | null = null, request: RefreshRequest = {}) => {
      if (cancelled) return;
      if (document.hidden) {
        rememberQueuedRevision(knownRevision);
        rememberQueuedRequest(request);
        return;
      }
      if (cloudWriteInProgress.current || workoutFinishInFlight.current) {
        refreshQueued = true;
        scheduleQueuedRefresh(knownRevision, request);
        return;
      }
      if (refreshInFlight) {
        refreshQueued = true;
        rememberQueuedRevision(knownRevision);
        rememberQueuedRequest(request);
        return refreshInFlight;
      }
      const operation = runRefresh(knownRevision, request);
      refreshInFlight = operation;
      try {
        await operation;
      } finally {
        if (refreshInFlight === operation) refreshInFlight = null;
        if (refreshQueued && !cancelled) {
          const queuedRevision = refreshQueuedRevision;
          refreshQueued = false;
          refreshQueuedRevision = null;
          const queuedRequest = { refreshDates: refreshQueuedDates, includeHistory: refreshQueuedHistory };
          refreshQueuedDates = false;
          refreshQueuedHistory = false;
          scheduleQueuedRefresh(queuedRevision, queuedRequest);
        }
      }
    };

    const queueRefresh = (knownRevision: number | null = null, request: RefreshRequest = {}) => {
      rememberQueuedRevision(knownRevision);
      rememberQueuedRequest(request);
      if (cancelled || document.hidden) return;
      if (refreshTrailingTimer !== null) {
        window.clearTimeout(refreshTrailingTimer);
        refreshTrailingTimer = null;
      }
      if (syncRefreshTimer.current !== null) window.clearTimeout(syncRefreshTimer.current);
      syncRefreshTimer.current = window.setTimeout(() => {
        syncRefreshTimer.current = null;
        const queuedRevision = refreshQueuedRevision;
        refreshQueuedRevision = null;
        const queuedRequest = { refreshDates: refreshQueuedDates, includeHistory: refreshQueuedHistory };
        refreshQueuedDates = false;
        refreshQueuedHistory = false;
        void refreshFromCloud(queuedRevision, queuedRequest).catch(() => {
          if (!cancelled) reportSyncStatus("Retrying…");
        });
      }, SYNC_REFRESH_DEBOUNCE_MS);
    };

    const channel = supabase
      .channel(`track-sync-${user.id}`, { config: { private: true } })
      .on("broadcast", { event: "workout-updated" }, ({ payload }) => {
        if (payload?.source !== syncClientId.current) {
          const eventRevision = parsedSyncRevision(payload?.revision);
          if (eventRevision !== null && eventRevision <= remoteRevision.current) return;
          queueRefresh(eventRevision);
        }
      })
      .on("broadcast", { event: "workout-finished" }, ({ payload }) => {
        if (payload?.source === syncClientId.current) return;
        const dateKey = isStringValue(payload?.dateKey) ? payload.dateKey : "";
        if (!dateKey) return;
        const splitId = isStringValue(payload?.splitId) ? payload.splitId : "";
        if (splitId)
          setSavedSplits((current) => {
            const next = new Set(current);
            next.add(splitId);
            return next;
          });
        markWorkoutDate(dateKey);
        queueRefresh(null, { refreshDates: true, includeHistory: true });
      })
      .on("broadcast", { event: "workout-delete-pending" }, ({ payload }) => {
        if (payload?.source === syncClientId.current) return;
        const dateKey = isStringValue(payload?.dateKey) ? payload.dateKey : "";
        if (dateKey) removeWorkoutDate(dateKey);
      })
      .on("broadcast", { event: "workout-restored" }, ({ payload }) => {
        if (payload?.source === syncClientId.current) return;
        const dateKey = isStringValue(payload?.dateKey) ? payload.dateKey : "";
        if (!dateKey) return;
        restoreWorkoutDate(dateKey);
        queueRefresh(null, { refreshDates: true, includeHistory: true });
      })
      .on("broadcast", { event: "workout-deleted" }, ({ payload }) => {
        if (payload?.source === syncClientId.current) return;
        const dateKey = isStringValue(payload?.dateKey) ? payload.dateKey : "";
        if (!dateKey) return;
        removeWorkoutDate(dateKey, true);
        queueRefresh(null, { refreshDates: true, includeHistory: true });
      })
      .on("broadcast", { event: "preferences-updated" }, ({ payload }) => {
        if (payload?.source === syncClientId.current) return;
        const incomingPreferences = normalizePreferences(payload?.preferences);
        if (incomingPreferences) applyIncomingPreferences(incomingPreferences);
      })
      .on("broadcast", { event: "rank-equipment-overrides" }, ({ payload }) => {
        if (payload?.source === syncClientId.current) return;
        const overrides = parsedRankEquipmentOverrides(payload?.overrides);
        setRankEquipmentOverrides(overrides);
        setUser((current) =>
          current
            ? { ...current, user_metadata: { ...current.user_metadata, rank_equipment_overrides: overrides } }
            : current,
        );
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "splits", filter: `user_id=eq.${user.id}` }, () =>
        queueRefresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "exercises", filter: `user_id=eq.${user.id}` },
        () => queueRefresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "exercise_sets", filter: `user_id=eq.${user.id}` },
        () => queueRefresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workout_set_logs", filter: `user_id=eq.${user.id}` },
        () => {
          setRankHistoryVersion((version) => version + 1);
          queueRefresh(null, { refreshDates: true, includeHistory: true });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workout_sessions", filter: `user_id=eq.${user.id}` },
        () => queueRefresh(null, { refreshDates: true, includeHistory: true }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workout_notes", filter: `user_id=eq.${user.id}` },
        () => undefined,
      )
      .subscribe((status) => {
        syncRealtimeConnected.current = status === "SUBSCRIBED";
        if (status !== "SUBSCRIBED" && !document.hidden)
          queueRefresh(null, { refreshDates: true, includeHistory: true });
      });

    syncChannelRef.current = channel;
    const poll = window.setInterval(() => {
      if (!document.hidden && !syncRealtimeConnected.current)
        queueRefresh(null, { refreshDates: true, includeHistory: true });
    }, SYNC_FALLBACK_POLL_MS);
    const resume = () => {
      if (!document.hidden) queueRefresh(null, { refreshDates: true, includeHistory: true });
    };
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    window.addEventListener("pageshow", resume);
    document.addEventListener("visibilitychange", resume);

    return () => {
      cancelled = true;
      syncReadRevision.current += 1;
      if (syncRefreshTimer.current !== null) window.clearTimeout(syncRefreshTimer.current);
      if (refreshTrailingTimer !== null) window.clearTimeout(refreshTrailingTimer);
      refreshQueuedRevision = null;
      refreshQueuedDates = false;
      refreshQueuedHistory = false;
      window.clearInterval(poll);
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
      window.removeEventListener("pageshow", resume);
      document.removeEventListener("visibilitychange", resume);
      syncRealtimeConnected.current = false;
      syncChannelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [
    applyIncomingPreferences,
    applySavedTodayMarkersRef,
    applyWorkoutDates,
    cloudReady,
    ensureSyncClientId,
    markWorkoutDate,
    preferencesRef,
    readWorkoutDates,
    removeWorkoutDate,
    reportSyncStatus,
    restoreWorkoutDate,
    setActiveId,
    setLists,
    setRankEquipmentOverrides,
    setRankHistoryVersion,
    setSavedSplits,
    setUser,
    syncChannelRef,
    syncClientId,
    syncReadRevision,
    syncedListsRef,
    syncedSignatureRef,
    syncRealtimeConnected,
    syncRefreshTimer,
    user,
    workoutFinishEpoch,
    workoutFinishInFlight,
    cloudWriteInProgress,
    listsRef,
    localChangesPending,
    remoteRevision,
    writeSnapshot,
  ]);
}
