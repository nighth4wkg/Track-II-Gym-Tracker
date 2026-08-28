"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { REST_PRESETS, TRACK_INTERACTION, TRACK_TIMING } from "../trackConstants";
import { restMinutesInputFromSeconds, restSecondsFromMinutes } from "../trackUtils";
import { formatRestMinutes, formatStopwatch } from "../timerUtils";
import { TimerDisplayValue } from "./TimerDisplayValue";

export type TimerMode = "stopwatch" | "rest";
export type TimerTransition = "idle" | "forward" | "backward";
export type RestTimerSelection = { seconds: number; custom: boolean; input: string };

type TimerScreenProps = {
  mode: TimerMode;
  running: boolean;
  elapsed: number;
  restRemaining: number;
  restSeconds: number;
  restCustom: boolean;
  customRestInput: string;
  laps: number[];
  transition: TimerTransition;
  transitionKey: number;
  onBeginSwipe: (x: number, y: number, target: EventTarget | null, pointerType?: "touch" | "mouse" | "pen") => void;
  onFinishSwipe: (x: number, y: number) => void;
  onCancelSwipe: () => void;
  onChooseMode: (mode: TimerMode) => void;
  onToggle: () => void;
  onLapOrReset: () => void;
  onClearLaps: () => void;
  onStartRest: (selection?: RestTimerSelection) => void;
};

function restDraftFromProps(seconds: number, custom: boolean, input: string): RestTimerSelection {
  const nextInput = custom ? input : restMinutesInputFromSeconds(seconds);
  return { seconds: custom ? restSecondsFromMinutes(nextInput) : seconds, custom, input: nextInput };
}

