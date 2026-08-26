import { calendarDateKey } from "./calendarTypes.ts";
import type { RankTask } from "./rankModels.ts";
import { MILLISECONDS_PER_DAY } from "./trackConstants.ts";

export type DashboardTimeframe = "week" | "month" | "ytd" | "all";
export type ActivityPoint = { count: number; label: string; shortLabel: string };

export const DAY_MS = MILLISECONDS_PER_DAY;
export const WEEK_MS = DAY_MS * 7;
const MONTH_MS = DAY_MS * 30;

export function dateKeyTimestamp(key: string) {
  const timestamp = new Date(`${key}T12:00:00`).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function performedTimestamp(task: RankTask) {
  const timestamp = new Date(task.performedAt ?? 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function weightKg(weight: string | number | undefined, unit: "kg" | "lb" | undefined) {
  const value = Math.max(0, Number(weight) || 0);
  return unit === "lb" ? value / 2.2046226218 : value;
}

export function taskVolume(task: RankTask) {
  const seenSetNumbers = new Set<number>();
  return (task.sets ?? []).reduce((sum, set) => {
    const setNumber = Number(set.setNumber);
    if (Number.isFinite(setNumber)) {
      if (seenSetNumbers.has(setNumber)) return sum;
      seenSetNumbers.add(setNumber);
    }
    return sum + weightKg(set.weight, set.unit) * Math.max(0, Number(set.reps) || 0);
  }, 0);
}

export function performedDateKey(task: RankTask) {
  const timestamp = performedTimestamp(task);
  return timestamp > 0 ? calendarDateKey(new Date(timestamp)) : "";
}

export function volumeByWorkoutDate(tasks: RankTask[]) {
  const totals = new Map<string, number>();
  for (const task of tasks) {
    const dateKey = performedDateKey(task);
    if (!dateKey) continue;
    totals.set(dateKey, (totals.get(dateKey) ?? 0) + taskVolume(task));
  }
  return totals;
}

export function averageVolumeForDates(tasks: RankTask[], dateKeys: string[]) {
  const uniqueDateKeys = [...new Set(dateKeys)].filter(Boolean);
  if (!uniqueDateKeys.length) return 0;
  const totals = volumeByWorkoutDate(tasks);
  return uniqueDateKeys.reduce((sum, dateKey) => sum + (totals.get(dateKey) ?? 0), 0) / uniqueDateKeys.length;
}

export function timeframeBounds(timeframe: DashboardTimeframe, timestamps: number[], now: number) {
  const sorted = timestamps.filter((value) => value > 0).sort((left, right) => left - right);
  const firstLog = sorted[0] ?? now;
  const latestLog = sorted.at(-1) ?? now;
  if (timeframe === "all") return { start: firstLog, end: Math.max(latestLog, now) };
  if (timeframe === "ytd") {
    return {
      start: Math.max(firstLog, new Date(new Date(latestLog).getFullYear(), 0, 1).getTime()),
      end: latestLog,
    };
  }
  const duration = timeframe === "week" ? WEEK_MS : MONTH_MS;
  return { start: Math.max(firstLog, latestLog - duration), end: latestLog };
}

export function formatShortDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(timestamp);
}

function buildWeeklyActivityPoints(workoutTimestamps: number[], start: number, end: number, requestedWeeks: number) {
  const weeks = Math.max(2, requestedWeeks);
  const period = Math.max(WEEK_MS, end - start);
  return Array.from({ length: weeks }, (_, index) => {
    const bucketStart = start + (index * period) / weeks;
    const bucketEnd = index === weeks - 1 ? end : start + ((index + 1) * period) / weeks;
    const count = workoutTimestamps.filter(
      (timestamp) => timestamp >= bucketStart && (index === weeks - 1 ? timestamp <= bucketEnd : timestamp < bucketEnd),
    ).length;
    return {
      count,
      label: `Week of ${formatShortDate(bucketStart)}: ${count} ${count === 1 ? "workout" : "workouts"}`,
      shortLabel: formatShortDate(bucketStart),
    };
  });
}

export function buildActivityPoints(
  workoutTimestamps: number[],
  timeframe: DashboardTimeframe,
  start: number,
  end: number,
): ActivityPoint[] {
  const useMonths = timeframe === "ytd" || (timeframe === "all" && end - start > 12 * WEEK_MS);
  const inRangeTimestamps = workoutTimestamps.filter((timestamp) => timestamp >= start && timestamp <= end);
  const monthsInRange = new Set(
    inRangeTimestamps.map((timestamp) => {
      const date = new Date(timestamp);
      return `${date.getFullYear()}-${date.getMonth()}`;
    }),
  );
  if (useMonths && monthsInRange.size <= 1) {
    return buildWeeklyActivityPoints(workoutTimestamps, start, end, 4);
  }
  if (useMonths) {
    const first = new Date(start);
    const cursor = new Date(first.getFullYear(), first.getMonth(), 1);
    const points: ActivityPoint[] = [];
    while (cursor.getTime() <= end) {
      const bucketStart = cursor.getTime();
      const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      const bucketEnd = next.getTime();
      const count = workoutTimestamps.filter((timestamp) => timestamp >= bucketStart && timestamp < bucketEnd).length;
      points.push({
        count,
        label: `${new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(cursor)}: ${count} ${count === 1 ? "workout" : "workouts"}`,
        shortLabel: new Intl.DateTimeFormat(undefined, { month: "short" }).format(cursor),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return points;
  }

  if (timeframe === "week") {
    return Array.from({ length: 7 }, (_, index) => {
      const bucketStart = end - (7 - index) * DAY_MS;
      const bucketEnd = bucketStart + DAY_MS;
      const count = workoutTimestamps.filter(
        (timestamp) => timestamp >= bucketStart && (index === 6 ? timestamp <= bucketEnd : timestamp < bucketEnd),
      ).length;
      return {
        count,
        label: `${formatShortDate(bucketStart)}: ${count} ${count === 1 ? "workout" : "workouts"}`,
        shortLabel: new Intl.DateTimeFormat(undefined, { weekday: "narrow" }).format(bucketEnd),
      };
    });
  }

  return buildWeeklyActivityPoints(
    workoutTimestamps,
    start,
    end,
    timeframe === "month" ? 4 : Math.ceil((end - start) / WEEK_MS),
  );
}

export function splitVolumeTrend(tasks: RankTask[], dateKeys: string[]) {
  const orderedDateKeys = [...new Set(dateKeys)]
    .filter(Boolean)
    .sort((left, right) => dateKeyTimestamp(left) - dateKeyTimestamp(right));
  if (orderedDateKeys.length < 2) return null;

  const splitIndex = Math.floor(orderedDateKeys.length / 2);
  const priorDates = orderedDateKeys.slice(0, splitIndex);
  const recentDates = orderedDateKeys.slice(splitIndex);
  const priorAverage = averageVolumeForDates(tasks, priorDates);
  if (priorAverage <= 0) return null;

  const recentAverage = averageVolumeForDates(tasks, recentDates);
  const change = ((recentAverage - priorAverage) / priorAverage) * 100;
  return Math.round(Math.max(-999, Math.min(999, change)));
}
