import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type { TimerMode } from "../components/TimerScreen";
import type { TimerRuntimeState } from "../trackTypes";
import { TRACK_LIMITS } from "../trackConstants";
import { safeStorageSet } from "../trackUtils";

type UseTimerPersistenceOptions = {
  timerMode: TimerMode;
  timerRunning: boolean;
  timerElapsed: number;
  restRemaining: number;
  timerLaps: number[];
  timerStartedAtRef: MutableRefObject<number>;
  restEndsAtRef: MutableRefObject<number>;
  setTimerMode: Dispatch<SetStateAction<TimerMode>>;
  setTimerRunning: Dispatch<SetStateAction<boolean>>;
  setTimerElapsed: Dispatch<SetStateAction<number>>;
  setRestRemaining: Dispatch<SetStateAction<number>>;
  setTimerLaps: Dispatch<SetStateAction<number[]>>;
  setTimerRuntime: Dispatch<SetStateAction<TimerRuntimeState>>;
};

export function useTimerPersistence({
  timerMode,
  timerRunning,
  timerElapsed,
  restRemaining,
  timerLaps,
  timerStartedAtRef,
  restEndsAtRef,
  setTimerMode,
  setTimerRunning,
  setTimerElapsed,
  setRestRemaining,
  setTimerLaps,
  setTimerRuntime,
}: UseTimerPersistenceOptions) {
  const [timerPersistenceVersion, setTimerPersistenceVersion] = useState(0);
  const timerPersistenceInitialized = useRef(false);
  const timerStateRef = useRef({ timerMode, timerRunning, timerElapsed, restRemaining, timerLaps });

  useEffect(() => {
    timerStateRef.current = { timerMode, timerRunning, timerElapsed, restRemaining, timerLaps };
  }, [restRemaining, timerElapsed, timerLaps, timerMode, timerRunning]);

  const markTimerChanged = useCallback(() => {
    setTimerPersistenceVersion((version) => version + 1);
  }, []);

  const flushTimerRuntime = useCallback(() => {
    const { timerMode, timerRunning, timerElapsed, restRemaining, timerLaps } = timerStateRef.current;
    const now = Date.now();
    const elapsedMs =
      timerMode === "stopwatch" && timerRunning && timerStartedAtRef.current > 0
        ? Math.max(timerElapsed, now - timerStartedAtRef.current)
        : timerElapsed;
    const restRemainingMs =
      timerMode === "rest" && timerRunning && restEndsAtRef.current > 0
        ? Math.max(0, restEndsAtRef.current - now)
        : restRemaining;
    safeStorageSet(
      "track-timer-runtime",
      JSON.stringify({
        mode: timerMode,
        running: timerRunning,
        elapsedMs,
        startedAtMs: timerMode === "stopwatch" && timerRunning ? timerStartedAtRef.current || null : null,
        restRemainingMs,
        restEndsAtMs: timerMode === "rest" && timerRunning ? restEndsAtRef.current || null : null,
        laps: timerLaps.slice(-TRACK_LIMITS.maxTimerLaps),
        updatedAt: now,
      } satisfies TimerRuntimeState),
    );
  }, [restEndsAtRef, timerStartedAtRef]);

  const applyTimerRuntime = useCallback(
    (runtime: TimerRuntimeState) => {
      const mode = runtime.mode ?? timerMode;
      const now = Date.now();
      const stopwatchStartedAt =
        mode === "stopwatch" && runtime.running ? (runtime.startedAtMs ?? Math.max(1, now - runtime.elapsedMs)) : 0;
      const restEndAt =
        mode === "rest" && runtime.running
          ? (runtime.restEndsAtMs ?? (runtime.restRemainingMs > 0 ? now + runtime.restRemainingMs : 0))
          : 0;
      const running = runtime.running && (mode === "stopwatch" ? stopwatchStartedAt > 0 : restEndAt > now);
      const resolvedRuntime: TimerRuntimeState = {
        ...runtime,
        mode,
        running,
        startedAtMs: mode === "stopwatch" && running ? stopwatchStartedAt : null,
        restEndsAtMs: mode === "rest" && running ? restEndAt : null,
        restRemainingMs:
          mode === "rest" && running && restEndAt > 0 ? Math.max(0, restEndAt - now) : runtime.restRemainingMs,
      };
      timerStartedAtRef.current = mode === "stopwatch" ? stopwatchStartedAt : 0;
      restEndsAtRef.current = mode === "rest" ? restEndAt : 0;
      setTimerMode(mode);
      setTimerRunning(resolvedRuntime.running);
      setTimerElapsed(resolvedRuntime.elapsedMs);
      setRestRemaining(resolvedRuntime.restRemainingMs);
      setTimerLaps(resolvedRuntime.laps);
      setTimerRuntime(resolvedRuntime);
    },
    [
      restEndsAtRef,
      setRestRemaining,
      setTimerElapsed,
      setTimerLaps,
      setTimerMode,
      setTimerRunning,
      setTimerRuntime,
      timerMode,
      timerStartedAtRef,
    ],
  );

  useEffect(() => {
    if (!timerPersistenceInitialized.current) {
      timerPersistenceInitialized.current = true;
      return;
    }
    const { timerMode, timerRunning, timerElapsed, restRemaining, timerLaps } = timerStateRef.current;
    const now = Date.now();
    const elapsedMs =
      timerMode === "stopwatch" && timerRunning && timerStartedAtRef.current > 0
        ? Math.max(timerElapsed, now - timerStartedAtRef.current)
        : timerElapsed;
    const restRemainingMs =
      timerMode === "rest" && timerRunning && restEndsAtRef.current > 0
        ? Math.max(0, restEndsAtRef.current - now)
        : restRemaining;
    setTimerRuntime({
      mode: timerMode,
      running: timerRunning,
      elapsedMs,
      startedAtMs: timerMode === "stopwatch" && timerRunning ? timerStartedAtRef.current || null : null,
      restRemainingMs,
      restEndsAtMs: timerMode === "rest" && timerRunning ? restEndsAtRef.current || null : null,
      laps: timerLaps.slice(-TRACK_LIMITS.maxTimerLaps),
      updatedAt: now,
    });
  }, [restEndsAtRef, setTimerRuntime, timerStartedAtRef, timerPersistenceVersion]);

  useEffect(() => {
    const flushWhenHidden = () => {
      if (document.visibilityState === "hidden") flushTimerRuntime();
    };
    window.addEventListener("pagehide", flushTimerRuntime);
    document.addEventListener("visibilitychange", flushWhenHidden);
    return () => {
      window.removeEventListener("pagehide", flushTimerRuntime);
      document.removeEventListener("visibilitychange", flushWhenHidden);
    };
  }, [flushTimerRuntime]);

  return { markTimerChanged, applyTimerRuntime };
}
