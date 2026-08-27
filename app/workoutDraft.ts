import type { Task, WorkoutDraft } from "./trackTypes";

export function cloneWorkoutTasks(tasks: Task[]) {
  return tasks.map((task) => ({
    ...task,
    sets: task.sets?.map((set) => ({ ...set })),
  }));
}

export function workoutDraftSignature(draft: Pick<WorkoutDraft, "splitId" | "splitTitle" | "tasks">) {
  return JSON.stringify({
    splitId: draft.splitId,
    splitTitle: draft.splitTitle,
    tasks: draft.tasks.map((task) => ({
      id: task.id,
      text: task.text,
      done: task.done,
      weight: task.weight,
      unit: task.unit,
      reps: task.reps,
      rir: task.rir,
      sets: task.sets,
    })),
  });
}
