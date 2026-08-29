import { supabase } from "../supabase";
import type { JsonValue, WeightUnit } from "../trackTypes";
import { isJsonObject, isMissingTrackFunction, isStringValue } from "../trackUtils";
import { fetchAllPages } from "./pagination";

export type PreviousSet = {
  weight: number;
  unit: WeightUnit;
  reps: number;
  rir: number;
  historySessions?: number;
  historySamples?: number;
  historyFailureCount?: number;
};

export type PreviousSetMaps = {
  latestByExercise: Map<string, PreviousSet>;
  latestBySplitAndName: Map<string, PreviousSet>;
  latestByName: Map<string, PreviousSet>;
  error: boolean;
};

export function normalizedHistoryName(value: JsonValue | undefined) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
}

type HistorySummaryRow = {
  matchScope: "exercise" | "split-name" | "name";
  exerciseId: string | null;
  splitId: string | null;
  normalizedName: string;
  setNumber: number;
  previous: PreviousSet;
};

export function emptyPreviousSetMaps(error = false): PreviousSetMaps {
  return {
    latestByExercise: new Map(),
    latestBySplitAndName: new Map(),
    latestByName: new Map(),
    error,
  };
}

function historySummaryRow(value: JsonValue): HistorySummaryRow | null {
  if (!isJsonObject(value)) return null;
  const matchScope = value.match_scope;
  if (matchScope !== "exercise" && matchScope !== "split-name" && matchScope !== "name") return null;
  const setNumber = Number(value.set_number);
  const weight = Number(value.weight);
  const reps = Number(value.reps);
  const rir = Number(value.rir);
  if (![setNumber, weight, reps, rir].every(Number.isFinite)) return null;
  const historySessions = Number(value.history_sessions);
  const historySamples = Number(value.history_samples);
  const historyFailureCount = Number(value.history_failure_count);
  return {
    matchScope,
    exerciseId: isStringValue(value.exercise_id) ? value.exercise_id : null,
    splitId: isStringValue(value.split_id) ? value.split_id : null,
    normalizedName: isStringValue(value.normalized_name) ? value.normalized_name : "",
    setNumber,
    previous: {
      weight,
      unit: value.unit === "lb" ? "lb" : "kg",
      reps,
      rir,
      historySessions: Number.isFinite(historySessions) ? Math.max(1, Math.floor(historySessions)) : undefined,
      historySamples: Number.isFinite(historySamples) ? Math.max(1, Math.floor(historySamples)) : undefined,
      historyFailureCount: Number.isFinite(historyFailureCount)
        ? Math.max(0, Math.floor(historyFailureCount))
        : undefined,
    },
  };
}

function mapHistorySummaries(rows: HistorySummaryRow[]): PreviousSetMaps {
  const mapped = emptyPreviousSetMaps();
  for (const row of rows) {
    if (row.matchScope === "exercise" && row.exerciseId) {
      mapped.latestByExercise.set(`${row.exerciseId}:${row.setNumber}`, row.previous);
    } else if (row.matchScope === "split-name" && row.splitId && row.normalizedName) {
      mapped.latestBySplitAndName.set(`${row.splitId}:${row.normalizedName}:${row.setNumber}`, row.previous);
    } else if (row.matchScope === "name" && row.normalizedName) {
      mapped.latestByName.set(`${row.normalizedName}:${row.setNumber}`, row.previous);
    }
  }
  return mapped;
}

export async function fetchPreviousSetMaps(rememberAcrossSplits: boolean): Promise<PreviousSetMaps> {
  const progressionSummary = await supabase.rpc("get_progression_workout_set_history", {
    remember_across_splits: rememberAcrossSplits,
  });
  if (!progressionSummary.error) {
    const payload: JsonValue = Array.isArray(progressionSummary.data) ? progressionSummary.data : [];
    const rows = Array.isArray(payload)
      ? payload.flatMap((value) => {
          const row = historySummaryRow(value);
          return row ? [row] : [];
        })
      : [];
    return mapHistorySummaries(rows);
  }
  if (!isMissingTrackFunction(progressionSummary.error)) return emptyPreviousSetMaps(true);

  // Compatibility fallback for a deployment that has the compact latest-set
  // RPC but not the additive evidence summary yet. The default evidence count
  // stays conservative, so older databases cannot trigger a load increase.
  const summary = await supabase.rpc("get_latest_workout_set_history", {
    remember_across_splits: rememberAcrossSplits,
  });
  if (!summary.error) {
    const payload: JsonValue = Array.isArray(summary.data) ? summary.data : [];
    const rows = Array.isArray(payload)
      ? payload.flatMap((value) => {
          const row = historySummaryRow(value);
          return row ? [row] : [];
        })
      : [];
    return mapHistorySummaries(rows);
  }
  if (!isMissingTrackFunction(summary.error)) return emptyPreviousSetMaps(true);

  // Compatibility fallback for an older deployment. Once the additive history
  // read migration is applied, normal clients use only the compact RPC.
  type LogRow = {
    session_id: string | null;
    exercise_id: string | null;
    exercise_name: string;
    set_number: number;
    weight: number;
    unit: string;
    reps: number;
    rir: number;
    created_at: string;
  };
  type SessionRow = { id: string; split_id: string | null };
  const [logs, sessions] = await Promise.all([
    fetchAllPages<LogRow>((from, to) =>
      supabase
        .from("workout_set_logs")
        .select("session_id,exercise_id,exercise_name,set_number,weight,unit,reps,rir,created_at")
        .order("created_at", { ascending: false })
        .range(from, to),
    ),
    fetchAllPages<SessionRow>((from, to) =>
      supabase.from("workout_sessions").select("id,split_id").order("created_at", { ascending: false }).range(from, to),
    ),
  ]);
  if (logs.error || sessions.error) return emptyPreviousSetMaps(true);
  const sessionSplits = new Map(sessions.rows.map((session) => [session.id, session.split_id]));
  const rows: HistorySummaryRow[] = [];
  const seen = new Set<string>();
  for (const row of logs.rows) {
    const setNumber = Number(row.set_number);
    const normalizedName = normalizedHistoryName(row.exercise_name);
    const splitId = row.session_id ? sessionSplits.get(row.session_id) : null;
    const previous: PreviousSet = {
      weight: Number(row.weight),
      unit: row.unit === "lb" ? "lb" : "kg",
      reps: Number(row.reps),
      rir: Number(row.rir),
      historySessions: 1,
      historySamples: 1,
      historyFailureCount: 0,
    };
    const candidates: HistorySummaryRow[] = [];
    if (row.exercise_id)
      candidates.push({
        matchScope: "exercise",
        exerciseId: row.exercise_id,
        splitId: null,
        normalizedName,
        setNumber,
        previous,
      });
    if (splitId && normalizedName)
      candidates.push({
        matchScope: "split-name",
        exerciseId: null,
        splitId,
        normalizedName,
        setNumber,
        previous,
      });
    if (rememberAcrossSplits && normalizedName)
      candidates.push({
        matchScope: "name",
        exerciseId: null,
        splitId: null,
        normalizedName,
        setNumber,
        previous,
      });
    for (const candidate of candidates) {
      const key = `${candidate.matchScope}:${candidate.exerciseId ?? ""}:${candidate.splitId ?? ""}:${candidate.normalizedName}:${candidate.setNumber}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(candidate);
    }
  }
  return mapHistorySummaries(rows);
}