export function TimerScreen({
  mode,
  running,
  elapsed,
  restRemaining,
  restSeconds,
  restCustom,
  customRestInput,
  laps,
  transition,
  transitionKey,
  onBeginSwipe,
  onFinishSwipe,
  onCancelSwipe,
  onChooseMode,
  onToggle,
  onLapOrReset,
  onClearLaps,
  onStartRest,
}: TimerScreenProps) {
  const [restDraft, setRestDraft] = useState<RestTimerSelection>(() =>
    restDraftFromProps(restSeconds, restCustom, customRestInput),
  );
  const [restDraftDirty, setRestDraftDirty] = useState(false);
  const [clearingLaps, setClearingLaps] = useState(false);
  const clearLapsTimerRef = useRef<number | null>(null);
  const renderedRestDraft = restDraftDirty ? restDraft : restDraftFromProps(restSeconds, restCustom, customRestInput);

  function chooseRestPreset(seconds: number) {
    setRestDraft({ seconds, custom: false, input: restMinutesInputFromSeconds(seconds) });
    setRestDraftDirty(true);
  }

  function enableCustomRest() {
    const currentDraft = renderedRestDraft;
    setRestDraft({
      seconds: currentDraft.custom ? restSecondsFromMinutes(currentDraft.input) : currentDraft.seconds,
      custom: true,
      input: currentDraft.custom ? currentDraft.input : restMinutesInputFromSeconds(currentDraft.seconds),
    });
    setRestDraftDirty(true);
  }

  function updateCustomRestInput(value: string) {
    const input = value
      .replace(/[^\d.]/g, "")
      .replace(/(\..*)\./g, "$1")
      .slice(0, TRACK_INTERACTION.maxCustomRestChars);
    setRestDraft({ seconds: restSecondsFromMinutes(input), custom: true, input });
    setRestDraftDirty(true);
  }

  function startRest() {
    const currentDraft = renderedRestDraft;
    const seconds = currentDraft.custom ? restSecondsFromMinutes(currentDraft.input) : currentDraft.seconds;
    onStartRest({ seconds, custom: currentDraft.custom, input: restMinutesInputFromSeconds(seconds) });
    setRestDraft({ seconds, custom: currentDraft.custom, input: restMinutesInputFromSeconds(seconds) });
    setRestDraftDirty(false);
  }

  function clearLapsWithMotion() {
    if (!laps.length || clearingLaps) return;
    if (globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      onClearLaps();
      return;
    }
    setClearingLaps(true);
    clearLapsTimerRef.current = window.setTimeout(() => {
      onClearLaps();
      setClearingLaps(false);
    }, TRACK_TIMING.lapClearAnimationMs);
  }

  useEffect(
    () => () => {
      if (clearLapsTimerRef.current !== null) window.clearTimeout(clearLapsTimerRef.current);
    },
    [],
  );

  function handleTouchStart(event: ReactTouchEvent<HTMLElement>) {
    if (event.touches.length === 1)
      onBeginSwipe(event.touches[0].clientX, event.touches[0].clientY, event.target, "touch");
  }

  function handleTouchEnd(event: ReactTouchEvent<HTMLElement>) {
    const touch = event.changedTouches[0];
    if (touch) onFinishSwipe(touch.clientX, touch.clientY);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerType === "touch") return;
    // Timer controls must keep their normal desktop click behavior. The
    // gesture surface sits on the whole screen, so never capture a pointer
    // that started on a button or form control.
    if (event.target instanceof HTMLElement && event.target.closest("button, input, textarea, select")) {
      onCancelSwipe();
      return;
    }
    onBeginSwipe(event.clientX, event.clientY, event.target, event.pointerType === "pen" ? "pen" : "mouse");
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* Pointer capture is optional. */
    }
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerType !== "touch") onFinishSwipe(event.clientX, event.clientY);
  }

  return (
    <section
      className={`timer-screen timer-mode-${mode}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={onCancelSwipe}
    >
      <div key={`timer-mode-${mode}-${transitionKey}`} className={`timer-mode-stage timer-transition-${transition}`}>
        <h1>{mode === "stopwatch" ? "Workout timer" : "Rest countdown"}</h1>
        <p>
          {mode === "stopwatch"
            ? "Track your full session and record laps."
            : `${formatRestMinutes(renderedRestDraft.seconds)} between sets. Swipe to switch modes.`}
        </p>
        <div className="timer-swipe-hint" aria-label="Timer mode">
          <button
            type="button"
            className={mode === "stopwatch" ? "selected" : ""}
            onClick={() => onChooseMode("stopwatch")}
          >
            Stopwatch
          </button>
          <i />
          <button type="button" className={mode === "rest" ? "selected" : ""} onClick={() => onChooseMode("rest")}>
            Rest timer
          </button>
        </div>
        <div
          className={`timer-display-wrap${mode === "rest" && restRemaining <= 10_000 && running ? " rest-ending" : ""}`}
        >
          <div
            className={`timer-display${running ? " running" : ""}${mode === "rest" && restRemaining <= 10_000 && running ? " rest-ending" : ""}`}
            aria-live={mode === "rest" ? "polite" : "off"}
          >
            <TimerDisplayValue mode={mode} running={running} elapsed={elapsed} restRemaining={restRemaining} />
          </div>
        </div>
        <div className="timer-controls">
          {mode === "stopwatch" ? (
            <>
              <button className="lap-button" onClick={onLapOrReset} disabled={elapsed === 0}>
                {running ? "Lap" : elapsed > 0 ? "Reset" : "Lap"}
              </button>
              <button className={running ? "stop-button" : "start-button"} onClick={onToggle}>
                {running ? "Stop" : "Start"}
              </button>
            </>
          ) : (
            <button className={running ? "stop-button" : "rest-button"} onClick={running ? onToggle : startRest}>
              {running ? "Stop" : "Start rest"}
            </button>
          )}
        </div>
        {mode === "stopwatch" ? (
          <div className="laps-panel">
            <div className="laps-heading">
              <h2>Laps</h2>
              <button onClick={clearLapsWithMotion} disabled={laps.length === 0 || clearingLaps}>
                {clearingLaps ? "Clearing…" : "Clear laps"}
              </button>
            </div>
            {laps.length === 0 ? (
              <div className="laps-empty">Your laps will appear here.</div>
            ) : (
              <ol className={clearingLaps ? "clearing" : ""}>
                {[...laps].reverse().map((lap, reversedIndex) => {
                  const originalIndex = laps.length - 1 - reversedIndex;
                  const previous = originalIndex === 0 ? 0 : laps[originalIndex - 1];
                  return (
                    <li
                      key={`${originalIndex}-${lap}`}
                      className={originalIndex === laps.length - 1 ? "is-new" : undefined}
                    >
                      <span>Lap {originalIndex + 1}</span>
                      <b>{formatStopwatch(lap - previous)}</b>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        ) : (
          <div className="timer-rest-settings">
            <div className="timer-rest-presets" aria-label="Rest duration presets">
              {REST_PRESETS.map(({ seconds, label }) => (
                <button
                  type="button"
                  key={seconds}
                  data-rest-selection="true"
                  className={!renderedRestDraft.custom && renderedRestDraft.seconds === seconds ? "selected" : ""}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => chooseRestPreset(seconds)}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                data-rest-selection="true"
                className={renderedRestDraft.custom ? "selected" : ""}
                onPointerDown={(event) => event.preventDefault()}
                onClick={enableCustomRest}
              >
                Custom
              </button>
            </div>
            {renderedRestDraft.custom && (
              <label className="timer-custom-rest">
                <span>Custom rest</span>
                <div>
                  <input
                    value={renderedRestDraft.input}
                    onChange={(event) => updateCustomRestInput(event.target.value)}
                    inputMode="decimal"
                    min="0.1"
                    max="60"
                    step="0.1"
                    placeholder="0.3"
                    aria-label="Custom rest time in minutes and seconds"
                  />
                  <small>0.3 = 30 sec</small>
                </div>
              </label>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
