import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { calendarDateKey } from "../calendarTypes";
import type { Checklist } from "../trackTypes";
import { workoutValueSignature } from "../trackUtils";

type UseSavedWorkoutMarkersOptions = {
  savedSplitsRef: MutableRefObject<Set<string>>;
  finishedDatesRef: MutableRefObject<Record<string, string>>;
  finishedSignaturesRef: MutableRefObject<Record<string, string>>;
  setSavedSplits: Dispatch<SetStateAction<Set<string>>>;
  setDirtySplits: Dispatch<SetStateAction<Set<string>>>;
};

export function useSavedWorkoutMarkers({
  savedSplitsRef,
  finishedDatesRef,
  finishedSignaturesRef,
  setSavedSplits,
  setDirtySplits,
}: UseSavedWorkoutMarkersOptions) {
  return useCallback(
    (savedToday: Set<string>, sourceLists: Checklist[], clearStaleDirty: boolean) => {
      const listsById = new Map(sourceLists.map((list) => [list.id, list]));
      const todayKey = calendarDateKey(new Date());
      const nextSaved = new Set(savedToday);

      // A just-finished workout is optimistic until the next cloud read observes
      // its session. Keep that marker for the current day when the list still
      // matches the exact snapshot that was finished. This closes the small
      // read-after-write window where an older empty query used to bring the
      // Finish workout button back.
      for (const [splitId, finishedDate] of Object.entries(finishedDatesRef.current)) {
        if (finishedDate !== todayKey || !savedSplitsRef.current.has(splitId)) continue;
        const list = listsById.get(splitId);
        const finishedSignature = finishedSignaturesRef.current[splitId];
        if (list && finishedSignature && finishedSignature === workoutValueSignature(list)) nextSaved.add(splitId);
      }

      const candidateIds = new Set([...savedToday, ...nextSaved]);
      if (!clearStaleDirty) {
        savedSplitsRef.current = nextSaved;
        setSavedSplits(nextSaved);
        return;
      }
      setDirtySplits((current) => {
        let changed = false;
        const next = new Set(current);
        for (const splitId of candidateIds) {
          const list = listsById.get(splitId);
          if (!list) continue;
          const currentSignature = workoutValueSignature(list);
          const finishedSignature = finishedSignaturesRef.current[splitId];
          if (finishedSignature && finishedSignature !== currentSignature) {
            nextSaved.delete(splitId);
            if (!next.has(splitId)) {
              next.add(splitId);
              changed = true;
            }
          } else {
            // A marker from an older browser session is not evidence of a new
            // edit. A server-confirmed session or a matching finished snapshot
            // means this split is clean again.
            changed = next.delete(splitId) || changed;
          }
        }
        return changed ? next : current;
      });
      savedSplitsRef.current = nextSaved;
      setSavedSplits(nextSaved);
    },
    [finishedDatesRef, finishedSignaturesRef, savedSplitsRef, setDirtySplits, setSavedSplits],
  );
}
