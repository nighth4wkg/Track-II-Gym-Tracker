import { useCallback, type Dispatch, type SetStateAction } from "react";
import { supabase } from "../supabase";
import type { Checklist, ExportCell, ExportLog, ExportSession } from "../trackTypes";
import { QUERY_PAGE_SIZE, TRACK_TIMING } from "../trackConstants";

type UseTrackExportActionsOptions = {
  lists: Checklist[];
  setExportBusy: Dispatch<SetStateAction<"csv" | "json" | null>>;
  setExportMessage: Dispatch<SetStateAction<string>>;
};

async function fetchAllExportRows<T>(table: string, columns: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += QUERY_PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order("created_at", { ascending: true })
      .range(from, from + QUERY_PAGE_SIZE - 1);
    if (error) throw error;
    // SAFETY: each caller selects the exact column set represented by T;
    // pagination only changes how those already-typed rows are fetched.
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < QUERY_PAGE_SIZE) return rows;
  }
}

function downloadExport(content: string, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), TRACK_TIMING.exportUrlRevokeMs);
}

export function useTrackExportActions({ lists, setExportBusy, setExportMessage }: UseTrackExportActionsOptions) {
  const exportWorkoutData = useCallback(
    async (format: "csv" | "json") => {
      setExportBusy(format);
      setExportMessage("");
      try {
        const [sessions, logs] = await Promise.all([
          fetchAllExportRows<ExportSession>("workout_sessions", "id,split_id,split_name,created_at"),
          fetchAllExportRows<ExportLog>(
            "workout_set_logs",
            "session_id,exercise_id,exercise_name,set_number,weight,unit,reps,rir,created_at",
          ),
        ]);
        const sessionById = new Map(sessions.map((session) => [session.id, session]));
        const date = new Date().toISOString().slice(0, 10);
        if (format === "csv") {
          const headers = [
            "session_id",
            "performed_at",
            "split_id",
            "split_name",
            "exercise_id",
            "exercise_name",
            "set_number",
            "weight",
            "unit",
            "reps",
            "rir",
          ];
          const escape = (value: ExportCell) => `"${String(value ?? "").replace(/"/g, '""')}"`;
          const rows = logs.map((log) => {
            const session = sessionById.get(log.session_id);
            return [
              log.session_id,
              session?.created_at ?? log.created_at,
              session?.split_id ?? "",
              session?.split_name ?? "",
              log.exercise_id ?? "",
              log.exercise_name,
              log.set_number,
              log.weight,
              log.unit,
              log.reps,
              log.rir,
            ]
              .map(escape)
              .join(",");
          });
          downloadExport(
            `\uFEFF${headers.map(escape).join(",")}\n${rows.join("\n")}`,
            "text/csv;charset=utf-8",
            `track-workout-history-${date}.csv`,
          );
        } else {
          const logsBySession = new Map<string, ExportLog[]>();
          for (const log of logs)
            logsBySession.set(log.session_id, [...(logsBySession.get(log.session_id) ?? []), log]);
          const workoutHistory = sessions.map((session) => ({
            id: session.id,
            splitId: session.split_id,
            splitName: session.split_name,
            performedAt: session.created_at,
            sets: (logsBySession.get(session.id) ?? []).map((log) => ({
              exerciseId: log.exercise_id,
              exerciseName: log.exercise_name,
              setNumber: log.set_number,
              weight: Number(log.weight),
              unit: log.unit,
              reps: Number(log.reps),
              rir: Number(log.rir),
            })),
          }));
          const backup = { schemaVersion: 1, exportedAt: new Date().toISOString(), splits: lists, workoutHistory };
          downloadExport(
            JSON.stringify(backup, null, 2),
            "application/json;charset=utf-8",
            `track-backup-${date}.json`,
          );
        }
        setExportMessage(`${format.toUpperCase()} ready.`);
      } catch {
        setExportMessage("Couldn’t export your data. Check your connection and try again.");
      } finally {
        setExportBusy(null);
      }
    },
    [lists, setExportBusy, setExportMessage],
  );

  return { exportWorkoutData };
}
