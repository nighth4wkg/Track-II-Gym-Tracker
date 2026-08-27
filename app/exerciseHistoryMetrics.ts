import type { ExerciseHistoryEntry, WeightUnit } from "./trackTypes.ts";

const KILOGRAMS_PER_POUND = 2.2046226218;
export const HISTORY_TREND_POINT_LIMIT = 8;

export type ExerciseHistoryGroup = {
  key: string;
  dateTime: string;
  dateLabel: string;
  entries: ExerciseHistoryEntry[];
};

export type ExerciseHistoryTrendPoint = {
  key: string;
  label: string;
  valueKg: number;
};

export type ExerciseHistorySummary = {
  sessionCount: number;
  displayUnit: WeightUnit;
  bestWeightKg: number;
  bestVolumeKg: number;
};

export function weightInKg(weight: number, unit: WeightUnit) {
  const value = Math.max(0, Number(weight) || 0);
  return unit === "lb" ? value / KILOGRAMS_PER_POUND : value;
}

export function valueInUnit(valueKg: number, unit: WeightUnit) {
  return unit === "lb" ? valueKg * KILOGRAMS_PER_POUND : valueKg;
}

export function volumeLoadInKg(entry: ExerciseHistoryEntry) {
  return weightInKg(entry.weight, entry.unit) * Math.max(0, entry.reps);
}

export function estimatedOneRepMaxInKg(entry: ExerciseHistoryEntry) {
  const reps = Math.max(1, Math.min(30, entry.reps));
  return weightInKg(entry.weight, entry.unit) * (1 + reps / 30);
}

export function localDateKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function logicalHistorySessionKey(entry: Pick<ExerciseHistoryEntry, "sessionId" | "splitId" | "createdAt">) {
  const dateKey = localDateKey(entry.createdAt);
  const splitId = entry.splitId?.trim();
  if (splitId && dateKey !== "unknown") return `split:${splitId}:date:${dateKey}`;
  return entry.sessionId?.trim() || `date:${dateKey}`;
}

/**
 * Repeated Finish actions can leave a second raw copy of the same set. Keep
 * every database row, but show one logical set per split/day/set number.
 */
export function collapseHistoryEntries(entries: readonly ExerciseHistoryEntry[]) {
  const collapsed = new Map<string, ExerciseHistoryEntry>();
  for (const entry of entries) {
    const setNumber = Number(entry.setNumber);
    const setKey = `${logicalHistorySessionKey(entry)}:${Number.isFinite(setNumber) ? setNumber : entry.id}`;
    const current = collapsed.get(setKey);
    if (!current || new Date(entry.createdAt).getTime() > new Date(current.createdAt).getTime()) {
      collapsed.set(setKey, entry);
    }
  }
  return [...collapsed.values()].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

export function formatHistoryDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown date"
    : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function formatHistoryShortDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown"
    : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

export function groupHistoryEntries(entries: readonly ExerciseHistoryEntry[]) {
  const groups = new Map<string, ExerciseHistoryGroup>();
  for (const entry of entries) {
    const key = localDateKey(entry.createdAt);
    const current = groups.get(key);
    if (current) {
      current.entries.push(entry);
      continue;
    }
    groups.set(key, {
      key,
      dateTime: entry.createdAt,
      dateLabel: formatHistoryDate(entry.createdAt),
      entries: [entry],
    });
  }
  return [...groups.values()];
}

export function summarizeHistory(entries: readonly ExerciseHistoryEntry[]): ExerciseHistorySummary {
  const sessionKeys = new Set(entries.map((entry) => logicalHistorySessionKey(entry)));
  const displayUnit = entries[0]?.unit ?? "kg";
  const bestWeightKg = entries.reduce((best, entry) => Math.max(best, weightInKg(entry.weight, entry.unit)), 0);
  const bestVolumeKg = entries.reduce((best, entry) => Math.max(best, volumeLoadInKg(entry)), 0);
  return {
    sessionCount: sessionKeys.size,
    displayUnit,
    bestWeightKg,
    bestVolumeKg,
  };
}

export function buildHistoryTrendPoints(groups: readonly ExerciseHistoryGroup[], limit = HISTORY_TREND_POINT_LIMIT) {
  return groups
    .slice(0, limit)
    .reverse()
    .map((group): ExerciseHistoryTrendPoint => {
      const bestEntry = group.entries.reduce<ExerciseHistoryEntry | null>(
        (best, entry) => (!best || estimatedOneRepMaxInKg(entry) > estimatedOneRepMaxInKg(best) ? entry : best),
        null,
      );
      return {
        key: group.key,
        label: formatHistoryShortDate(group.dateTime),
        valueKg: bestEntry ? estimatedOneRepMaxInKg(bestEntry) : 0,
      };
    })
    .filter((point) => point.valueKg > 0);
}
