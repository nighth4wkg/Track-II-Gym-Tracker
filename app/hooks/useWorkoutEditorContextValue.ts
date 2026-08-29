import { useMemo } from "react";
import { createWorkoutEditorContextValue } from "../components/createWorkoutEditorContextValue";
import type { useWorkoutEditorController } from "./useWorkoutEditorController";
import type { useWorkoutState } from "./useWorkoutState";

type WorkoutEditorContextOptions = {
  completionEnabled: boolean;
  workout: ReturnType<typeof useWorkoutState>;
  editor: ReturnType<typeof useWorkoutEditorController>;
  startRest: () => void;
};

export function useWorkoutEditorContextValue({
  completionEnabled,
  workout,
  editor,
  startRest,
}: WorkoutEditorContextOptions) {
  const { dragging, editing, editValue, mobileExerciseMenu, setEditValue, setEditing, setMobileExerciseMenu } = workout;
  return useMemo(
    () =>
      createWorkoutEditorContextValue({
        completionEnabled,
        getTask: editor.getTask,
        dragging,
        editing,
        editValue,
        mobileExerciseMenu,
        setEditValue,
        setEditing,
        setMobileExerciseMenu,
        editor,
        startRest,
      }),
    [
      completionEnabled,
      dragging,
      editing,
      editValue,
      mobileExerciseMenu,
      startRest,
      editor,
      setEditValue,
      setEditing,
      setMobileExerciseMenu,
    ],
  );
}
