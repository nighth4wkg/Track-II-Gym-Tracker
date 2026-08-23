export type WorkoutDateSyncEvent = "workout-delete-pending" | "workout-deleted" | "workout-restored";

export function calendarDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
