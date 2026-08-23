import { useEffect } from "react";
import { haptic } from "../haptics";
import { TRACK_TIMING } from "../trackConstants";
import type { UseTrackAppLifecycleOptions } from "./trackLifecycleTypes";

export function useTrackTimerLifecycle({ timer, markTimerChanged, refs }: UseTrackAppLifecycleOptions) {
  const { timerMode, timerRunning, setRestRemaining, setTimerElapsed, setTimerRunning } = timer;
  const { timerStartedAt: timerStartedAtRef, restEndsAt: restEndsAtRef } = refs;

  useEffect(() => {
    if (!timerRunning) return;
    const tick = () => {
      if (timerMode === "stopwatch") {
        // A restored stopwatch must have a real start anchor. Never subtract
        // from zero: that would render the Unix epoch as millions of minutes
        // after a mode-switch/refresh race.
        if (timerStartedAtRef.current <= 0) {
          setTimerRunning(false);
          markTimerChanged();
          return;
        }
        setTimerElapsed(Date.now() - timerStartedAtRef.current);
        return;
      }
      if (restEndsAtRef.current <= 0) {
        setTimerRunning(false);
        markTimerChanged();
        return;
      }
      const remaining = Math.max(0, restEndsAtRef.current - Date.now());
      setRestRemaining(remaining);
      if (remaining === 0) {
        setTimerRunning(false);
        markTimerChanged();
        haptic([120, 80, 120]);
      }
    };
    tick();
    const interval = window.setInterval(
      tick,
      timerMode === "stopwatch" ? TRACK_TIMING.stopwatchTickMs : TRACK_TIMING.restTimerTickMs,
    );
    return () => window.clearInterval(interval);
  }, [
    markTimerChanged,
    restEndsAtRef,
    setRestRemaining,
    setTimerElapsed,
    setTimerRunning,
    timerMode,
    timerRunning,
    timerStartedAtRef,
  ]);
}
