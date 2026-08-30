"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";
import type { TaskCardSet, TaskCardTask } from "../components/TaskCard";

export type WorkoutEditorContextValue = {
  completionEnabled: boolean;
  draggingTaskId: string | null;
  editingTaskId: string | null;
  editValue: string;
  mobileExerciseMenu: string | null;
  onToggleCard: (taskId: string) => void;
  onEditValueChange: (value: string) => void;
  onSaveEdit: (taskId: string) => void;
  onCancelEdit: () => void;
  onToggleMenu: (taskId: string) => void;
  onStartEdit: (taskId: string) => void;
  onToggleDone: (taskId: string) => void;
  onCompleteSetAndStartRest: (taskId: string, setId: string) => void;
  onDelete: (taskId: string) => void;
  onMove: (taskId: string) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>, taskId: string) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
  onTouchStart: (event: ReactTouchEvent<HTMLElement>, taskId: string) => void;
  onTouchMove: (event: ReactTouchEvent<HTMLElement>) => void;
  onTouchEnd: () => void;
  onTouchCancel: () => void;
  onUpdateSet: (taskId: string, setId: string, field: "weight" | "reps" | "rir", value: string) => void;
  onFinishSetWeightEdit: (taskId: string, set: TaskCardSet) => void;
  onBeginSetWeightEdit: (taskId: string, set: TaskCardSet, input: HTMLInputElement) => void;
  onToggleExerciseUnit: (taskId: string) => void;
  onRemoveSet: (taskId: string, setId: string) => void;
  onAddSet: (taskId: string) => void;
};

const WorkoutEditorContext = createContext<WorkoutEditorContextValue | null>(null);

export function WorkoutEditorProvider({ value, children }: { value: WorkoutEditorContextValue; children: ReactNode }) {
  return <WorkoutEditorContext.Provider value={value}>{children}</WorkoutEditorContext.Provider>;
}

export function useWorkoutEditor() {
  const context = useContext(WorkoutEditorContext);
  if (!context) throw new Error("useWorkoutEditor must be used inside WorkoutEditorProvider");
  return context;
}

export function useConnectedTaskCard(task: TaskCardTask) {
  const editor = useWorkoutEditor();
  const completeSetAndStartRestRef = useRef(editor.onCompleteSetAndStartRest);
  useEffect(() => {
    completeSetAndStartRestRef.current = editor.onCompleteSetAndStartRest;
  }, [editor.onCompleteSetAndStartRest]);
  const onCompleteSetAndStartRest = useCallback(
    (setId: string) => completeSetAndStartRestRef.current(task.id, setId),
    [task.id],
  );
  return {
    task,
    dragging: editor.draggingTaskId === task.id,
    completionEnabled: editor.completionEnabled,
    editing: editor.editingTaskId === task.id,
    editValue: editor.editValue,
    mobileExerciseMenu: editor.mobileExerciseMenu === task.id,
    onToggleCard: () => editor.onToggleCard(task.id),
    onEditValueChange: editor.onEditValueChange,
    onSaveEdit: () => editor.onSaveEdit(task.id),
    onCancelEdit: editor.onCancelEdit,
    onToggleMenu: () => editor.onToggleMenu(task.id),
    onStartEdit: () => editor.onStartEdit(task.id),
    onToggleDone: () => editor.onToggleDone(task.id),
    onCompleteSetAndStartRest,
    onDelete: () => editor.onDelete(task.id),
    onMove: () => editor.onMove(task.id),
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => editor.onPointerDown(event, task.id),
    onPointerMove: editor.onPointerMove,
    onPointerUp: editor.onPointerUp,
    onPointerCancel: editor.onPointerCancel,
    onTouchStart: (event: ReactTouchEvent<HTMLElement>) => editor.onTouchStart(event, task.id),
    onTouchMove: editor.onTouchMove,
    onTouchEnd: editor.onTouchEnd,
    onTouchCancel: editor.onTouchCancel,
    onUpdateSet: (setId: string, field: "weight" | "reps" | "rir", value: string) =>
      editor.onUpdateSet(task.id, setId, field, value),
    onFinishSetWeightEdit: (set: TaskCardSet) => editor.onFinishSetWeightEdit(task.id, set),
    onBeginSetWeightEdit: (set: TaskCardSet, input: HTMLInputElement) =>
      editor.onBeginSetWeightEdit(task.id, set, input),
    onToggleExerciseUnit: () => editor.onToggleExerciseUnit(task.id),
    onRemoveSet: (setId: string) => editor.onRemoveSet(task.id, setId),
    onAddSet: () => editor.onAddSet(task.id),
  };
}
