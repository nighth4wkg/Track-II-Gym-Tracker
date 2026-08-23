export type RankHistoryRow = {
  session_id: string | null;
  exercise_id: string | null;
  exercise_name: string | null;
  set_number: number | null;
  weight: number | null;
  unit: string | null;
  reps: number | null;
  rir: number | null;
  created_at: string;
};

export function rankHistoryGroupKey(
  row: Pick<RankHistoryRow, "session_id" | "exercise_id" | "exercise_name" | "created_at" | "set_number">,
  index: number,
) {
  const exerciseKey = row.exercise_id ? String(row.exercise_id) : String(row.exercise_name ?? "").toLowerCase();
  if (row.session_id) return `${row.session_id}:${exerciseKey}`;
  // Older rows can lack a session id. Do not collapse them into one invented
  // session: retaining a row independently is safer than silently losing a
  // workout when the historical boundary cannot be reconstructed.
  return `legacy:${index}:${row.created_at}:${exerciseKey}:${Number(row.set_number) || 0}`;
}
