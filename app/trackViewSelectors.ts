import type { BottomTabId } from "./components/BottomTabBar";
import { exerciseSearchScore } from "./exerciseSearch";
import { TRACK_INTERACTION } from "./trackConstants";
import type { Checklist, Filter } from "./trackTypes";

export function buildExerciseSuggestions(exerciseNames: readonly string[], query: string) {
  if (!query) return [];
  return exerciseNames
    .map((name) => ({ name, score: exerciseSearchScore(name, query) }))
    .filter((result) => Number.isFinite(result.score))
    .sort((left, right) => left.score - right.score || left.name.localeCompare(right.name))
    .slice(0, TRACK_INTERACTION.maxExerciseSuggestions)
    .map((result) => result.name);
}

export function filterWorkoutTasks(tasks: Checklist["tasks"], filter: Filter) {
  const visible: Checklist["tasks"] = [];
  let openCount = 0;
  for (const task of tasks) {
    if (!task.done) openCount += 1;
    if (filter === "all" || (filter === "open" && !task.done) || (filter === "done" && task.done)) {
      visible.push(task);
    }
  }
  return { visible, openCount };
}

export function bottomTabFromNavigation({
  showCalendar,
  showDashboard,
  showRank,
  showTimer,
}: {
  showCalendar: boolean;
  showDashboard: boolean;
  showRank: boolean;
  showTimer: boolean;
}): BottomTabId {
  if (showDashboard) return "dashboard";
  if (showRank) return "rank";
  if (showCalendar) return "calendar";
  if (showTimer) return "timer";
  return "workout";
}
