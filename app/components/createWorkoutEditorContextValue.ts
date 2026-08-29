import type { WorkoutEditorContextValue } from "../contexts/WorkoutEditorContext";
import type { useWorkoutEditorController } from "../hooks/useWorkoutEditorController";
import type { useWorkoutState } from "../hooks/useWorkoutState";
import type { Task } from "../trackTypes";

type WorkoutState = ReturnType<typeof useWorkoutState>;

type CreateWorkoutEditorContextOptions = {
  completionEnabled: boolean;
  getTask: (taskId: string) => Task | undefined;
  dragging: WorkoutState["dragging"];
  editing: WorkoutState["editing"];
  editValue: WorkoutState["editValue"];
  mobileExerciseMenu: WorkoutState["mobileExerciseMenu"];
  setEditValue: WorkoutState["setEditValue"];
  setEditing: WorkoutState["setEditing"];
  setMobileExerciseMenu: WorkoutState["setMobileExerciseMenu"];
  editor: ReturnType<typeof useWorkoutEditorController>;
  startRest: () => void;
};

export function createWorkoutEditorContextValue({
  completionEnabled,
  getTask,
  dragging,
  editing,
  editValue,
  mobileExerciseMenu,
  setEditValue,
  setEditing,
  setMobileExerciseMenu,
  editor,
  startRest,
}: CreateWorkoutEditorContextOptions): WorkoutEditorContextValue {
  return {
    completionEnabled,
    draggingTaskId: dragging,
    editingTaskId: editing,
    editValue,
    mobileExerciseMenu,
    onToggleCard: editor.toggleCard,
    onEditValueChange: setEditValue,
    onSaveEdit: (taskId) => editor.saveEdit(taskId, editValue),
    onCancelEdit: () => setEditing(null),
    onToggleMenu: (taskId) => setMobileExerciseMenu((current) => (current === taskId ? null : taskId)),
    onStartEdit: (taskId) => {
      const task = getTask(taskId);
      if (!task) return;
      setEditing(taskId);
      setEditValue(task.text);
      editor.updateTasks(
        (current) => current.map((item) => (item.id === taskId ? { ...item, collapsed: false } : item)),
        false,
      );
      setMobileExerciseMenu(null);
    },
    onToggleDone: (taskId) => {
      editor.toggleDone(taskId);
      setMobileExerciseMenu(null);
    },
    onCompleteSetAndStartRest: (taskId, setId) => {
      editor.completeSet(taskId, setId);
      setMobileExerciseMenu(null);
      startRest();
    },
    onDelete: editor.removeExercise,
    onMove: (taskId) => editor.moveTask(taskId),
    onPointerDown: (event, taskId) => editor.beginCardPointerDrag(event, taskId),
    onPointerMove: editor.moveTaskFromPointer,
    onPointerUp: editor.endPointerDrag,
    onPointerCancel: (event) => {
      if (event.pointerType !== "touch") editor.endPointerDrag();
    },
    onTouchStart: (event, taskId) => editor.beginTouchDrag(event, taskId),
    onTouchMove: editor.moveTouchDrag,
    onTouchEnd: editor.endTouchDrag,
    onTouchCancel: editor.endTouchDrag,
    onUpdateSet: editor.updateSet,
    onFinishSetWeightEdit: editor.finishSetWeightEdit,
    onBeginSetWeightEdit: editor.beginSetWeightEdit,
    onToggleSetUnit: editor.toggleSetUnit,
    onRemoveSet: editor.removeSet,
    onAddSet: editor.addSet,
  };
}
