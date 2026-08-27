import { exerciseFamilyKey } from "./rankBenchmarks.ts";
import { performedTimestamp, weightKg } from "./dashboardMetrics.ts";
import type { RankTask } from "./rankModels.ts";

export function buildProgressFeed(historyTasks: RankTask[]) {
  const bestByExercise = new Map<string, number>();
  const milestones: { id: string; exercise: string; detail: string; timestamp: number; pr: boolean }[] = [];
  const chronological = [...historyTasks].sort((left, right) => performedTimestamp(left) - performedTimestamp(right));

  chronological.forEach((task, taskIndex) => {
    const timestamp = performedTimestamp(task);
    const bestSet = [...(task.sets ?? [])].sort(
      (left, right) => weightKg(right.weight, right.unit) - weightKg(left.weight, left.unit),
    )[0];
    if (!timestamp || !bestSet) return;
    const loadKg = weightKg(bestSet.weight, bestSet.unit);
    if (loadKg <= 0) return;
    const family = exerciseFamilyKey(task.text) || task.text.trim().toLocaleLowerCase();
    const previousBest = bestByExercise.get(family) ?? 0;
    const isPr = previousBest > 0 && loadKg > previousBest + 0.05;
    if (isPr) {
      milestones.push({
        id: `${family}-${timestamp}-${taskIndex}`,
        exercise: task.text,
        detail: `+${(loadKg - previousBest).toFixed(1).replace(/\.0$/, "")} kg PR · ${Number(bestSet.weight) || 0} ${bestSet.unit ?? "kg"} × ${Number(bestSet.reps) || 0}`,
        timestamp,
        pr: true,
      });
    }
    bestByExercise.set(family, Math.max(previousBest, loadKg));
  });

  if (milestones.length) return milestones.sort((a, b) => b.timestamp - a.timestamp).slice(0, 4);
  return [...historyTasks]
    .sort((left, right) => performedTimestamp(right) - performedTimestamp(left))
    .slice(0, 4)
    .map((task, index) => {
      const bestSet = task.sets?.[0];
      return {
        id: `recent-${performedTimestamp(task)}-${index}`,
        exercise: task.text,
        detail: bestSet
          ? `${Number(bestSet.weight) || 0} ${bestSet.unit ?? "kg"} × ${Number(bestSet.reps) || 0} reps`
          : "Workout logged",
        timestamp: performedTimestamp(task),
        pr: false,
      };
    });
}
