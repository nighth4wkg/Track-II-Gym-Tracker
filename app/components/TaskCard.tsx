"use client";

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { createPortal } from "react-dom";
import { useConnectedTaskCard } from "../contexts/WorkoutEditorContext";
import { applyAnimatedStyles } from "../domMotion";
import { weightProgressionDelta } from "../trackUtils";

export type TaskCardSet = {
  id: string;
  weight: string;
  unit: "kg" | "lb";
  reps: string;
  rir: string;
  lastWeight?: number;
  lastWeightUnit?: "kg" | "lb";
  lastReps?: number;
  lastRir?: number;
};

export type TaskCardTask = {
  id: string;
  text: string;
  sets?: TaskCardSet[];
  done: boolean;
  collapsed?: boolean;
};

type TaskCardProps = {
  task: TaskCardTask;
  dragging: boolean;
  completionEnabled: boolean;
  editing: boolean;
  editValue: string;
  mobileExerciseMenu: boolean;
  onToggleCard: () => void;
  onEditValueChange: (value: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onToggleMenu: () => void;
  onStartEdit: () => void;
  onToggleDone: () => void;
  onDelete: () => void;
  onMove: () => void;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
  onTouchStart: (event: ReactTouchEvent<HTMLElement>) => void;
  onTouchMove: (event: ReactTouchEvent<HTMLElement>) => void;
  onTouchEnd: () => void;
  onTouchCancel: () => void;
  onUpdateSet: (setId: string, field: "weight" | "reps" | "rir", value: string) => void;
  onFinishSetWeightEdit: (set: TaskCardSet) => void;
  onBeginSetWeightEdit: (set: TaskCardSet, input: HTMLInputElement) => void;
  onToggleSetUnit: (setId: string) => void;
  onRemoveSet: (setId: string) => void;
  onAddSet: () => void;
};

function sameTask(left: TaskCardTask, right: TaskCardTask) {
  if (
    left.id !== right.id ||
    left.text !== right.text ||
    left.done !== right.done ||
    left.collapsed !== right.collapsed
  )
    return false;
  const leftSets = left.sets ?? [];
  const rightSets = right.sets ?? [];
  if (leftSets.length !== rightSets.length) return false;
  return leftSets.every((leftSet, index) => {
    const rightSet = rightSets[index];
    return (
      leftSet.id === rightSet.id &&
      leftSet.weight === rightSet.weight &&
      leftSet.unit === rightSet.unit &&
      leftSet.reps === rightSet.reps &&
      leftSet.rir === rightSet.rir &&
      leftSet.lastWeight === rightSet.lastWeight &&
      leftSet.lastWeightUnit === rightSet.lastWeightUnit &&
      leftSet.lastReps === rightSet.lastReps &&
      leftSet.lastRir === rightSet.lastRir
    );
  });
}

function summarizeValues(values: string[], suffix: string) {
  const numbers = values.map(Number).filter((value) => Number.isFinite(value));
  if (!numbers.length) return `— ${suffix}`;
  const minimum = Math.min(...numbers);
  const maximum = Math.max(...numbers);
  const format = (value: number) => (Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2))));
  return minimum === maximum ? `${format(minimum)} ${suffix}` : `${format(minimum)}–${format(maximum)} ${suffix}`;
}

function focusNextSetInput(event: ReactKeyboardEvent<HTMLInputElement>, field: "reps" | "rir" | null) {
  if (event.key !== "Enter") return;
  event.preventDefault();
  if (!field) {
    event.currentTarget.blur();
    return;
  }
  const nextInput = event.currentTarget
    .closest<HTMLElement>(".set-row")
    ?.querySelector<HTMLInputElement>(`input[data-set-field="${field}"]`);
  if (nextInput) nextInput.focus();
  else event.currentTarget.blur();
}

