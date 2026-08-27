import type { WorkoutSessionPayload } from "./trackTypes";

const NON_RETRYABLE_WORKOUT_ERRORS =
  /authentication|unauthorized|forbidden|permission|invalid|migration|unavailable until|incomplete|mutation id|required|payload|not found/i;
const RETRYABLE_WORKOUT_ERRORS =
  /abort|connection|failed to fetch|fetch failed|gateway|network|offline|temporar|timeout|timed out|502|503|504/i;

/**
 * Only transient transport failures belong in the offline queue. Validation,
 * authentication, and migration errors must remain visible so deployment
 * problems are not disguised as successfully queued workouts.
 */
export function isQueueableWorkoutSaveFailure(message: string, online = globalThis.navigator?.onLine !== false) {
  if (!online) return true;
  if (NON_RETRYABLE_WORKOUT_ERRORS.test(message)) return false;
  return RETRYABLE_WORKOUT_ERRORS.test(message);
}

/**
 * Keep the queue FIFO and idempotent. Returning null makes a full queue an
 * explicit UI failure instead of silently dropping a workout.
 */
export function coalesceOfflineWorkoutQueue(
  entries: readonly WorkoutSessionPayload[],
  next: WorkoutSessionPayload,
  maxEntries: number,
) {
  if (entries.some((entry) => entry.clientMutationId === next.clientMutationId)) return [...entries];
  if (entries.length >= maxEntries) return null;
  return [...entries, next];
}
