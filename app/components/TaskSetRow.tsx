"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
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
  onRemoveSet: (setId: string) => void;
  onDeleteGestureRevealed: () => void;
};

export function TaskSetRow({
  task,
  set,
  index,
  onCompleteSetAndStartRest,
  onUpdateSet,
  onFinishSetWeightEdit,
  onBeginSetWeightEdit,
  onRemoveSet,
  onDeleteGestureRevealed,
}: TaskSetRowProps) {
  const deleteConfirmRef = useRef<HTMLDivElement>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement>(null);
  const swipeStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const swipeConsumedRef = useRef(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmPosition, setDeleteConfirmPosition] = useState<{ top: number; left: number } | null>(null);
  const [deleteSwipeOpen, setDeleteSwipeOpen] = useState(false);

  useEffect(() => {
    if (!deleteConfirmOpen) return undefined;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        (deleteConfirmRef.current?.contains(target) || deleteTriggerRef.current?.contains(target))
      )
        return;
      setDeleteConfirmOpen(false);
      setDeleteConfirmPosition(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDeleteConfirmOpen(false);
        setDeleteConfirmPosition(null);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer, true);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer, true);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [deleteConfirmOpen]);

  useEffect(() => {
    if (!deleteConfirmOpen) return undefined;
    const updateDeleteConfirmPosition = () => {
      const trigger = deleteTriggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const width = Math.min(248, window.innerWidth - 32);
      const maxLeft = Math.max(16, window.innerWidth - width - 16);
      const left = Math.min(Math.max(16, rect.right - width), maxLeft);
      const estimatedHeight = 126;
      const below = rect.bottom + 8;
      const top =
        below + estimatedHeight <= window.innerHeight - 16 ? below : Math.max(16, rect.top - estimatedHeight - 8);
      setDeleteConfirmPosition({ top, left });
    };
    updateDeleteConfirmPosition();
    window.addEventListener("resize", updateDeleteConfirmPosition);
    document.addEventListener("scroll", updateDeleteConfirmPosition, true);
    return () => {
      window.removeEventListener("resize", updateDeleteConfirmPosition);
      document.removeEventListener("scroll", updateDeleteConfirmPosition, true);
    };
  }, [deleteConfirmOpen]);

  const releaseSwipePointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleSetPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target;
    if (target instanceof HTMLElement && target.closest("button, a") && !target.closest(".set-complete-action")) return;
    swipeConsumedRef.current = false;
    swipeStartRef.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.stopPropagation();
  };

  const handleSetPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = swipeStartRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaY) > Math.abs(deltaX) + 8) {
      swipeStartRef.current = null;
      releaseSwipePointer(event);
      return;
    }
    if (deltaX <= -48) {
      event.preventDefault();
      event.stopPropagation();
      swipeConsumedRef.current = true;
      onDeleteGestureRevealed();
      setDeleteSwipeOpen(true);
      swipeStartRef.current = null;
      releaseSwipePointer(event);
    }
  };

  const handleSetPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = swipeStartRef.current;
    if (start?.pointerId === event.pointerId && deleteSwipeOpen && event.clientX - start.x >= 48) {
      setDeleteSwipeOpen(false);
    }
    swipeStartRef.current = null;
    releaseSwipePointer(event);
  };

  const handleSetPointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    swipeStartRef.current = null;
    releaseSwipePointer(event);
  };

  const progressionDelta = weightProgressionDelta(set);
  return (
    <div
      className={[set.completed ? "set-row has-completed-set" : "set-row", deleteSwipeOpen ? "is-delete-revealed" : ""]
        .filter(Boolean)
        .join(" ")}
      onPointerDown={handleSetPointerDown}
      onPointerMove={handleSetPointerMove}
      onPointerUp={handleSetPointerUp}
      onPointerCancel={handleSetPointerCancel}
    >
      <span className="set-number">{index + 1}</span>
      <span className="set-input weight-set-input">
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
          onClick={() => {
            if (swipeConsumedRef.current) {
              swipeConsumedRef.current = false;
              return;
            }
            onCompleteSetAndStartRest(set.id);
          }}
          aria-label={`${set.completed ? "Repeat" : "Complete"} set ${index + 1} and ${
            set.completed ? "restart" : "start"
          } rest timer for ${task.text}`}
          title={set.completed ? "Restart rest timer" : "Complete set and start rest"}
          aria-pressed={set.completed}
        >
          <span aria-hidden="true">✓</span>
        </button>
        <div className="set-delete-control" onPointerDown={(event) => event.stopPropagation()}>
          <button
            ref={deleteTriggerRef}
            type="button"
            className="ui-button ui-button-danger remove-set set-delete-trigger"
            onClick={() => {
              setDeleteSwipeOpen(true);
              if (deleteConfirmOpen) {
                setDeleteConfirmOpen(false);
                setDeleteConfirmPosition(null);
              } else {
                setDeleteConfirmPosition(null);
                setDeleteConfirmOpen(true);
              }
            }}
            disabled={(task.sets?.length ?? 0) <= 1}
            aria-expanded={deleteConfirmOpen}
            aria-haspopup="dialog"
            aria-label={`Delete ${task.text} set ${index + 1}`}
            title={(task.sets?.length ?? 0) <= 1 ? "At least one set is required" : "Delete set"}
          >
            <span aria-hidden="true">×</span>
          </button>
          {deleteConfirmOpen &&
            deleteConfirmPosition &&
            globalThis.document &&
            createPortal(
              <div
                ref={deleteConfirmRef}
                className="set-delete-confirm"
                role="dialog"
                aria-label={`Confirm deleting ${task.text} set ${index + 1}`}
                style={{ top: deleteConfirmPosition.top, left: deleteConfirmPosition.left }}
              >
                <div className="set-delete-confirm-copy">
                  <strong>Delete set {index + 1}?</strong>
                  <span>Its weight, reps, and RIR will be removed.</span>
                </div>
                <div className="set-delete-confirm-actions">
                  <button
                    type="button"
                    className="ui-button ui-button-quiet"
                    onClick={() => {
                      setDeleteConfirmOpen(false);
                      setDeleteConfirmPosition(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="ui-button ui-button-danger"
                    onClick={() => {
                      setDeleteConfirmOpen(false);
                      setDeleteConfirmPosition(null);
                      onRemoveSet(set.id);
                    }}
                  >
                    Delete set
                  </button>
                </div>
              </div>,
              document.body,
            )}
        </div>
      </div>
    </div>
  );
}
