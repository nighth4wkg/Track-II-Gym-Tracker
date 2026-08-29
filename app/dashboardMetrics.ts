import { calendarDateKey } from "./calendarTypes.ts";
import type { RankTask } from "./rankModels.ts";
import { MILLISECONDS_PER_DAY } from "./trackConstants.ts";

export type DashboardTimeframe = "week" | "month" | "ytd" | "all";
export type ActivityPoint = { count: number; label: string; shortLabel: string };

export type DashboardSessionMetric = {
  id: string;
  splitId?: string;
  createdAt: string;
  dateKey: string;
  volumeKg: number;
  setCount: number;
  exerciseCount: number;
};

export const DAY_MS = MILLISECONDS_PER_DAY;
export const WEEK_MS = DAY_MS * 7;
const MONTH_DAYS = 30;

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

export function startOfLocalDay(timestamp: number) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return 0;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function addLocalDays(timestamp: number, days: number) {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days).getTime();
}

/** Return the start of the local calendar week, using Monday as day one. */
export function startOfLocalWeek(timestamp: number) {
  const day = new Date(timestamp).getDay();
  return addLocalDays(startOfLocalDay(timestamp), -((day + 6) % 7));
}

function localDayCount(start: number, end: number) {
  return Math.max(1, Math.round((startOfLocalDay(end) - startOfLocalDay(start)) / DAY_MS) + 1);
}

function localMonthKey(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function formatCountLabel(prefix: string, count: number) {
  return `${prefix}: ${count} ${count === 1 ? "workout" : "workouts"}`;
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

/**
 * Build one metric row per logical workout session. Repeated finishes for the
 * same split on the same local calendar day share one identity; a different
 * split remains a separate session. Raw rows are never removed.
 */
export function aggregateSessions(tasks: RankTask[], workoutDates: Set<string> = new Set()) {
  const grouped = new Map<string, DashboardSessionMetric & { exercises: Set<string>; sets: Set<string> }>();
  for (const [index, task] of tasks.entries()) {
    const timestamp = performedTimestamp(task);
    const dateKey = timestamp > 0 ? calendarDateKey(new Date(timestamp)) : "";
    const splitId = task.splitId?.trim();
    const sessionKey =
      splitId && dateKey
        ? `split:${splitId}:date:${dateKey}`
        : task.sessionId?.trim() || (dateKey ? `legacy:${dateKey}` : `legacy-row:${index}`);
    const exerciseKey = task.exerciseId?.trim() || task.text.trim().toLocaleLowerCase();
    const existing = grouped.get(sessionKey);
    const taskSets = task.sets ?? [];
    const seenTaskSetNumbers = new Set<number>();
    const uniqueTaskSets = taskSets.filter((set) => {
      const setNumber = Number(set.setNumber);
      if (!Number.isFinite(setNumber)) return true;
      if (seenTaskSetNumbers.has(setNumber)) return false;
      seenTaskSetNumbers.add(setNumber);
      return true;
    });
    if (existing) {
      for (const [setIndex, set] of uniqueTaskSets.entries()) {
        const setNumber = Number(set.setNumber);
        const setKey = `${exerciseKey}:${Number.isFinite(setNumber) ? setNumber : `row:${setIndex}`}`;
        if (existing.sets.has(setKey)) continue;
        existing.sets.add(setKey);
        existing.volumeKg += weightKg(set.weight, set.unit) * Math.max(0, Number(set.reps) || 0);
        existing.setCount += 1;
      }
      if (exerciseKey) existing.exercises.add(exerciseKey);
      if (timestamp > 0 && timestamp < new Date(existing.createdAt).getTime()) {
        existing.createdAt = new Date(timestamp).toISOString();
        existing.dateKey = dateKey;
      }
      continue;
    }
    if (timestamp <= 0 || !dateKey) continue;
    grouped.set(sessionKey, {
      id: sessionKey,
      splitId,
      createdAt: new Date(timestamp).toISOString(),
      dateKey,
      volumeKg: uniqueTaskSets.reduce(
        (sum, set) => sum + weightKg(set.weight, set.unit) * Math.max(0, Number(set.reps) || 0),
        0,
      ),
      setCount: uniqueTaskSets.length,
      exerciseCount: exerciseKey ? 1 : 0,
      exercises: new Set(exerciseKey ? [exerciseKey] : []),
      sets: new Set(
        uniqueTaskSets.map((set, setIndex) => {
          const setNumber = Number(set.setNumber);
          return `${exerciseKey}:${Number.isFinite(setNumber) ? setNumber : `row:${setIndex}`}`;
        }),
      ),
    });
  }

  const knownDateKeys = new Set([...grouped.values()].map((session) => session.dateKey));
  for (const dateKey of workoutDates) {
    if (!dateKey || knownDateKeys.has(dateKey)) continue;
    const timestamp = dateKeyTimestamp(dateKey);
    if (!timestamp) continue;
    const id = `date:${dateKey}`;
    grouped.set(id, {
      id,
      createdAt: new Date(timestamp).toISOString(),
      dateKey,
      volumeKg: 0,
      setCount: 0,
      exerciseCount: 0,
      exercises: new Set(),
      sets: new Set(),
    });
  }

  return [...grouped.values()]
    .map((session) => ({
      id: session.id,
      splitId: session.splitId,
      createdAt: session.createdAt,
      dateKey: session.dateKey,
      volumeKg: session.volumeKg,
      setCount: session.setCount,
      exerciseCount: session.exercises.size || session.exerciseCount,
    }))
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
}

export function timeframeBounds(timeframe: DashboardTimeframe, timestamps: number[], now: number) {
  const sorted = timestamps.filter((value) => value > 0).sort((left, right) => left - right);
  const today = startOfLocalDay(now);
  const firstLog = startOfLocalDay(sorted[0] ?? now) || today;
  const currentYearStart = new Date(new Date(now).getFullYear(), 0, 1).getTime();
  if (timeframe === "all") return { start: firstLog, end: now };
  if (timeframe === "ytd") return { start: Math.max(firstLog, currentYearStart), end: now };
  if (timeframe === "week") return { start: startOfLocalWeek(now), end: now };
  const durationDays = MONTH_DAYS;
  return { start: addLocalDays(today, -(durationDays - 1)), end: now };
}

export function formatShortDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(timestamp);
}

function countIntoBuckets(workoutTimestamps: number[], starts: number[], ends: number[]) {
  const counts = Array.from({ length: starts.length }, () => 0);
  let bucketIndex = 0;
  for (const timestamp of [...workoutTimestamps].filter((value) => value > 0).sort((a, b) => a - b)) {
    while (bucketIndex < starts.length && timestamp >= ends[bucketIndex]) bucketIndex += 1;
    if (bucketIndex >= starts.length) break;
    if (timestamp >= starts[bucketIndex]) counts[bucketIndex] += 1;
  }
  return counts;
}

function buildDailyActivityPoints(workoutTimestamps: number[], end: number) {
  const weekStart = startOfLocalWeek(end);
  const starts = Array.from({ length: 7 }, (_, index) => addLocalDays(weekStart, index));
  const ends = starts.map((start) => addLocalDays(start, 1));
  const counts = countIntoBuckets(workoutTimestamps, starts, ends);
  const weekdayLabels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  return starts.map((bucketStart, index) => {
    const count = counts[index];
    return {
      count,
      label: formatCountLabel(formatShortDate(bucketStart), count),
      shortLabel: weekdayLabels[new Date(bucketStart).getDay()],
    };
  });
}

function buildWeeklyActivityPoints(workoutTimestamps: number[], start: number, end: number, requestedWeeks: number) {
  const totalDays = localDayCount(start, end);
  const weeks = Math.max(1, Math.min(requestedWeeks, totalDays));
  const firstDay = startOfLocalDay(start);
  const starts = Array.from({ length: weeks }, (_, index) =>
    addLocalDays(firstDay, Math.floor((index * totalDays) / weeks)),
  );
  const ends = starts.map((_, index) =>
    index === weeks - 1
      ? addLocalDays(startOfLocalDay(end), 1)
      : addLocalDays(firstDay, Math.floor(((index + 1) * totalDays) / weeks)),
  );
  const counts = countIntoBuckets(workoutTimestamps, starts, ends);
  return starts.map((bucketStart, index) => {
    const count = counts[index];
    return {
      count,
      label: formatCountLabel(`Week of ${formatShortDate(bucketStart)}`, count),
      shortLabel: formatShortDate(bucketStart),
    };
  });
}

function buildMonthlyActivityPoints(workoutTimestamps: number[], start: number, end: number) {
  const first = new Date(startOfLocalDay(start));
  const cursor = new Date(first.getFullYear(), first.getMonth(), 1);
  const starts: number[] = [];
  const ends: number[] = [];
  while (cursor.getTime() <= end) {
    starts.push(cursor.getTime());
    ends.push(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1).getTime());
    cursor.setMonth(cursor.getMonth() + 1);
  }
  const counts = countIntoBuckets(workoutTimestamps, starts, ends);
  return starts.map((bucketStart, index) => {
    const count = counts[index];
    const date = new Date(bucketStart);
    return {
      count,
      label: formatCountLabel(
        new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(date),
        count,
      ),
      shortLabel: new Intl.DateTimeFormat(undefined, { month: "short" }).format(date),
    };
  });
}

