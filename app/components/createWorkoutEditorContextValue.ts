import type { WorkoutEditorContextValue } from "../contexts/WorkoutEditorContext";
import type { useWorkoutEditorController } from "../hooks/useWorkoutEditorController";
import type { useWorkoutState } from "../hooks/useWorkoutState";
import type { Checklist } from "../trackTypes";

type CreateWorkoutEditorContextOptions = {
  completionEnabled: boolean;
  tasks: Checklist["tasks"];
  workout: ReturnType<typeof useWorkoutState>;
  editor: ReturnType<typeof useWorkoutEditorController>;
};

export function createWorkoutEditorContextValue({
  completionEnabled,
  tasks,
  workout,
  editor,
}: CreateWorkoutEditorContextOptions): WorkoutEditorContextValue {
  return {
    completionEnabled,
    draggingTaskId: workout.dragging,
    editingTaskId: workout.editing,
    editValue: workout.editValue,
    mobileExerciseMenu: workout.mobileExerciseMenu,
    onToggleCard: editor.toggleCard,
    onEditValueChange: workout.setEditValue,
    onSaveEdit: (taskId) => editor.saveEdit(taskId, workout.editValue),
    onCancelEdit: () => workout.setEditing(null),
    onToggleMenu: (taskId) => workout.setMobileExerciseMenu((current) => (current === taskId ? null : taskId)),
    onStartEdit: (taskId) => {
      const task = tasks.find((item) => item.id === taskId);
      if (!task) return;
      workout.setEditing(taskId);
      workout.setEditValue(task.text);
      editor.updateTasks(
        (current) => current.map((item) => (item.id === taskId ? { ...item, collapsed: false } : item)),
        false,
      );
      workout.setMobileExerciseMenu(null);
    },
    onToggleDone: (taskId) => {
      editor.toggleDone(taskId);
      workout.setMobileExerciseMenu(null);
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
