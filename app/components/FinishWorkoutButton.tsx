"use client";

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
  const stateClass = progressFading ? "is-saving" : workoutActionsExiting ? "is-saved" : "";
  const label = progressFading
    ? TRACK_UI_COPY.status.saving
    : workoutActionsExiting
      ? "Saved ✓"
      : completionEnabled && openCount === 0
        ? "Save"
        : "Finish";

  return (
    <button
      type="button"
      className={`ui-button ui-button-primary finish-button ${stateClass}${className ? ` ${className}` : ""}`}
      onClick={() => void onFinishWorkout()}
      disabled={progressFading || workoutActionsExiting}
      aria-label={label}
    >
      {label}
    </button>
  );
}
