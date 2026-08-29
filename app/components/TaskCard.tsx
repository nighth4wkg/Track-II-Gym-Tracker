"use client";

import {
  memo,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { useConnectedTaskCard } from "../contexts/WorkoutEditorContext";
import { useTaskCardMenu } from "../hooks/useTaskCardMenu";
import { ExerciseHistoryButton } from "./ExerciseHistoryButton";
import { TaskCardMenu } from "./TaskCardMenu";
import { TaskSetRow } from "./TaskSetRow";
import {
  buildProgressionCoach,
  sameTask,
  summarizeSetValues,
  type TaskCardSet,
  type TaskCardTask,
} from "../taskCardUtils";
export type { TaskCardSet, TaskCardTask } from "../taskCardUtils";

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
  onCompleteSetAndStartRest: (setId: string) => void;
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

type CoachDecision = {
  title: string;
  value: "accepted" | "repeat";
};

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
  onCompleteSetAndStartRest,
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
  const progressionCoach = buildProgressionCoach(task);
  const className = `${task.done ? "task ui-panel done" : "task ui-panel"}${task.collapsed ? " collapsed" : ""}${dragging ? " dragging" : ""}${completionEnabled ? "" : " completion-hidden"}`;
  const skipNextEditBlur = useRef(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const [coachDecision, setCoachDecision] = useState<CoachDecision | null>(null);
  const activeCoachDecision =
    coachDecision && coachDecision.title === progressionCoach?.title ? coachDecision.value : null;

  const {
    menuButtonRef,
    menuRef,
    menuPosition,
    closeMenu,
    toggleMenu: toggleExerciseMenu,
  } = useTaskCardMenu({
    completionEnabled,
    menuOpen: mobileExerciseMenu,
    onToggleMenu,
  });

  useEffect(() => {
    if (editing) skipNextEditBlur.current = false;
  }, [editing]);

  const toggleCoach = () => {
    if (!progressionCoach) return;
    setCoachOpen((open) => !open);
    closeMenu();
    if (mobileExerciseMenu) onToggleMenu();
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
              <>
                <span className={task.done ? "mobile-exercise-title done" : "mobile-exercise-title"}>{task.text}</span>
                <ExerciseHistoryButton exerciseId={task.id} exerciseName={task.text} />
              </>
            )}
          </div>
          {task.collapsed && (
            <div className="collapsed-summary">
              <small>
                <i>
                  {task.sets?.length ?? 1} {(task.sets?.length ?? 1) === 1 ? "set" : "sets"}
                </i>
                <i>
                  <span className="collapsed-metrics">
                    {summarizeSetValues(
                      (task.sets ?? []).map((set) => set.weight),
                      (task.sets?.[0]?.unit ?? "kg").toUpperCase(),
                    )}{" "}
                    ×{" "}
                    {summarizeSetValues(
                      (task.sets ?? []).map((set) => set.reps),
                      "REPS",
                    )}{" "}
                    ·{" "}
                    {summarizeSetValues(
                      (task.sets ?? []).map((set) => set.rir),
                      "RIR",
                    )}
                  </span>
                </i>
                {task.done && <b>Done</b>}
              </small>
            </div>
          )}
        </div>
        <button
          ref={menuButtonRef}
          className="mobile-overflow"
          onClick={toggleExerciseMenu}
          aria-label={`${task.text} options`}
        >
          •••
        </button>
        <TaskCardMenu
          menuOpen={mobileExerciseMenu}
          menuPosition={menuPosition}
          menuRef={menuRef}
          completionEnabled={completionEnabled}
          taskDone={task.done}
          coachOpen={coachOpen}
          progressionCoach={progressionCoach}
          onStartEdit={onStartEdit}
          onToggleCoach={toggleCoach}
          onToggleDone={onToggleDone}
          onDelete={onDelete}
        />
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
          {coachOpen && progressionCoach && (
            <aside className={"progression-coach is-" + progressionCoach.tone} role="status">
              <span className="progression-coach-kicker">Smart coach</span>
              <strong>{progressionCoach.title}</strong>
              <span>{progressionCoach.detail}</span>
              <span className="progression-coach-confidence">Confidence: {progressionCoach.confidence}</span>
              <div className="progression-coach-actions">
                <button
                  type="button"
                  className="ui-button ui-button-secondary"
                  onClick={() => setCoachDecision({ title: progressionCoach.title, value: "accepted" })}
                  aria-label={`Accept smart coach suggestion for ${task.text}`}
                >
                  Accept suggestion
                </button>
                <button
                  type="button"
                  className="ui-button ui-button-secondary"
                  onClick={() => setCoachDecision({ title: progressionCoach.title, value: "repeat" })}
                  aria-label={`Repeat the current load for ${task.text}`}
                >
                  Repeat load
                </button>
                <button
                  type="button"
                  className="ui-button ui-button-quiet"
                  onClick={() => {
                    setCoachDecision(null);
                    setCoachOpen(false);
                  }}
                >
                  Dismiss
                </button>
              </div>
              {activeCoachDecision && (
                <span className="progression-coach-decision" aria-live="polite">
                  {activeCoachDecision === "accepted"
                    ? "Accepted — adjust the next load manually; Track II never changes it for you."
                    : "Repeat selected — keep the current load for the next exposure."}
                </span>
              )}
            </aside>
          )}
          <div className="sets-table">
            <div className="set-row set-heading">
              <span>SET</span>
              <span>WEIGHT</span>
              <span>REPS</span>
              <span>RIR</span>
              <span>ACTION</span>
              <span />
            </div>
            {(task.sets ?? []).map((set, index) => (
              <TaskSetRow
                key={set.id}
                task={task}
                set={set}
                index={index}
                onCompleteSetAndStartRest={onCompleteSetAndStartRest}
                onUpdateSet={onUpdateSet}
                onFinishSetWeightEdit={onFinishSetWeightEdit}
                onBeginSetWeightEdit={onBeginSetWeightEdit}
                onToggleSetUnit={onToggleSetUnit}
                onRemoveSet={onRemoveSet}
              />
            ))}
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
    previous.mobileExerciseMenu === next.mobileExerciseMenu &&
    previous.onCompleteSetAndStartRest === next.onCompleteSetAndStartRest,
);

export const ConnectedTaskCard = memo(
  function ConnectedTaskCard({ task }: { task: TaskCardTask }) {
    // Keep the context-connected adapter tiny, then let the memoized view decide
    // whether this particular exercise changed. Editing one set should not
    // repaint every card in a long split.
    return <TaskCard {...useConnectedTaskCard(task)} />;
  },
  (previous, next) => previous.task === next.task,
);
