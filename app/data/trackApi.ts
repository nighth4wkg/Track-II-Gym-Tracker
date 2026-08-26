import { calendarDateKey } from "../calendarTypes";
import { parseDashboardSummary, type DashboardSummary } from "../dashboardSummary";
import { rankHistoryGroupKey, type RankHistoryRow } from "../historyKeys";
import { supabase } from "../supabase";
import type { RankTask } from "../rankData";
import { MILLISECONDS_PER_DAY, TRACK_LIMITS } from "../trackConstants";
import type { Checklist, JsonValue, TrackSaveResult, WeightUnit, WorkoutSaveResult } from "../trackTypes";
import {
  convertWeight,
  isCompleteTrackState,
  isJsonObject,
  isMissingTrackFunction,
  isStringValue,
  trackStatePayload,
} from "../trackUtils";
import { fetchAllPages } from "./pagination";

function normalizedHistoryName(value: JsonValue | undefined) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
}

type PreviousSet = { weight: number; unit: WeightUnit; reps: number; rir: number };
type PreviousSetMaps = {
  latestByExercise: Map<string, PreviousSet>;
  latestBySplitAndName: Map<string, PreviousSet>;
  latestByName: Map<string, PreviousSet>;
  error: boolean;
};

type HistorySummaryRow = {
  matchScope: "exercise" | "split-name" | "name";
  exerciseId: string | null;
  splitId: string | null;
  normalizedName: string;
  setNumber: number;
  previous: PreviousSet;
};