export function buildActivityPoints(
  workoutTimestamps: number[],
  timeframe: DashboardTimeframe,
  start: number,
  end: number,
): ActivityPoint[] {
  const inRangeTimestamps = workoutTimestamps.filter((timestamp) => timestamp >= start && timestamp <= end);
  const monthsInRange = new Set(inRangeTimestamps.map(localMonthKey));
  if (timeframe === "week") return buildDailyActivityPoints(workoutTimestamps, end);

  const useMonths = timeframe === "ytd" || (timeframe === "all" && end - start > 12 * WEEK_MS);
  if (useMonths && monthsInRange.size > 1) return buildMonthlyActivityPoints(workoutTimestamps, start, end);
  if (useMonths && inRangeTimestamps.length) {
    const focusedStart = startOfLocalDay(Math.min(...inRangeTimestamps));
    return buildWeeklyActivityPoints(workoutTimestamps, focusedStart, end, 4);
  }
  return buildWeeklyActivityPoints(
    workoutTimestamps,
    start,
    end,
    timeframe === "month" ? 4 : Math.max(2, Math.ceil(localDayCount(start, end) / 7)),
  );
}

export function averageVolumeForSessions(sessions: DashboardSessionMetric[]) {
  if (!sessions.length) return 0;
  return sessions.reduce((sum, session) => sum + Math.max(0, session.volumeKg), 0) / sessions.length;
}

export function splitVolumeTrendForSessions(sessions: DashboardSessionMetric[]) {
  const ordered = [...sessions].sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );
  if (ordered.length < 2) return null;
  const splitIndex = Math.floor(ordered.length / 2);
  const prior = ordered.slice(0, splitIndex);
  const recent = ordered.slice(splitIndex);
  const priorAverage = averageVolumeForSessions(prior);
  if (priorAverage <= 0) return null;
  return Math.round(
    Math.max(-999, Math.min(999, ((averageVolumeForSessions(recent) - priorAverage) / priorAverage) * 100)),
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
