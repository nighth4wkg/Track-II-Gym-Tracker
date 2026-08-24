import { calendarDateKey } from "../calendarTypes";
import { supabase } from "../supabase";
import type { WeightUnit } from "../trackTypes";
import { MILLISECONDS_PER_DAY } from "../trackConstants";
import { convertWeight } from "../trackUtils";
import { fetchAllPages } from "./pagination";

export type WorkoutSetDetail = {
  setNumber: number;
  weight: number;
  unit: WeightUnit;
  reps: number;
  rir: number;
};

export type WorkoutExerciseDetail = {
  name: string;
  sets: number;
  reps: number[];
  setsDetail: WorkoutSetDetail[];
  tonnageKg: number;
};

export type WorkoutDayDetail = {
  dateKey: string;
  sessions: number;
  sessionIds: string[];
  exercises: WorkoutExerciseDetail[];
  tonnageKg: number;
  notes: string;
};

export async function fetchWorkoutDayDetail(userId: string, dateKey: string): Promise<WorkoutDayDetail | null> {
  const selectedDay = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(selectedDay.getTime())) return null;
  const queryStart = new Date(selectedDay.getTime() - MILLISECONDS_PER_DAY).toISOString();
  const queryEnd = new Date(selectedDay.getTime() + 2 * MILLISECONDS_PER_DAY).toISOString();
  const sessionsWithNotes = await fetchAllPages<{
    id: string;
    split_name: string | null;
    created_at: string;
    notes?: string | null;
  }>((from, to) =>
    supabase
      .from("workout_sessions")
      .select("id,split_name,created_at,notes")
      .eq("user_id", userId)
      .gte("created_at", queryStart)
      .lt("created_at", queryEnd)
      .order("created_at", { ascending: false })
      .range(from, to),
  );
  const sessions = sessionsWithNotes.error
    ? await fetchAllPages<{ id: string; split_name: string | null; created_at: string }>((from, to) =>
        supabase
          .from("workout_sessions")
          .select("id,split_name,created_at")
          .eq("user_id", userId)
          .gte("created_at", queryStart)
          .lt("created_at", queryEnd)
          .order("created_at", { ascending: false })
          .range(from, to),
      )
    : sessionsWithNotes;
  const logs = await fetchAllPages<{
    session_id: string | null;
    exercise_id: string | null;
    exercise_name: string;
    set_number: number | null;
    weight: number | null;
    unit: string | null;
    reps: number | null;
    rir: number | null;
    created_at: string;
  }>((from, to) =>
    supabase
      .from("workout_set_logs")
      .select("session_id,exercise_id,exercise_name,set_number,weight,unit,reps,rir,created_at")
      .eq("user_id", userId)
      .gte("created_at", queryStart)
      .lt("created_at", queryEnd)
      .order("created_at", { ascending: false })
      .range(from, to),
  );
  if (sessions.error || logs.error) return null;
  const daySessions = sessions.rows.filter((session) => calendarDateKey(new Date(session.created_at)) === dateKey);
  const sessionIds = new Set(daySessions.map((session) => session.id));
  const dayLogs = logs.rows.filter(
    (log) => sessionIds.has(log.session_id ?? "") || calendarDateKey(new Date(log.created_at)) === dateKey,
  );

  for (const log of dayLogs) if (log.session_id) sessionIds.add(log.session_id);
  const latestLogs = new Map<string, (typeof dayLogs)[number]>();
  for (const [index, log] of dayLogs.entries()) {
    const exerciseKey = log.exercise_id ? String(log.exercise_id) : String(log.exercise_name).trim().toLowerCase();
    const key = log.session_id
      ? `${log.session_id}:${exerciseKey}:${Number(log.set_number) || 0}`
      : `legacy:${index}:${log.created_at}:${exerciseKey}:${Number(log.set_number) || 0}`;
    if (!latestLogs.has(key)) latestLogs.set(key, log);
  }

  const byExercise = new Map<string, { setsByNumber: Map<number, WorkoutSetDetail>; tonnageKg: number }>();
  for (const log of latestLogs.values()) {
    const previous = byExercise.get(log.exercise_name) ?? {
      setsByNumber: new Map<number, WorkoutSetDetail>(),
      tonnageKg: 0,
    };
    let setNumber = Number(log.set_number) || previous.setsByNumber.size + 1;
    while (previous.setsByNumber.has(setNumber)) setNumber += 1;
    previous.setsByNumber.set(setNumber, {
      setNumber,
      weight: Number(log.weight) || 0,
      unit: log.unit === "lb" ? "lb" : "kg",
      reps: Number(log.reps) || 0,
      rir: Number(log.rir) || 0,
    });
    previous.tonnageKg +=
      convertWeight(Number(log.weight) || 0, log.unit === "lb" ? "lb" : "kg", "kg") * (Number(log.reps) || 0);
    byExercise.set(log.exercise_name, previous);
  }

  const exercises = [...byExercise.entries()]
    .map(([name, values]) => {
      const setsDetail = [...values.setsByNumber.values()].sort((left, right) => left.setNumber - right.setNumber);
      return {
        name,
        sets: setsDetail.length,
        reps: setsDetail.map((set) => set.reps),
        setsDetail,
        tonnageKg: values.tonnageKg,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
  const notes =
    daySessions.map((session) => ("notes" in session ? String(session.notes ?? "").trim() : "")).find(Boolean) ?? "";
  const notesResult = await supabase
    .from("workout_notes")
    .select("note")
    .eq("user_id", userId)
    .eq("date_key", dateKey)
    .maybeSingle();
  const savedNote = !notesResult.error ? String(notesResult.data?.note ?? "").trim() : "";
  return {
    dateKey,
    sessions: Math.max(daySessions.length, dayLogs.length ? 1 : 0),
    sessionIds: [...sessionIds],
    exercises,
    tonnageKg: exercises.reduce((total, exercise) => total + exercise.tonnageKg, 0),
    notes: savedNote || notes,
  };
}
