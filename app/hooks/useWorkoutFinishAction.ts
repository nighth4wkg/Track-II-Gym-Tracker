import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { User } from "@supabase/supabase-js";
import { saveWorkoutSession } from "../data/trackApi";
import { calendarDateKey } from "../calendarTypes";
import { haptic } from "../haptics";
import { TRACK_TIMING, TRACK_UI_COPY } from "../trackConstants";
import type { Checklist, Filter, Task, WorkoutSaveResult } from "../trackTypes";
import { accountStorageKey, safeStorageSet, workoutValueSignature } from "../trackUtils";
import type { WorkoutTaskUpdater } from "./useWorkoutState";

type WorkoutFinishedPayload = { dateKey: string; splitId: string };

type UseWorkoutFinishActionOptions = {
  active?: Checklist;
  user: User | null;
  accountLocalReadyFor: string | null;
  savedSplitsRef: MutableRefObject<Set<string>>;
  finishedSignaturesRef: MutableRefObject<Record<string, string>>;
  finishedDatesRef: MutableRefObject<Record<string, string>>;
  workoutFinishInFlightRef: MutableRefObject<boolean>;
  setSavedSplits: Dispatch<SetStateAction<Set<string>>>;
  setDirtySplits: Dispatch<SetStateAction<Set<string>>>;
  setFinishedSignatures: Dispatch<SetStateAction<Record<string, string>>>;
  setFinishedDates: Dispatch<SetStateAction<Record<string, string>>>;
  setProgressFading: Dispatch<SetStateAction<boolean>>;
  setSyncLabel: Dispatch<SetStateAction<string>>;
  setFilter: Dispatch<SetStateAction<Filter>>;
  setWorkoutActionsExiting: Dispatch<SetStateAction<boolean>>;
  updateTasks: WorkoutTaskUpdater;
  invalidateCloudReads: () => void;
  markWorkoutDate: (dateKey: string) => void;
  broadcastWorkoutFinished: (payload: WorkoutFinishedPayload) => void;
};

