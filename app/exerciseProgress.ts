import { exerciseFamilyKey } from "./rankBenchmarks.ts";
import type { Checklist, SetEntry, Task } from "./trackTypes.ts";

export type ExerciseProgressSyncPreview = {
  exerciseCount: number;
  splitCount: number;
};

export type ExerciseProgressSyncPlan = ExerciseProgressSyncPreview & {
  changedSplitIds: string[];
  nextLists: Checklist[];
};

type ProgressValues = Pick<SetEntry, "weight" | "unit" | "reps" | "rir">;
type ProgressCandidate = {
  listUpdatedAt: number;
  listOrder: number;
  taskOrder: number;
  meaningful: boolean;
  task: Task;
};

function progressKey(name: string) {
  return exerciseFamilyKey(name) || name.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function progressSets(task: Task): ProgressValues[] {
  if (task.sets?.length) {
    return task.sets.map(({ weight, unit, reps, rir }) => ({ weight, unit, reps, rir }));
  }
  return [
    {
      weight: task.weight ?? "0",
      unit: task.unit ?? "kg",
      reps: task.reps,
      rir: task.rir,
    },
  ];
}

function hasMeaningfulProgress(task: Task) {
  return progressSets(task).some(
    (set) => Number(set.weight) > 0 || Number(set.reps) > 1 || Number(set.rir) > 0 || task.done,
  );
}

function preferredCandidate(current: ProgressCandidate | undefined, candidate: ProgressCandidate) {
  if (!current) return candidate;
  if (candidate.meaningful !== current.meaningful) return candidate.meaningful ? candidate : current;
  if (candidate.listUpdatedAt !== current.listUpdatedAt)
    return candidate.listUpdatedAt > current.listUpdatedAt ? candidate : current;
  if (candidate.listOrder !== current.listOrder) return candidate.listOrder > current.listOrder ? candidate : current;
  return candidate.taskOrder > current.taskOrder ? candidate : current;
}

function sameProgress(left: ProgressValues, right: ProgressValues) {
  return left.weight === right.weight && left.unit === right.unit && left.reps === right.reps && left.rir === right.rir;
}

function copyLatestProgress(task: Task, source: Task) {
  const sourceSets = progressSets(source);
  const first = sourceSets[0];
  let changed = false;
  const sets = task.sets?.map((set, index) => {
    const values = sourceSets[Math.min(index, sourceSets.length - 1)] ?? first;
    if (sameProgress(set, values)) return set;
    changed = true;
    return { ...set, ...values };
  });
  const legacyValues = {
    weight: first.weight,
    unit: first.unit,
    reps: first.reps,
    rir: first.rir,
  };
  const legacyChanged =
    task.weight !== legacyValues.weight ||
    task.unit !== legacyValues.unit ||
    task.reps !== legacyValues.reps ||
    task.rir !== legacyValues.rir;
  if (!sets?.length && legacyChanged) changed = true;
  if (!changed) return task;
  return { ...task, ...legacyValues, sets };
}

export function buildLatestExerciseProgressPlan(lists: Checklist[], now = Date.now()): ExerciseProgressSyncPlan {
  const latestByExercise = new Map<string, ProgressCandidate>();
  lists.forEach((list, listOrder) => {
    list.tasks.forEach((task, taskOrder) => {
      const key = progressKey(task.text);
      const candidate: ProgressCandidate = {
        listUpdatedAt: list.updatedAt,
        listOrder,
        taskOrder,
        meaningful: hasMeaningfulProgress(task),
        task,
      };
      latestByExercise.set(key, preferredCandidate(latestByExercise.get(key), candidate));
    });
  });

  const changedSplitIds: string[] = [];
  let exerciseCount = 0;
  const nextLists = lists.map((list) => {
    let splitChanged = false;
    const tasks = list.tasks.map((task) => {
      const source = latestByExercise.get(progressKey(task.text))?.task;
      if (!source) return task;
      const nextTask = copyLatestProgress(task, source);
      if (nextTask !== task) {
        splitChanged = true;
        exerciseCount += 1;
      }
      return nextTask;
    });
    if (!splitChanged) return list;
    changedSplitIds.push(list.id);
    return { ...list, tasks, updatedAt: now };
  });

  return {
    exerciseCount,
    splitCount: changedSplitIds.length,
    changedSplitIds,
    nextLists,
  };
}

export function buildAllSplitRankTasks(lists: Checklist[]) {
  const latestByExercise = new Map<string, ProgressCandidate>();
  lists.forEach((list, listOrder) => {
    list.tasks.forEach((task, taskOrder) => {
      const candidate: ProgressCandidate = {
        listUpdatedAt: list.updatedAt,
        listOrder,
        taskOrder,
        meaningful: hasMeaningfulProgress(task),
        task,
      };
      const key = progressKey(task.text);
      latestByExercise.set(key, preferredCandidate(latestByExercise.get(key), candidate));
    });
  });
  return [...latestByExercise.values()]
    .sort(
      (left, right) =>
        left.listOrder - right.listOrder ||
        left.taskOrder - right.taskOrder ||
        left.task.text.localeCompare(right.task.text),
    )
    .map(({ task }) => ({ ...task, exerciseId: task.id, source: "current" as const }));
}
