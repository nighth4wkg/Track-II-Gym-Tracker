import { detectExerciseTargets } from "./exerciseClassifier.js";
import type { DashboardWeeklyExerciseSet } from "./dashboardSummary.ts";
import { performedTimestamp, startOfLocalDay } from "./dashboardMetrics.ts";
import type { RankTask } from "./rankModels.ts";
import { MUSCLE_GROUPS, type MuscleGroup } from "./rankTypes.ts";
import { MILLISECONDS_PER_DAY } from "./trackConstants.ts";

type WeightedTarget = { group: MuscleGroup; weight: number };

function validMuscleGroup(value: string): MuscleGroup | null {
  return MUSCLE_GROUPS.find((group) => group === value) ?? null;
}

/** Resolve every exercise through the same primary-target rules used by Rank. */
export function primaryMuscleGroup(exerciseName: string): MuscleGroup | null {
  // SAFETY: the shared classifier returns target objects with group and weight fields; validMuscleGroup filters groups before they affect totals.
  const targets = detectExerciseTargets(exerciseName).targets as WeightedTarget[];
  return (
    targets.reduce<WeightedTarget | null>((primary, candidate) => {
      const group = validMuscleGroup(candidate.group);
      if (!group) return primary;
      const next = { group, weight: Number.isFinite(candidate.weight) ? candidate.weight : 0 };
      return !primary || next.weight > primary.weight ? next : primary;
    }, null)?.group ?? null
  );
}

function addSetTotal(totals: Map<MuscleGroup, number>, group: MuscleGroup | null, count: number) {
  if (!group || count <= 0) return;
  totals.set(group, (totals.get(group) ?? 0) + count);
}

/** Prefer raw exercise rows so recovery and Rank share one detection source. */
export function aggregateWeeklyMuscleSets(
  items: readonly DashboardWeeklyExerciseSet[],
  groupOverrides: ReadonlyMap<string, MuscleGroup> = new Map(),
) {
  const totals = new Map<MuscleGroup, number>();
  for (const item of items) {
    const override = item.exerciseId ? groupOverrides.get(item.exerciseId) : undefined;
    const group = override ?? primaryMuscleGroup(item.exerciseName);
    addSetTotal(totals, group, Math.max(0, Math.round(item.setCount)));
  }
  return totals;
}

/** Legacy/local fallback for accounts that do not yet have RPC exercise rows. */
export function aggregateWeeklyMuscleSetsFromTasks(tasks: readonly RankTask[], now = Date.now()) {
  const totals = new Map<MuscleGroup, number>();
  const cutoff = startOfLocalDay(now - 6 * MILLISECONDS_PER_DAY);
  for (const task of tasks) {
    if (performedTimestamp(task) < cutoff) continue;
    const group = task.rankGroupOverride ?? primaryMuscleGroup(task.text);
    const setCount = task.sets?.length ?? (task.reps !== undefined || task.weight !== undefined ? 1 : 0);
    addSetTotal(totals, group, Math.max(0, setCount));
  }
  return totals;
}
