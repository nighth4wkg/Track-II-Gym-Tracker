"use client";

import { useCallback, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import { fetchWorkoutDateKeys } from "../data/trackApi";
import { calendarDateKey, type WorkoutDateSyncEvent } from "../calendarTypes";
import { TRACK_TIMING } from "../trackConstants";
import type { TrackSyncEventName, TrackSyncEventPayload } from "./useTrackCloudSync";

type WorkoutDateSyncOptions = {
  userId: string | null | undefined;
  setWorkoutDates: Dispatch<SetStateAction<Set<string>>>;
  savedSplitsRef: RefObject<Set<string>>;
  finishedSignaturesRef: RefObject<Record<string, string>>;
  finishedDatesRef: RefObject<Record<string, string>>;
  setSavedSplits: Dispatch<SetStateAction<Set<string>>>;
  setFinishedSignatures: Dispatch<SetStateAction<Record<string, string>>>;
  setFinishedDates: Dispatch<SetStateAction<Record<string, string>>>;
  broadcastSyncEvent: (event: TrackSyncEventName, payload?: TrackSyncEventPayload) => void;
};

export function useWorkoutDateSync({
  userId,
  setWorkoutDates,
  savedSplitsRef,
  finishedSignaturesRef,
  finishedDatesRef,
  setSavedSplits,
  setFinishedSignatures,
  setFinishedDates,
  broadcastSyncEvent,
}: WorkoutDateSyncOptions) {
  const optimisticDates = useRef<Set<string>>(new Set());
  const optimisticDateTimers = useRef<Map<string, number>>(new Map());
  const tombstones = useRef<Set<string>>(new Set());
  const readRevision = useRef(0);

  const applyWorkoutDates = useCallback(
    (serverDates: Set<string>) => {
      const pending = optimisticDates.current;
      const unresolvedDeletes = tombstones.current;
      for (const key of [...unresolvedDeletes]) {
        if (!serverDates.has(key)) unresolvedDeletes.delete(key);
      }
      for (const key of [...pending]) {
        if (!serverDates.has(key)) continue;
        pending.delete(key);
        const timer = optimisticDateTimers.current.get(key);
        if (timer !== undefined) window.clearTimeout(timer);
        optimisticDateTimers.current.delete(key);
      }
      const merged = new Set([...serverDates].filter((key) => !unresolvedDeletes.has(key)));
      pending.forEach((key) => {
        if (!unresolvedDeletes.has(key)) merged.add(key);
      });
      setWorkoutDates(merged);
    },
    [setWorkoutDates],
  );

  const readWorkoutDates = useCallback(async (nextUserId: string) => {
    const currentRevision = ++readRevision.current;
    const dates = await fetchWorkoutDateKeys(nextUserId);
    return dates && currentRevision === readRevision.current ? dates : null;
  }, []);

  const refreshWorkoutDates = useCallback(
    async (nextUserId: string) => {
      const dates = await readWorkoutDates(nextUserId);
      if (dates) applyWorkoutDates(dates);
      return dates;
    },
    [applyWorkoutDates, readWorkoutDates],
  );

  const markWorkoutDate = useCallback(
    (key: string) => {
      readRevision.current += 1;
      tombstones.current.delete(key);
      optimisticDates.current.add(key);
      setWorkoutDates((current) => new Set([...current, key]));
      const previousTimer = optimisticDateTimers.current.get(key);
      if (previousTimer !== undefined) window.clearTimeout(previousTimer);
      const timer = window.setTimeout(() => {
        optimisticDates.current.delete(key);
        optimisticDateTimers.current.delete(key);
        if (userId) void refreshWorkoutDates(userId);
      }, TRACK_TIMING.workoutDateOptimisticTimeoutMs);
      optimisticDateTimers.current.set(key, timer);
    },
    [refreshWorkoutDates, setWorkoutDates, userId],
  );

  const removeWorkoutDate = useCallback(
    (key: string, clearCompletion = false) => {
      readRevision.current += 1;
      tombstones.current.add(key);
      optimisticDates.current.delete(key);
      const timer = optimisticDateTimers.current.get(key);
      if (timer !== undefined) window.clearTimeout(timer);
      optimisticDateTimers.current.delete(key);
      setWorkoutDates((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });

      // Keep the local finish guard until the delete is authoritative. This
      // prevents a stale calendar read from restoring a green marker during an
      // undo/delete cycle.
      if (clearCompletion && key === calendarDateKey(new Date())) {
        const nextDates = { ...finishedDatesRef.current };
        const nextSignatures = { ...finishedSignaturesRef.current };
        const nextSaved = new Set(savedSplitsRef.current);
        let changed = false;
        for (const [splitId, finishedDate] of Object.entries(nextDates)) {
          if (finishedDate !== key) continue;
          delete nextDates[splitId];
          delete nextSignatures[splitId];
          nextSaved.delete(splitId);
          changed = true;
        }
        if (changed) {
          finishedDatesRef.current = nextDates;
          finishedSignaturesRef.current = nextSignatures;
          savedSplitsRef.current = nextSaved;
          setFinishedDates(nextDates);
          setFinishedSignatures(nextSignatures);
          setSavedSplits(nextSaved);
        }
      }
    },
    [
      finishedDatesRef,
      finishedSignaturesRef,
      savedSplitsRef,
      setFinishedDates,
      setFinishedSignatures,
      setSavedSplits,
      setWorkoutDates,
    ],
  );

  const restoreWorkoutDate = useCallback(
    (key: string) => {
      readRevision.current += 1;
      tombstones.current.delete(key);
      optimisticDates.current.delete(key);
      const timer = optimisticDateTimers.current.get(key);
      if (timer !== undefined) window.clearTimeout(timer);
      optimisticDateTimers.current.delete(key);
      setWorkoutDates((current) => new Set([...current, key]));
    },
    [setWorkoutDates],
  );

  const broadcastWorkoutDateEvent = useCallback(
    (event: WorkoutDateSyncEvent, dateKey: string) => {
      if (event === "workout-deleted") removeWorkoutDate(dateKey, true);
      broadcastSyncEvent(event, { dateKey });
    },
    [broadcastSyncEvent, removeWorkoutDate],
  );

  const resetWorkoutDateSync = useCallback(() => {
    readRevision.current += 1;
    optimisticDates.current.clear();
    tombstones.current.clear();
    for (const timer of optimisticDateTimers.current.values()) window.clearTimeout(timer);
    optimisticDateTimers.current.clear();
  }, []);

  return {
    applyWorkoutDates,
    readWorkoutDates,
    refreshWorkoutDates,
    markWorkoutDate,
    removeWorkoutDate,
    restoreWorkoutDate,
    broadcastWorkoutDateEvent,
    resetWorkoutDateSync,
    workoutDateReadRevision: readRevision,
  };
}