function TaskCardView({
  task,
  dragging,
  completionEnabled,
  editing,
  editValue,
  mobileExerciseMenu,
  onToggleCard,
  onEditValueChange,
  onSaveEdit,
  onCancelEdit,
  onToggleMenu,
  onStartEdit,
  onToggleDone,
  onDelete,
  onMove,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onTouchCancel,
  onUpdateSet,
  onFinishSetWeightEdit,
  onBeginSetWeightEdit,
  onToggleSetUnit,
  onRemoveSet,
  onAddSet,
}: TaskCardProps) {
  const className = `${task.done ? "task ui-panel done" : "task ui-panel"}${task.collapsed ? " collapsed" : ""}${dragging ? " dragging" : ""}${completionEnabled ? "" : " completion-hidden"}`;
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const skipNextEditBlur = useRef(false);
  const unitToggleTimer = useRef<number | null>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [togglingUnitId, setTogglingUnitId] = useState<string | null>(null);
  const positionMenu = useCallback(() => {
    const trigger = menuButtonRef.current;
    if (!trigger || !globalThis.window) return;
    const rect = trigger.getBoundingClientRect();
    const width = 158;
    const height = completionEnabled ? 128 : 88;
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
    const below = rect.bottom + 5;
    const top = below + height <= window.innerHeight - 8 ? below : Math.max(8, rect.top - height - 5);
    setMenuPosition({ top, left });
  }, [completionEnabled]);

  useLayoutEffect(() => {
    if (!mobileExerciseMenu) return undefined;
    positionMenu();
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    return () => {
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
    };
  }, [mobileExerciseMenu, positionMenu]);

  useLayoutEffect(() => {
    if (!mobileExerciseMenu) return;
    applyAnimatedStyles(menuRef.current, {
      "--menu-left": `${menuPosition.left}px`,
      "--menu-top": `${menuPosition.top}px`,
    });
  }, [mobileExerciseMenu, menuPosition]);

  useEffect(() => {
    if (editing) skipNextEditBlur.current = false;
  }, [editing]);

  useEffect(() => {
    if (!mobileExerciseMenu) return;
    const dismiss = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menuRef.current?.contains(target) || menuButtonRef.current?.contains(target)) return;
      onToggleMenu();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onToggleMenu();
    };
    document.addEventListener("pointerdown", dismiss, true);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", dismiss, true);
      document.removeEventListener("keydown", handleKey);
    };
  }, [mobileExerciseMenu, onToggleMenu]);

  useEffect(
    () => () => {
      if (unitToggleTimer.current !== null) window.clearTimeout(unitToggleTimer.current);
    },
    [],
  );

  const toggleSetUnit = (setId: string) => {
    onToggleSetUnit(setId);
    setTogglingUnitId(setId);
    if (unitToggleTimer.current !== null) window.clearTimeout(unitToggleTimer.current);
    unitToggleTimer.current = window.setTimeout(() => {
      setTogglingUnitId(null);
      unitToggleTimer.current = null;
    }, 280);
  };

  return (
    <article
      data-task-id={task.id}
      className={className}
      onDragEnter={onMove}
      onDragOver={(event: DragEvent<HTMLElement>) => event.preventDefault()}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
    >
      <div className="mobile-exercise-header exercise-header">
        <button
          className="mobile-collapse"
          onClick={onToggleCard}
          aria-label={task.collapsed ? `Expand ${task.text}` : `Collapse ${task.text}`}
        >
          <span className={task.collapsed ? "collapse-chevron" : "collapse-chevron expanded"} />
        </button>
        <div className="exercise-header-copy">
          <div className="task-title-line">
            {editing ? (
              <input
                className="task-edit header-task-edit"
                value={editValue}
                onChange={(event) => onEditValueChange(event.target.value)}
                onBlur={() => {
                  if (skipNextEditBlur.current) {
                    skipNextEditBlur.current = false;
                    return;
                  }
                  onSaveEdit();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                  if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    skipNextEditBlur.current = true;
                    onCancelEdit();
                  }
                }}
                autoFocus
                aria-label="Edit exercise name"
              />
            ) : (
              <span className={task.done ? "mobile-exercise-title done" : "mobile-exercise-title"}>{task.text}</span>
            )}
          </div>
          {task.collapsed && (
            <div className="collapsed-summary">
              <small>
                <i>
                  {task.sets?.length ?? 1} {(task.sets?.length ?? 1) === 1 ? "set" : "sets"}
                </i>
                <i>
                  {summarizeValues(
                    (task.sets ?? []).map((set) => set.weight),
                    (task.sets?.[0]?.unit ?? "kg").toUpperCase(),
                  )}
                </i>
                <i>
                  {summarizeValues(
                    (task.sets ?? []).map((set) => set.reps),
                    "REPS",
                  )}
                </i>
                <i>
                  {summarizeValues(
                    (task.sets ?? []).map((set) => set.rir),
                    "RIR",
                  )}
                </i>
                {task.done && <b>Done</b>}
              </small>
            </div>
          )}
        </div>
        <button
          ref={menuButtonRef}
          className="mobile-overflow"
          onClick={onToggleMenu}
          aria-label={`${task.text} options`}
        >
          •••
        </button>
        {mobileExerciseMenu &&
          globalThis.document &&
          createPortal(
            <div
              ref={menuRef}
              className="mobile-exercise-menu exercise-menu-portal"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <button onClick={onStartEdit}>Edit name</button>
              {completionEnabled && (
                <button onClick={onToggleDone}>{task.done ? "Mark not done" : "Mark complete"}</button>
              )}
              <button className="danger" onClick={onDelete}>
                Delete exercise
              </button>
            </div>,
            document.body,
          )}
      </div>
      <span className="drag-handle" aria-hidden="true" />
      {completionEnabled && (
        <button className="check" onClick={onToggleDone}>
          {task.done ? "✓" : ""}
        </button>
      )}
      {!task.collapsed && (
        <div className="exercise-card-content">
          <div className="exercise-card-title">
            <span className="task-text">{task.text}</span>
          </div>
          <div className="sets-table">
            <div className="set-row set-heading">
              <span>SET</span>
              <span>WEIGHT</span>
              <span>REPS</span>
              <span>RIR</span>
              <span />
            </div>
            {(task.sets ?? []).map((set, index) => {
              const progressionDelta = weightProgressionDelta(set);
              return (
                <div className="set-row" key={set.id}>
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
                      className={togglingUnitId === set.id ? "weight-unit-toggle is-toggling" : "weight-unit-toggle"}
                      onClick={() => toggleSetUnit(set.id)}
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
                      <em
                        className={
                          Number(set.reps) > set.lastReps ? "rep-delta set-delta up" : "rep-delta set-delta down"
                        }
                      >
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
                  <button
                    className="remove-set"
                    onClick={() => onRemoveSet(set.id)}
                    disabled={(task.sets?.length ?? 0) <= 1}
                    aria-label={`Remove set ${index + 1}`}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
          <button className="add-set" onClick={onAddSet}>
            ＋ Add set
          </button>
        </div>
      )}
    </article>
  );
}

export const TaskCard = memo(
  TaskCardView,
  (previous, next) =>
    sameTask(previous.task, next.task) &&
    previous.dragging === next.dragging &&
    previous.completionEnabled === next.completionEnabled &&
    previous.editing === next.editing &&
    ((!previous.editing && !next.editing) || previous.editValue === next.editValue) &&
    previous.mobileExerciseMenu === next.mobileExerciseMenu,
);

export function ConnectedTaskCard({ task }: { task: TaskCardTask }) {
  return <TaskCardView {...useConnectedTaskCard(task)} />;
}
