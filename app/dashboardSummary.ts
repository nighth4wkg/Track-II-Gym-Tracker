import type { DashboardSessionMetric } from "./dashboardMetrics.ts";
import type { DashboardTimeframe } from "./dashboardMetrics.ts";
import { isJsonObject, isStringValue } from "./trackUtils.ts";
import type { JsonValue } from "./trackTypes.ts";

export type DashboardProgressSummary = {
  id: string;
  exercise: string;
  createdAt: string;
  weight: number;
  unit: "kg" | "lb";
  reps: number;
  isPr: boolean;
};

export type DashboardWeeklyExerciseSet = {
  exerciseId: string | null;
  exerciseName: string;
  setCount: number;
};

export type DashboardVolumePeriod = {
  startDate: string;
  endDate: string;
  sessionCount: number;
  volumeKg: number;
};

export type DashboardMuscleGroup = "back" | "core" | "legs" | "arms" | "chest" | "shoulders";

export type DashboardWeeklyMuscleTotal = {
  group: DashboardMuscleGroup;
  setCount: number;
};

export type DashboardSummary = {
  revision: number;
  sessionCount: number;
  firstLogAt: string | null;
  latestLogAt: string | null;
  sessions: DashboardSessionMetric[];
  volumeByPeriod: Partial<Record<DashboardTimeframe, DashboardVolumePeriod>>;
  progressFeed: DashboardProgressSummary[];
  weeklyExerciseSets: DashboardWeeklyExerciseSet[];
  weeklyMuscleTotals: DashboardWeeklyMuscleTotal[];
};

function stringValue(value: JsonValue | undefined) {
  return isStringValue(value) ? value.trim() : "";
}

function finiteNumber(value: JsonValue | undefined, fallback = 0) {
  if (!Number.isFinite(value)) return fallback;
  // SAFETY: Number.isFinite rejects every non-number JsonValue; the remaining value is a finite numeric RPC field.
  return value as number;
}

function parseSession(value: JsonValue): DashboardSessionMetric | null {
  if (!isJsonObject(value)) return null;
  const id = stringValue(value.id);
  const createdAt = stringValue(value.createdAt);
  const dateKey = stringValue(value.dateKey);
  if (!id || !createdAt || !dateKey || !Number.isFinite(new Date(createdAt).getTime())) return null;
  const splitId = stringValue(value.splitId);
  return {
    id,
    splitId: splitId || undefined,
    createdAt,
    dateKey,
    volumeKg: Math.max(0, finiteNumber(value.volumeKg)),
    setCount: Math.max(0, Math.round(finiteNumber(value.setCount))),
    exerciseCount: Math.max(0, Math.round(finiteNumber(value.exerciseCount))),
  };
}

function parseProgressItem(value: JsonValue, index: number): DashboardProgressSummary | null {
  if (!isJsonObject(value)) return null;
  const exercise = stringValue(value.exercise);
  const createdAt = stringValue(value.createdAt);
  if (!exercise || !createdAt || !Number.isFinite(new Date(createdAt).getTime())) return null;
  return {
    id: stringValue(value.id) || `progress-${index}`,
    exercise,
    createdAt,
    weight: Math.max(0, finiteNumber(value.weight)),
    unit: value.unit === "lb" ? "lb" : "kg",
    reps: Math.max(0, Math.round(finiteNumber(value.reps))),
    isPr: value.isPr === true,
  };
}

function parseWeeklyExerciseSet(value: JsonValue): DashboardWeeklyExerciseSet | null {
  if (!isJsonObject(value)) return null;
  const exerciseName = stringValue(value.exerciseName);
  if (!exerciseName) return null;
  const exerciseId = stringValue(value.exerciseId);
  return {
    exerciseId: exerciseId || null,
    exerciseName,
    setCount: Math.max(0, Math.round(finiteNumber(value.setCount))),
  };
}

function parseVolumePeriod(value: JsonValue): DashboardVolumePeriod | null {
  if (!isJsonObject(value)) return null;
  const startDate = stringValue(value.startDate);
  const endDate = stringValue(value.endDate);
  if (!startDate || !endDate) return null;
  return {
    startDate,
    endDate,
    sessionCount: Math.max(0, Math.round(finiteNumber(value.sessionCount))),
    volumeKg: Math.max(0, finiteNumber(value.volumeKg)),
  };
}

function parseWeeklyMuscleTotal(value: JsonValue): DashboardWeeklyMuscleTotal | null {
  if (!isJsonObject(value)) return null;
  const group = value.group;
  if (
    group !== "back" &&
    group !== "core" &&
    group !== "legs" &&
    group !== "arms" &&
    group !== "chest" &&
    group !== "shoulders"
  ) {
    return null;
  }
  return { group, setCount: Math.max(0, Math.round(finiteNumber(value.setCount))) };
}

export function parseDashboardSummary(value: JsonValue): DashboardSummary | null {
  if (!isJsonObject(value)) return null;
  const sessions = Array.isArray(value.sessions)
    ? value.sessions.flatMap((item) => {
        const parsed = parseSession(item);
        return parsed ? [parsed] : [];
      })
    : [];
  const progressFeed = Array.isArray(value.progressFeed)
    ? value.progressFeed.flatMap((item, index) => {
        const parsed = parseProgressItem(item, index);
        return parsed ? [parsed] : [];
      })
    : [];
  const weeklyExerciseSets = Array.isArray(value.weeklyExerciseSets)
    ? value.weeklyExerciseSets.flatMap((item) => {
        const parsed = parseWeeklyExerciseSet(item);
        return parsed ? [parsed] : [];
      })
    : [];
  const volumeByPeriod: Partial<Record<DashboardTimeframe, DashboardVolumePeriod>> = {};
  if (isJsonObject(value.volumeByPeriod)) {
    for (const timeframe of ["week", "month", "ytd", "all"] as const) {
      const parsed = parseVolumePeriod(value.volumeByPeriod[timeframe]);
      if (parsed) volumeByPeriod[timeframe] = parsed;
    }
  }
  const weeklyMuscleTotals = Array.isArray(value.weeklyMuscleTotals)
    ? value.weeklyMuscleTotals.flatMap((item) => {
        const parsed = parseWeeklyMuscleTotal(item);
        return parsed ? [parsed] : [];
      })
    : [];
  const sessionCount = Math.max(0, Math.round(finiteNumber(value.sessionCount, sessions.length)));
  return {
    revision: Math.max(0, Math.round(finiteNumber(value.revision))),
    sessionCount,
    firstLogAt: stringValue(value.firstLogAt) || null,
    latestLogAt: stringValue(value.latestLogAt) || null,
    sessions,
    volumeByPeriod,
    progressFeed,
    weeklyExerciseSets,
    weeklyMuscleTotals,
  };
}
