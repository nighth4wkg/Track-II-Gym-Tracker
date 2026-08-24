"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { haptic } from "../haptics";
import { TRACK_UI_COPY } from "../trackConstants";

type FinishWorkoutButtonProps = {
  completionEnabled: boolean;
  openCount: number;
  progressFading: boolean;
  workoutActionsExiting: boolean;
  onFinishWorkout: () => Promise<void>;
  className?: string;
};

export function FinishWorkoutButton({
  completionEnabled,
  openCount,
  progressFading,
  workoutActionsExiting,
  onFinishWorkout,
  className = "",
}: FinishWorkoutButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const confirmTitleId = useId();
  const confirmDescriptionId = useId();
  const stateClass = progressFading ? "is-saving" : workoutActionsExiting ? "is-saved" : "";
  const label = progressFading
    ? TRACK_UI_COPY.status.saving
    : workoutActionsExiting
      ? "Saved ✓"
      : completionEnabled && openCount === 0
        ? "Save"
        : "Finish";

  const closeConfirmation = () => {
    setConfirmOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    if (!confirmOpen) return undefined;
    confirmButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeConfirmation();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [confirmOpen]);

  const finishConfirmation =
    confirmOpen && globalThis.document
      ? createPortal(
          <div
            className="exercise-confirm-backdrop finish-confirm-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeConfirmation();
            }}
          >
            <section
              className="exercise-confirm finish-confirm"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby={confirmTitleId}
              aria-describedby={confirmDescriptionId}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="exercise-confirm-mark">
                <span className="dumbbell-icon" />
              </div>
              <span className="settings-kicker">WORKOUT SESSION</span>
              <h2 id={confirmTitleId}>Finish this workout?</h2>
              <p id={confirmDescriptionId}>Your session will be saved to today&apos;s history.</p>
              <div className="exercise-confirm-actions finish-confirm-actions">
                <button type="button" className="finish-confirm-cancel" onClick={closeConfirmation}>
                  Keep logging
                </button>
                <button
                  type="button"
                  className="finish-confirm-submit"
                  ref={confirmButtonRef}
                  onClick={() => {
                    setConfirmOpen(false);
                    haptic([20, 35, 24]);
                    void onFinishWorkout();
                  }}
                >
                  Finish
                </button>
              </div>
            </section>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={`ui-button ui-button-primary finish-button ${stateClass}${className ? ` ${className}` : ""}`}
        onClick={() => {
          if (progressFading || workoutActionsExiting) return;
          haptic(6);
          setConfirmOpen(true);
        }}
        disabled={progressFading || workoutActionsExiting}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={confirmOpen}
      >
        {label}
      </button>
      {finishConfirmation}
    </>
  );
}
