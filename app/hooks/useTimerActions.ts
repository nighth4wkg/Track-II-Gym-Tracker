"use client";

import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { RestTimerSelection, TimerMode } from "../components/TimerScreen";
import { haptic } from "../haptics";
import { MOBILE_SIDEBAR_GESTURE_EDGE } from "../trackConstants";
import { restMinutesInputFromSeconds, restSecondsFromMinutes } from "../trackUtils";

type TimerSwipeStart = {
  x: number;
  y: number;
  pointerType: "touch" | "mouse" | "pen";
};

type TimerActionsOptions = {
  timerMode: TimerMode;
  timerRunning: boolean;
  timerElapsed: number;
  restSeconds: number;
  restRemaining: number;
  restCustom: boolean;
  timerStartedAtRef: { current: number };
  restEndsAtRef: { current: number };
  timerSwipeStartRef: { current: TimerSwipeStart | null };
  setTimerMode: Dispatch<SetStateAction<TimerMode>>;
  setTimerRunning: Dispatch<SetStateAction<boolean>>;
  setTimerElapsed: Dispatch<SetStateAction<number>>;
  setRestSeconds: Dispatch<SetStateAction<number>>;
  setRestRemaining: Dispatch<SetStateAction<number>>;
  setRestCustom: Dispatch<SetStateAction<boolean>>;
  setCustomRestInput: Dispatch<SetStateAction<string>>;
  setTimerTransition: Dispatch<SetStateAction<"forward" | "backward">>;
  setTimerTransitionKey: Dispatch<SetStateAction<number>>;
  onTimerChanged?: () => void;
};

export function useTimerActions({
  timerMode,
  timerRunning,
  timerElapsed,
  restSeconds,
  restRemaining,
  restCustom,
  timerStartedAtRef,
  restEndsAtRef,
  timerSwipeStartRef,
  setTimerMode,
  setTimerRunning,
  setTimerElapsed,
  setRestSeconds,
  setRestRemaining,
  setRestCustom,
  setCustomRestInput,
  setTimerTransition,
  setTimerTransitionKey,
  onTimerChanged,
}: TimerActionsOptions) {
  const chooseTimerMode = useCallback(
    (mode: TimerMode) => {
      if (mode === timerMode) return;
      setTimerTransition(mode === "rest" ? "forward" : "backward");
      setTimerTransitionKey((key) => key + 1);
      timerStartedAtRef.current = 0;
      restEndsAtRef.current = 0;
      setTimerRunning(false);
      setTimerMode(mode);
      if (mode === "rest") setRestRemaining(restSeconds * 1000);
      onTimerChanged?.();
    },
    [
      onTimerChanged,
      restEndsAtRef,
      restSeconds,
      setRestRemaining,
      setTimerMode,
      setTimerRunning,
      setTimerTransition,
      setTimerTransitionKey,
      timerMode,
      timerStartedAtRef,
    ],
  );

  const toggleTimer = useCallback(() => {
    haptic(timerRunning ? 18 : 12);
    if (timerRunning) {
      if (timerMode === "stopwatch") {
        setTimerElapsed(timerStartedAtRef.current > 0 ? Date.now() - timerStartedAtRef.current : timerElapsed);
        timerStartedAtRef.current = 0;
      } else {
        setRestRemaining(Math.max(0, restEndsAtRef.current - Date.now()));
        restEndsAtRef.current = 0;
      }
      setTimerRunning(false);
      onTimerChanged?.();
      return;
    }
    if (timerMode === "stopwatch") {
      restEndsAtRef.current = 0;
      timerStartedAtRef.current = Date.now() - timerElapsed;
    } else {
      timerStartedAtRef.current = 0;
      const remaining = restRemaining > 0 ? restRemaining : restSeconds * 1000;
      setRestRemaining(remaining);
      restEndsAtRef.current = Date.now() + remaining;
    }
    setTimerRunning(true);
    onTimerChanged?.();
  }, [
    onTimerChanged,
    restRemaining,
    restSeconds,
    restEndsAtRef,
    setRestRemaining,
    setTimerElapsed,
    setTimerRunning,
    timerElapsed,
    timerMode,
    timerRunning,
    timerStartedAtRef,
  ]);

  const beginTimerSwipe = useCallback(
    (x: number, y: number, target: EventTarget | null, pointerType: TimerSwipeStart["pointerType"] = "touch") => {
      if (target instanceof HTMLElement && target.closest("button, input, textarea, select")) {
        timerSwipeStartRef.current = null;
        return;
      }
      // Reserve the left edge for opening the mobile sidebar. Away from the
      // edge, the timer keeps its normal Stopwatch/Rest horizontal gesture.
      if (pointerType === "touch" && x <= MOBILE_SIDEBAR_GESTURE_EDGE) {
        timerSwipeStartRef.current = null;
        return;
      }
      timerSwipeStartRef.current = { x, y, pointerType };
    },
    [timerSwipeStartRef],
  );

  const finishTimerSwipe = useCallback(
    (x: number, y: number) => {
      const start = timerSwipeStartRef.current;
      timerSwipeStartRef.current = null;
      if (!start) return;
      const deltaX = x - start.x;
      const deltaY = Math.abs(y - start.y);
      const isMouse = start.pointerType === "mouse";
      const minimumDistance = isMouse ? 42 : 72;
      const directionRatio = isMouse ? 1.08 : 1.35;
      if (Math.abs(deltaX) < minimumDistance || Math.abs(deltaX) < deltaY * directionRatio) return;
      haptic(8);
      chooseTimerMode(deltaX < 0 ? "rest" : "stopwatch");
    },
    [chooseTimerMode, timerSwipeStartRef],
  );

  const startRestTimer = useCallback(
    (selection?: RestTimerSelection) => {
      haptic([16, 30, 16]);
      const nextSeconds = selection?.custom
        ? restSecondsFromMinutes(selection.input)
        : (selection?.seconds ?? restSeconds);
      const nextCustom = selection?.custom ?? restCustom;
      const duration = nextSeconds * 1000;
      // Keep the persisted runtime and the visible mode aligned even if a
      // delayed navigation render invoked this callback from a stale screen.
      setTimerMode("rest");
      timerStartedAtRef.current = 0;
      setRestSeconds(nextSeconds);
      setRestCustom(nextCustom);
      setCustomRestInput(restMinutesInputFromSeconds(nextSeconds));
      setRestRemaining(duration);
      restEndsAtRef.current = Date.now() + duration;
      setTimerRunning(true);
      onTimerChanged?.();
    },
    [
      onTimerChanged,
      restCustom,
      restEndsAtRef,
      restSeconds,
      setCustomRestInput,
      setRestCustom,
      setRestRemaining,
      setRestSeconds,
      setTimerMode,
      setTimerRunning,
      timerStartedAtRef,
    ],
  );

  return {
    toggleTimer,
    chooseTimerMode,
    beginTimerSwipe,
    finishTimerSwipe,
    startRestTimer,
    cancelTimerSwipe: () => {
      timerSwipeStartRef.current = null;
    },
  };
}