function emptyPreviousSetMaps(error = false): PreviousSetMaps {
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
  return {
    matchScope,
    exerciseId: isStringValue(value.exercise_id) ? value.exercise_id : null,
    splitId: isStringValue(value.split_id) ? value.split_id : null,
    normalizedName: isStringValue(value.normalized_name) ? value.normalized_name : "",
    setNumber,
    previous: { weight, unit: value.unit === "lb" ? "lb" : "kg", reps, rir },
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

async function fetchPreviousSetMaps(rememberAcrossSplits: boolean): Promise<PreviousSetMaps> {
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

  // Compatibility fallback for an older deployment. Once the additive
  // history-read migration is applied, normal clients use only the compact RPC.
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

export async function fetchWorkoutDateKeys(userId: string) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const summary = await supabase.rpc("get_workout_date_keys", { time_zone: timeZone });
  if (!summary.error) {
    const payload: JsonValue = Array.isArray(summary.data) ? summary.data : [];
    return new Set(
      Array.isArray(payload)
        ? payload.flatMap((value) => (isJsonObject(value) && isStringValue(value.date_key) ? [value.date_key] : []))
        : [],
    );
  }
  if (!isMissingTrackFunction(summary.error)) return null;

  // Compatibility fallback for deployments that have not applied the compact
  // date-summary RPC yet. It remains owner-scoped and never changes data.
  const [sessions, logs] = await Promise.all([
    fetchAllPages<{ created_at: string }>((from, to) =>
      supabase
        .from("workout_sessions")
        .select("created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .range(from, to),
    ),
    fetchAllPages<{ created_at: string }>((from, to) =>
      supabase
        .from("workout_set_logs")
        .select("created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .range(from, to),
    ),
  ]);
  if (sessions.error || logs.error) return null;
  return new Set(
    [...sessions.rows, ...logs.rows].flatMap((row) => {
      const date = new Date(row.created_at);
      return Number.isNaN(date.getTime()) ? [] : [calendarDateKey(date)];
    }),
  );
}

export async function fetchRecentRankTasks(
  userId: string,
  historyDays: number | null = TRACK_LIMITS.rankHistoryDays,
): Promise<RankTask[]> {
  const cutoff = historyDays === null ? null : new Date(Date.now() - historyDays * MILLISECONDS_PER_DAY).toISOString();
  const { rows, error } = await fetchAllPages<RankHistoryRow>((from, to) =>
    (cutoff
      ? supabase
          .from("workout_set_logs")
          .select("session_id,exercise_id,exercise_name,set_number,weight,unit,reps,rir,created_at")
          .eq("user_id", userId)
          .gte("created_at", cutoff)
      : supabase
          .from("workout_set_logs")
          .select("session_id,exercise_id,exercise_name,set_number,weight,unit,reps,rir,created_at")
          .eq("user_id", userId)
    )
      .order("created_at", { ascending: false })
      .range(from, to),
  );
  if (error) return [];
  const grouped = new Map<string, RankTask>();
  for (const [index, row] of rows.entries()) {
    const exerciseName = String(row.exercise_name ?? "").trim();
    if (!exerciseName) continue;
    const exerciseId = row.exercise_id ? String(row.exercise_id) : undefined;
    const sessionId = row.session_id ? String(row.session_id) : undefined;
    const key = rankHistoryGroupKey(row, index);
    const task = grouped.get(key) ?? {
      exerciseId,
      sessionId,
      text: exerciseName,
      sets: [],
      performedAt: String(row.created_at),
      source: "history" as const,
    };
    task.sets!.push({
      setNumber: Number(row.set_number) || undefined,
      weight: Number(row.weight) || 0,
      unit: row.unit === "lb" ? "lb" : "kg",
      reps: Number(row.reps) || 0,
      rir: Number(row.rir) || 0,
    });
    grouped.set(key, task);
  }
  return [...grouped.values()];
}

export async function fetchDashboardSummary(): Promise<DashboardSummary | null> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const { data, error } = await supabase.rpc("get_dashboard_summary", { time_zone: timeZone });
  if (error || !isJsonObject(data)) return null;
  return parseDashboardSummary(data);
}

export async function fetchSavedSplitIdsForToday(userId: string) {
  // Use the browser's local day boundaries when asking the server. Filtering a
  // large, limited result set in the browser can miss today's session and the
  // UTC date in the row can differ from the user's local date near midnight.
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const { rows, error } = await fetchAllPages<{ split_id: string | null; created_at: string }>((from, to) =>
    supabase
      .from("workout_sessions")
      .select("split_id,created_at")
      .eq("user_id", userId)
      .gte("created_at", startOfToday.toISOString())
      .lt("created_at", startOfTomorrow.toISOString())
      .order("created_at", { ascending: false })
      .range(from, to),
  );
  if (error) return null;
  return new Set(rows.filter((row) => row.split_id).map((row) => String(row.split_id)));
}

export async function fetchOnlineLists(
  rememberAcrossSplits = false,
  options: { includeHistory?: boolean } = {},
): Promise<{ lists: Checklist[]; error: boolean }> {
  const includeHistory = options.includeHistory ?? true;
  type SplitRow = { id: string; name: string; updated_at: string };
  type ExerciseRow = { id: string; split_id: string; name: string; completed: boolean };
  type SetRow = {
    id: string;
    exercise_id: string;
    set_number: number;
    weight: number;
    unit: string;
    reps: number;
    rir: number;
  };
  const [splits, exercises, sets, previousSets] = await Promise.all([
    fetchAllPages<SplitRow>((from, to) =>
      supabase.from("splits").select("id,name,updated_at").order("position").range(from, to),
    ),
    fetchAllPages<ExerciseRow>((from, to) =>
      supabase.from("exercises").select("id,split_id,name,completed").order("position").range(from, to),
    ),
    fetchAllPages<SetRow>((from, to) =>
      supabase
        .from("exercise_sets")
        .select("id,exercise_id,set_number,weight,unit,reps,rir")
        .order("set_number")
        .range(from, to),
    ),
    includeHistory ? fetchPreviousSetMaps(rememberAcrossSplits) : Promise.resolve(emptyPreviousSetMaps()),
  ]);
  if (splits.error || exercises.error || sets.error || previousSets.error) return { lists: [], error: true };
  const splitRows = splits.rows;
  const exerciseRows = exercises.rows;
  const setRows = sets.rows;
  const { latestByExercise, latestBySplitAndName, latestByName } = previousSets;
  const exercisesBySplit = new Map<string, ExerciseRow[]>();
  for (const exercise of exerciseRows) {
    const exercisesForSplit = exercisesBySplit.get(exercise.split_id) ?? [];
    exercisesForSplit.push(exercise);
    exercisesBySplit.set(exercise.split_id, exercisesForSplit);
  }
  const setsByExercise = new Map<string, SetRow[]>();
  for (const set of setRows) {
    const setsForExercise = setsByExercise.get(set.exercise_id) ?? [];
    setsForExercise.push(set);
    setsByExercise.set(set.exercise_id, setsForExercise);
  }
  const lists: Checklist[] = (splitRows ?? []).map((split) => ({
    id: split.id,
    title: split.name,
    updatedAt: new Date(split.updated_at).getTime(),
    tasks: (exercisesBySplit.get(split.id) ?? []).map((exercise) => ({
      id: exercise.id,
      text: exercise.name,
      reps: "1",
      rir: "0",
      done: exercise.completed,
      sets: (setsByExercise.get(exercise.id) ?? []).map((set) => {
        const setNumber = Number(set.set_number);
        const normalizedName = normalizedHistoryName(exercise.name);
        const previous =
          latestByExercise.get(`${exercise.id}:${setNumber}`) ??
          (rememberAcrossSplits
            ? latestByName.get(`${normalizedName}:${setNumber}`)
            : latestBySplitAndName.get(`${split.id}:${normalizedName}:${setNumber}`));
        const unit: WeightUnit = set.unit === "lb" ? "lb" : "kg";
        const lastWeight = previous ? convertWeight(previous.weight, previous.unit, unit) : undefined;
        return {
          id: set.id,
          weight: String(set.weight),
          unit,
          reps: String(set.reps),
          rir: String(set.rir),
          lastWeight,
          lastWeightUnit: lastWeight === undefined ? undefined : unit,
          lastReps: previous?.reps,
          lastRir: previous?.rir,
        };
      }),
    })),
  }));
  return { lists, error: false };
}

export async function fetchTrackRevision(userId: string): Promise<number | null> {
  const dashboardRevision = await supabase.rpc("get_dashboard_revision");
  if (!dashboardRevision.error && dashboardRevision.data !== null && dashboardRevision.data !== undefined) {
    const revision = Number(dashboardRevision.data);
    if (Number.isFinite(revision)) return Math.max(0, revision);
  }
  const { data, error } = await supabase
    .from("track_state_revisions")
    .select("revision")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return null;
  return Math.max(0, Number(data?.revision) || 0);
}

export async function saveTrackState(lists: Checklist[], expectedRevision: number): Promise<TrackSaveResult> {
  if (!isCompleteTrackState(lists))
    return { ok: false, message: "Track saving was blocked because the workout data was incomplete." };
  const payload = trackStatePayload(lists);
  const incrementalResult = await supabase.rpc("save_track_state_incremental", {
    state: payload,
    expected_revision: expectedRevision,
  });
  const parseResult = (data: JsonValue | JsonValue[] | null | undefined, method: "incremental" | "transaction") => {
    // Parse the small JSON contract returned by either save RPC at the
    // PostgREST boundary; older deployments may wrap one row in an array.
    const result = isJsonObject(Array.isArray(data) ? data[0] : data) ? (Array.isArray(data) ? data[0] : data) : null;
    const conflict = isJsonObject(result) && result.conflict === true;
    const revision = isJsonObject(result) ? Number(result.revision) : NaN;
    if (conflict)
      return { ok: false as const, conflict: true, revision: Number.isFinite(revision) ? revision : expectedRevision };
    return { ok: true as const, revision: Number.isFinite(revision) ? revision : expectedRevision + 1, method };
  };
  if (!incrementalResult.error) return parseResult(incrementalResult.data, "incremental");
  if (!isMissingTrackFunction(incrementalResult.error)) return { ok: false, message: incrementalResult.error.message };

  // Older deployments do not have the incremental function yet. Keep the
  // original transactional RPC as a safe compatibility fallback until the
  // migration is applied; never fall back after a real database error.
  const { data, error } = await supabase.rpc("save_track_state", {
    state: payload,
    expected_revision: expectedRevision,
  });
  if (!error) {
    return parseResult(data, "transaction");
  }
  if (!isMissingTrackFunction(error)) return { ok: false, message: error.message };
  return { ok: false, message: "Track saving is unavailable until the current database migrations are applied." };
}

export async function saveWorkoutSession(
  splitId: string,
  splitName: string,
  logs: Array<{
    exerciseId: string;
    exerciseName: string;
    setNumber: number;
    weight: number;
    unit: WeightUnit;
    reps: number;
    rir: number;
  }>,
  clientMutationId: string,
): Promise<WorkoutSaveResult> {
  const { data, error } = await supabase.rpc("save_workout_session", {
    payload: { splitId, splitName, clientMutationId, logs },
  });
  if (!error) {
    // SAFETY: save_workout_session returns one row with this documented result
    // shape; the array branch handles PostgREST's single-row representation.
    const result = (Array.isArray(data) ? data[0] : data) as { ok?: boolean; sessionId?: string } | null;
    if (result?.ok && result.sessionId) return { ok: true, sessionId: result.sessionId, method: "transaction" };
    return { ok: false, message: "The workout response was incomplete." };
  }
  if (!isMissingTrackFunction(error)) return { ok: false, message: error.message };
  return { ok: false, message: "Workout history is unavailable until the current database migrations are applied." };
}
