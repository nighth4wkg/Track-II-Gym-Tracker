import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { TRACK_TIMING } from "../trackConstants";

type UseTrackSyncStatusOptions = {
  setSyncLabel: Dispatch<SetStateAction<string>>;
  setLastSuccessfulSyncAt: Dispatch<SetStateAction<number | null>>;
  isBusy: () => boolean;
};

/** Keeps transient sync feedback from racing itself after realtime refreshes. */
export function useTrackSyncStatus({ setSyncLabel, setLastSuccessfulSyncAt, isBusy }: UseTrackSyncStatusOptions) {
  const settleTimer = useRef<number | null>(null);
  const generation = useRef(0);
  const lastLabel = useRef("");

  const setStatus = useCallback(
    (label: string) => {
      // Realtime, fallback polling, and the save queue can all report the same
      // state in one render window. Do not repaint the status badge when the
      // visible value has not changed; this prevents the Saving/Saved loop from
      // looking like repeated work to the user.
      if (lastLabel.current === label) return;
      lastLabel.current = label;
      setSyncLabel(label);
      if (/^(saved|updated)$/i.test(label.trim())) setLastSuccessfulSyncAt(Date.now());
    },
    [setLastSuccessfulSyncAt, setSyncLabel],
  );

  const clearSyncStatusTimer = useCallback(() => {
    generation.current += 1;
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
    settleTimer.current = null;
  }, []);

  const showSyncStatus = useCallback(
    (label: string, settleToSaved = false) => {
      clearSyncStatusTimer();
      setStatus(label);
      if (!settleToSaved) return;
      const expectedGeneration = generation.current;
      settleTimer.current = window.setTimeout(() => {
        settleTimer.current = null;
        if (expectedGeneration === generation.current && !isBusy()) setStatus("Saved");
      }, TRACK_TIMING.syncSavedFeedbackMs);
    },
    [clearSyncStatusTimer, isBusy, setStatus],
  );

  useEffect(() => clearSyncStatusTimer, [clearSyncStatusTimer]);

  return { clearSyncStatusTimer, showSyncStatus };
}