export function useWorkoutFinishAction({
  active,
  user,
  accountLocalReadyFor,
  savedSplitsRef,
  finishedSignaturesRef,
  finishedDatesRef,
  workoutFinishInFlightRef,
  setSavedSplits,
  setDirtySplits,
  setFinishedSignatures,
  setFinishedDates,
  setProgressFading,
  setSyncLabel,
  setFilter,
  setWorkoutActionsExiting,
  updateTasks,
  invalidateCloudReads,
  markWorkoutDate,
  broadcastWorkoutFinished,
}: UseWorkoutFinishActionOptions) {
  const transitionTimerRef = useRef<number | null>(null);
  const savedTimerRef = useRef<number | null>(null);
  const finishGenerationRef = useRef(0);

  const cancelPendingFinish = useCallback(() => {
    finishGenerationRef.current += 1;
    if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current);
    if (savedTimerRef.current !== null) window.clearTimeout(savedTimerRef.current);
    transitionTimerRef.current = null;
    savedTimerRef.current = null;
    workoutFinishInFlightRef.current = false;
  }, [workoutFinishInFlightRef]);

  useEffect(() => cancelPendingFinish, [active?.id, cancelPendingFinish, user?.id]);

  return useCallback(async () => {
    if (workoutFinishInFlightRef.current || !active) return;
    const finishGeneration = finishGenerationRef.current + 1;
    finishGenerationRef.current = finishGeneration;
    workoutFinishInFlightRef.current = true;
    // Invalidate every refresh that was started before this save. Those reads
    // can legitimately contain the previous day's session set.
    invalidateCloudReads();
    setProgressFading(true);
    haptic([24, 45, 36]);
    const workoutDate = calendarDateKey(new Date());
    let workoutSavedOnline = false;
    const finishedSplitId = active.id;
    const finishedValueSignature = workoutValueSignature(active);
    if (user) {
      const logs = active.tasks.flatMap((task) =>
        (task.sets ?? []).map((set, index) => ({
          exerciseId: task.id,
          exerciseName: task.text,
          setNumber: index + 1,
          weight: Number(set.weight) || 0,
          unit: set.unit,
          reps: Number(set.reps) || 0,
          rir: Number(set.rir) || 0,
        })),
      );
      let result: WorkoutSaveResult;
      try {
        result = await saveWorkoutSession(active.id, active.title, logs, crypto.randomUUID());
      } catch (error) {
        result = { ok: false, message: error instanceof Error ? error.message : "The workout could not be saved." };
      }
      if (finishGeneration !== finishGenerationRef.current) return;
      if (!result.ok) {
        setProgressFading(false);
        setSyncLabel(TRACK_UI_COPY.status.retry);
        workoutFinishInFlightRef.current = false;
        return;
      }
      workoutSavedOnline = true;
    }
    // A successful save wins over any stale cloud read that is still in
    // flight. Keep both the state and ref in sync synchronously.
    invalidateCloudReads();
    const nextSaved = new Set(savedSplitsRef.current);
    nextSaved.add(finishedSplitId);
    savedSplitsRef.current = nextSaved;
    // Commit the local guard immediately, before the reset animation. This
    // prevents an update/reload during the animation from showing Finish
    // workout again while the session is already saved in the cloud.
    setSavedSplits(nextSaved);
    setDirtySplits((current) => {
      if (!current.has(finishedSplitId)) return current;
      const next = new Set(current);
      next.delete(finishedSplitId);
      return next;
    });
    const nextSignatures = { ...finishedSignaturesRef.current, [finishedSplitId]: finishedValueSignature };
    finishedSignaturesRef.current = nextSignatures;
    setFinishedSignatures(nextSignatures);
    const nextFinishedDates = { ...finishedDatesRef.current, [finishedSplitId]: workoutDate };
    finishedDatesRef.current = nextFinishedDates;
    setFinishedDates(nextFinishedDates);
    if (user?.id && accountLocalReadyFor === user.id)
      safeStorageSet(accountStorageKey(user.id, "saved-splits"), JSON.stringify([...nextSaved]));
    markWorkoutDate(workoutDate);
    if (workoutSavedOnline) broadcastWorkoutFinished({ dateKey: workoutDate, splitId: finishedSplitId });
    transitionTimerRef.current = window.setTimeout(() => {
      transitionTimerRef.current = null;
      if (finishGeneration !== finishGenerationRef.current) return;
      updateTasks(
        (current) =>
          current.map((task: Task) => {
            const currentReps = Number(task.reps);
            const currentWeight = Number(task.weight);
            const sets = (task.sets ?? []).map((set) => ({
              ...set,
              lastReps: Number.isFinite(Number(set.reps)) ? Number(set.reps) : set.lastReps,
              lastWeight: Number.isFinite(Number(set.weight)) ? Number(set.weight) : set.lastWeight,
              lastWeightUnit: Number.isFinite(Number(set.weight)) ? set.unit : set.lastWeightUnit,
              lastRir: Number.isFinite(Number(set.rir)) ? Number(set.rir) : set.lastRir,
            }));
            return {
              ...task,
              sets,
              lastReps: Number.isFinite(currentReps) ? currentReps : task.lastReps,
              lastWeight: Number.isFinite(currentWeight) ? currentWeight : task.lastWeight,
              lastWeightUnit: Number.isFinite(currentWeight) ? task.sets?.[0]?.unit : task.lastWeightUnit,
              done: false,
              collapsed: false,
            };
          }),
        false,
      );
      setFilter("all");
      setProgressFading(false);
      setWorkoutActionsExiting(true);
      savedTimerRef.current = window.setTimeout(() => {
        savedTimerRef.current = null;
        if (finishGeneration !== finishGenerationRef.current) return;
        setSavedSplits((current) => {
          const next = new Set(current);
          next.add(finishedSplitId);
          savedSplitsRef.current = next;
          return next;
        });
        setWorkoutActionsExiting(false);
        workoutFinishInFlightRef.current = false;
      }, TRACK_TIMING.workoutFinishSavedDelayMs);
    }, TRACK_TIMING.workoutFinishTransitionMs);
  }, [
    accountLocalReadyFor,
    active,
    broadcastWorkoutFinished,
    finishedDatesRef,
    finishedSignaturesRef,
    invalidateCloudReads,
    markWorkoutDate,
    savedSplitsRef,
    setDirtySplits,
    setFilter,
    setFinishedDates,
    setFinishedSignatures,
    setProgressFading,
    setSavedSplits,
    setSyncLabel,
    setWorkoutActionsExiting,
    updateTasks,
    user,
    workoutFinishInFlightRef,
  ]);
}
