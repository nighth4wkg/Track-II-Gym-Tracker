"use client";

import { useEffect, useRef, useState } from "react";
import { focusNextSetInput, type TaskCardSet, type TaskCardTask } from "../taskCardUtils";
import { weightProgressionDelta } from "../trackUtils";

type TaskSetRowProps = {
  task: TaskCardTask;
  set: TaskCardSet;
  index: number;
  onCompleteSetAndStartRest: (setId: string) => void;
  onUpdateSet: (setId: string, field: "weight" | "reps" | "rir", value: string) => void;
  onFinishSetWeightEdit: (set: TaskCardSet) => void;
  onBeginSetWeightEdit: (set: TaskCardSet, input: HTMLInputElement) => void;
  onToggleSetUnit: (setId: string) => void;
  onRemoveSet: (setId: string) => void;
};

export function TaskSetRow({
  task,
  set,
  index,
  onCompleteSetAndStartRest,
  onUpdateSet,
  onFinishSetWeightEdit,
  onBeginSetWeightEdit,
  onToggleSetUnit,
  onRemoveSet,
}: TaskSetRowProps) {
  const unitToggleTimer = useRef<number | null>(null);
  const [togglingUnit, setTogglingUnit] = useState(false);

  useEffect(
    () => () => {
      if (unitToggleTimer.current !== null) window.clearTimeout(unitToggleTimer.current);
    },
    [],
  );

  const toggleSetUnit = () => {
    onToggleSetUnit(set.id);
    setTogglingUnit(true);
    if (unitToggleTimer.current !== null) window.clearTimeout(unitToggleTimer.current);
    unitToggleTimer.current = window.setTimeout(() => {
      setTogglingUnit(false);
      unitToggleTimer.current = null;
    }, 280);
  };

  const progressionDelta = weightProgressionDelta(set);
  return (
    <div className={set.completed ? "set-row has-completed-set" : "set-row"}>
      <span className="set-number">{index + 1}</span>
      <span className="set-input weight-set-input" data-suffix={set.unit}>
        <input
          value={set.weight}
          onChange={(event) => onUpdateSet(set.id, "weight", event.target.value)}
          onBlur={() => onFinishSetWeightEdit(set)}
          onKeyDown={(event) => focusNextSetInput(event, "reps")}
          onFocus={(event) => onBeginSetWeightEdit(set, event.currentTarget)}
          inputMode="decimal"
          enterKeyHint="next"
          data-set-field="weight"
          aria-label={`${task.text} set ${index + 1} weight`}
        />
        <button
          type="button"
          className={togglingUnit ? "weight-unit-toggle is-toggling" : "weight-unit-toggle"}
          onClick={toggleSetUnit}
          aria-label={`Change weight unit for ${task.text} set ${index + 1}`}
        >
          {set.unit.toUpperCase()}
        </button>
        {progressionDelta !== null && (
          <em className={progressionDelta > 0 ? "rep-delta set-delta up" : "rep-delta set-delta down"}>
            {progressionDelta > 0 ? "+" : ""}
            {progressionDelta}
          </em>
        )}
      </span>
      <span className="set-input">
        <input
          value={set.reps}
          onChange={(event) => onUpdateSet(set.id, "reps", event.target.value)}
          onBlur={() => !set.reps && onUpdateSet(set.id, "reps", "1")}
          onKeyDown={(event) => focusNextSetInput(event, "rir")}
          onFocus={(event) => event.currentTarget.select()}
          inputMode="numeric"
          enterKeyHint="next"
          data-set-field="reps"
          aria-label={`${task.text} set ${index + 1} reps`}
        />
        {set.lastReps !== undefined && Number(set.reps) !== set.lastReps && (
          <em className={Number(set.reps) > set.lastReps ? "rep-delta set-delta up" : "rep-delta set-delta down"}>
            {Number(set.reps) > set.lastReps ? "+" : ""}
            {Number(set.reps) - set.lastReps}
          </em>
        )}
      </span>
      <span className="set-input">
        <input
          value={set.rir}
          onChange={(event) => onUpdateSet(set.id, "rir", event.target.value)}
          onBlur={() => set.rir === "" && onUpdateSet(set.id, "rir", "0")}
          onKeyDown={(event) => focusNextSetInput(event, null)}
          onFocus={(event) => event.currentTarget.select()}
          inputMode="numeric"
          enterKeyHint="done"
          data-set-field="rir"
          aria-label={`${task.text} set ${index + 1} RIR`}
        />
      </span>
      <div className="set-row-actions">
        <button
          type="button"
          className={
            set.completed
              ? "ui-button ui-button-quiet set-complete-action is-complete"
              : "ui-button ui-button-quiet set-complete-action"
          }
          onClick={() => onCompleteSetAndStartRest(set.id)}
          aria-label={`${set.completed ? "Repeat" : "Complete"} set ${index + 1} and ${
            set.completed ? "restart" : "start"
          } rest timer for ${task.text}`}
          title={set.completed ? "Restart rest timer" : "Complete set and start rest"}
        >
          {set.completed ? "✓" : "Done"}
        </button>
        <button
          type="button"
          className="remove-set"
          onClick={() => onRemoveSet(set.id)}
          disabled={(task.sets?.length ?? 0) <= 1}
          aria-label={`Remove set ${index + 1}`}
          title={`Remove set ${index + 1}`}
        >
          ×
        </button>
      </div>
    </div>
  );
}
