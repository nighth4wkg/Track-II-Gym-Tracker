import { useEffect } from "react";
import { haptic } from "../haptics";
import { TRACK_TIMING } from "../trackConstants";
import {
  cancelRestCompletionNotification,
  nativeLocalNotificationsAvailable,
  scheduleRestCompletionNotification,
  showSystemNotification,
} from "../notifications";
import { publishTrackNotification as publishCenterNotification } from "../notificationCenter";
import type { UseTrackAppLifecycleOptions } from "./trackLifecycleTypes";

export function useTrackTimerLifecycle({ timer, markTimerChanged, refs, user }: UseTrackAppLifecycleOptions) {
  const { timerMode, timerRunning, setRestRemaining, setTimerElapsed, setTimerRunning } = timer;
  const { timerStartedAt: timerStartedAtRef, restEndsAt: restEndsAtRef } = refs;

  useEffect(() => {
    if (timerRunning && timerMode === "rest" && restEndsAtRef.current > Date.now()) {
      // The operating system owns this deadline, so it still fires while the
      // web view is suspended or the app is not on screen.
      void scheduleRestCompletionNotification(restEndsAtRef.current);
      return;
    }
    void cancelRestCompletionNotification();
  }, [restEndsAtRef, timerMode, timerRunning]);

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
        const completedAt = restEndsAtRef.current || Date.now();
        restEndsAtRef.current = 0;
        setTimerRunning(false);
        markTimerChanged();
        haptic([120, 80, 120]);
        publishCenterNotification(
          {
            id: `rest:${completedAt}`,
            kind: "rest",
            title: "Rest complete",
            message: "Time for your next set.",
            createdAt: completedAt,
          },
          user?.id,
        );
        if (!nativeLocalNotificationsAvailable()) {
          void showSystemNotification("Rest complete. Time for your next set.", `rest-complete-${Date.now()}`);
        }
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
    user?.id,
  ]);
}
