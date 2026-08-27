"use client";

import { useRef } from "react";
import { useModalFocus } from "../hooks/useModalFocus";
import type { WorkoutDraftNotice } from "../hooks/useWorkoutDraftRecovery";

type WorkoutDraftRecoveryModalProps = {
  notice: WorkoutDraftNotice;
  onContinue: () => void;
  onDiscard: () => void;
};

function recoveredTime(updatedAt: number) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(updatedAt));
}

export function WorkoutDraftRecoveryModal({ notice, onContinue, onDiscard }: WorkoutDraftRecoveryModalProps) {
  const cardRef = useRef<HTMLElement>(null);
  useModalFocus({ open: true, containerRef: cardRef });
  const { draft } = notice;
  return (
    <div className="exercise-confirm-backdrop workout-draft-backdrop">
      <section
        ref={cardRef}
        className="exercise-confirm workout-draft-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workout-draft-title"
      >
        <div className="exercise-confirm-mark" aria-hidden="true">
          <span className="dumbbell-icon" />
        </div>
        <span className="settings-kicker">WORKOUT RECOVERY</span>
        <h2 id="workout-draft-title">Continue {draft.splitTitle}?</h2>
        <p>
          Your unfinished sets were restored from {recoveredTime(draft.updatedAt)}. Continue where you stopped or return
          this split to its previous values.
        </p>
        <div className="exercise-confirm-actions workout-draft-actions">
          <button className="exercise-confirm-yes" type="button" onClick={onContinue} autoFocus>
            Continue workout
          </button>
          <button className="exercise-confirm-no" type="button" onClick={onDiscard}>
            Discard draft
          </button>
        </div>
      </section>
    </div>
  );
}
