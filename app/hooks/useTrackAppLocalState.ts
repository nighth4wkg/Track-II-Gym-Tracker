"use client";

import { useRef, useState } from "react";
import type { TimerMode } from "../components/TimerScreen";
import type { AiExercise, Checklist, TimerRuntimeState } from "../trackTypes";
import type { TrackSyncEventName, TrackSyncEventPayload } from "./useTrackCloudSync";

/**
 * Runtime-only state and refs used to connect the app's controllers.
 *
 * None of these values are persisted workout data. Keeping them together
 * makes the root component an orchestrator without changing the state shape
 * passed to cloud sync or the native shells.
 */
export function useTrackAppLocalState({
  timerMode,
  timerRuntime,
}: Pick<TrackRuntimeSeed, "timerMode" | "timerRuntime">) {
  const finishedSignaturesRef = useRef<Record<string, string>>({});
  const finishedDatesRef = useRef<Record<string, string>>({});
  const savedSplitsRef = useRef<Set<string>>(new Set());
  const timerStartedAt = useRef(timerMode === "stopwatch" ? (timerRuntime.startedAtMs ?? 0) : 0);
  const restEndsAt = useRef(timerMode === "rest" ? (timerRuntime.restEndsAtMs ?? 0) : 0);
  const timerSwipeStart = useRef<{ x: number; y: number; pointerType: "touch" | "mouse" | "pen" } | null>(null);
  const [exportBusy, setExportBusy] = useState<"csv" | "json" | null>(null);
  const [exportMessage, setExportMessage] = useState("");
  // The AI key stays in React memory only; it is never placed in local or
  // session storage and is cleared by the account action lifecycle.
  const [aiKey, setAiKey] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiExercises, setAiExercises] = useState<AiExercise[]>([]);
  const [ready, setReady] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const settingsCloseTimer = useRef<number | null>(null);
  const mobileOrientationRef = useRef<"portrait" | "landscape" | null>(null);
  const openPasswordResetRef = useRef<() => void>(() => undefined);
  const clearAccountClientStateRef = useRef<(userId?: string) => void>(() => undefined);
  const applySavedTodayMarkersRef = useRef<
    (savedToday: Set<string>, sourceLists: Checklist[], clearStaleDirty: boolean) => void
  >(() => undefined);
  const broadcastSyncEventRef = useRef<(event: TrackSyncEventName, payload?: TrackSyncEventPayload) => void>(
    () => undefined,
  );
  const invalidateCloudReadsRef = useRef<() => void>(() => undefined);
  const resetCloudSyncStateRef = useRef<() => void>(() => undefined);
  const cloudSaveInFlightRef = useRef<() => boolean>(() => false);
  const siteUpdateCheckRef = useRef<((manual?: boolean) => Promise<"update" | "current" | "error">) | null>(null);
  const latestAnnouncementId = useRef<string | null>(null);
  const announcementDragStart = useRef<number | null>(null);
  const activeUserIdRef = useRef<string | null>(null);
  const workoutFinishInFlight = useRef(false);
  const composerRef = useRef<HTMLFormElement>(null);
  const settingsTabsRef = useRef<HTMLDivElement>(null);
  const calendarInitializedFor = useRef("");

  return {
    activeUserIdRef,
    aiBusy,
    aiError,
    aiExercises,
    aiKey,
    announcementDragStart,
    applySavedTodayMarkersRef,
    broadcastSyncEventRef,
    calendarInitializedFor,
    clearAccountClientStateRef,
    cloudSaveInFlightRef,
    composerRef,
    exportBusy,
    exportMessage,
    finishedDatesRef,
    finishedSignaturesRef,
    inputRef,
    invalidateCloudReadsRef,
    latestAnnouncementId,
    mobileOrientationRef,
    openPasswordResetRef,
    ready,
    resetCloudSyncStateRef,
    restEndsAt,
    savedSplitsRef,
    setAiBusy,
    setAiError,
    setAiExercises,
    setAiKey,
    setExportBusy,
    setExportMessage,
    setReady,
    settingsCloseTimer,
    settingsTabsRef,
    siteUpdateCheckRef,
    timerStartedAt,
    timerSwipeStart,
    workoutFinishInFlight,
  };
}

type TrackRuntimeSeed = {
  timerMode: TimerMode;
  timerRuntime: TimerRuntimeState;
};
