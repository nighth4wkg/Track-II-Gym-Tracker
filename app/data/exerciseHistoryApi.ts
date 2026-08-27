import type { ExerciseHistoryEntry } from "../trackTypes";
import { supabase } from "../supabase";
import { fetchAllPages } from "./pagination";

type HistoryRow = {
  id: string;
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

export async function fetchExerciseHistory(exerciseId: string, exerciseName: string): Promise<ExerciseHistoryEntry[]> {
  const load = (column: "exercise_id" | "exercise_name", value: string) =>
    fetchAllPages<HistoryRow>((from, to) =>
      supabase
        .from("workout_set_logs")
        .select("id,session_id,exercise_id,exercise_name,set_number,weight,unit,reps,rir,created_at")
        .eq(column, value)
        .order("created_at", { ascending: false })
        .range(from, to),
    );
  const byId = exerciseId ? await load("exercise_id", exerciseId) : { rows: [], error: null };
  const source = byId.error || byId.rows.length === 0 ? await load("exercise_name", exerciseName) : byId;
  if (source.error) return [];
  const rawEntries = source.rows
    .map((row, index) => {
      const weight = Number(row.weight);
      const reps = Number(row.reps);
      const rir = Number(row.rir);
      const setNumber = Number(row.set_number);
      const createdAt = String(row.created_at ?? "");
      if (!createdAt || ![weight, reps, rir, setNumber].every(Number.isFinite)) return null;
      return {
        id: String(row.id || `${row.session_id ?? createdAt}:${setNumber}:${index}`),
        sessionId: row.session_id ? String(row.session_id) : null,
        createdAt,
        setNumber,
        weight,
        unit: row.unit === "lb" ? "lb" : "kg",
        reps,
        rir,
      } satisfies ExerciseHistoryEntry;
    })
    .filter((entry): entry is ExerciseHistoryEntry => Boolean(entry));
  const sessionIds = [...new Set(rawEntries.flatMap((entry) => (entry.sessionId ? [entry.sessionId] : [])))];
  if (!sessionIds.length) return rawEntries;
  const sessions = await fetchAllPages<SessionRow>((from, to) =>
    supabase.from("workout_sessions").select("id,split_id").in("id", sessionIds).range(from, to),
  );
  if (sessions.error) return rawEntries;
  const splitBySession = new Map(
    sessions.rows.map((row) => [String(row.id), row.split_id ? String(row.split_id) : null]),
  );
  return rawEntries.map((entry) => ({
    ...entry,
    splitId: entry.sessionId ? (splitBySession.get(entry.sessionId) ?? null) : null,
  }));
}
