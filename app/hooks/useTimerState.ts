"use client";

import { useEffect, useState } from "react";
import type { TimerMode } from "../components/TimerScreen";
import { REST_PRESET_SECONDS, TRACK_LIMITS } from "../trackConstants";
import type { JsonValue, TimerRuntimeState } from "../trackTypes";
import { normalizeTimerRuntime, safeStorageGet, safeStorageSet } from "../trackUtils";

const DEFAULT_TIMER_RUNTIME: TimerRuntimeState = {
  mode: "stopwatch",
  running: false,
  elapsedMs: 0,
  startedAtMs: null,
  restRemainingMs: TRACK_LIMITS.defaultRestSeconds * 1000,
  restEndsAtMs: null,
  laps: [],
  updatedAt: 0,
};

function readStoredTimerRuntime(): TimerRuntimeState {
  const stored = safeStorageGet("track-timer-runtime");
  if (!stored) return DEFAULT_TIMER_RUNTIME;
  try {
    const parsed: JsonValue = JSON.parse(stored);
    return normalizeTimerRuntime(parsed) ?? DEFAULT_TIMER_RUNTIME;
  } catch {
    return DEFAULT_TIMER_RUNTIME;
  }
}

export function useTimerState() {
  const initialRuntime = readStoredTimerRuntime();
  const [timerMode, setTimerMode] = useState<TimerMode>(
    () => initialRuntime.mode ?? (safeStorageGet("track-timer-mode") === "rest" ? "rest" : "stopwatch"),
  );
  const [restSeconds, setRestSeconds] = useState(() => {
    if (!globalThis.window) return TRACK_LIMITS.defaultRestSeconds;
    const saved = Number(safeStorageGet("track-rest-seconds"));
    return Number.isFinite(saved) && saved >= 1 && saved <= TRACK_LIMITS.maxRestSeconds
      ? saved
      : TRACK_LIMITS.defaultRestSeconds;
  });
  const [restCustom, setRestCustom] = useState(() => safeStorageGet("track-rest-custom") === "true");
  const [customRestInput, setCustomRestInput] = useState(() => {
    if (!globalThis.window) return "1.5";
    const saved = Number(safeStorageGet("track-rest-seconds"));
    return String(
      Number.isFinite(saved) &&
        saved >= 1 &&
        saved <= TRACK_LIMITS.maxRestSeconds &&
        !REST_PRESET_SECONDS.includes(saved)
        ? Number((saved / 60).toFixed(2))
        : 1.5,
    );
  });
  const [timerRunning, setTimerRunning] = useState(initialRuntime.running);
  const [timerElapsed, setTimerElapsed] = useState(initialRuntime.elapsedMs);
  const [restRemaining, setRestRemaining] = useState(initialRuntime.restRemainingMs);
  const [timerLaps, setTimerLaps] = useState<number[]>(initialRuntime.laps);
  const [timerRuntime, setTimerRuntime] = useState<TimerRuntimeState>(initialRuntime);
  const [timerTransition, setTimerTransition] = useState<"forward" | "backward">("forward");
  const [timerTransitionKey, setTimerTransitionKey] = useState(0);

  useEffect(() => {
    if (timerRuntime.updatedAt > 0) safeStorageSet("track-timer-runtime", JSON.stringify(timerRuntime));
  }, [timerRuntime]);

  return {
    timerMode,
    setTimerMode,
    restSeconds,
    setRestSeconds,
    restCustom,
    setRestCustom,
    customRestInput,
    setCustomRestInput,
    timerRunning,
    setTimerRunning,
    timerElapsed,
    setTimerElapsed,
    restRemaining,
    setRestRemaining,
    timerLaps,
    setTimerLaps,
    timerRuntime,
    setTimerRuntime,
    timerTransition,
    setTimerTransition,
    timerTransitionKey,
    setTimerTransitionKey,
  };
}

export type TimerState = ReturnType<typeof useTimerState>;
