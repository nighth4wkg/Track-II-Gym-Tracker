import assert from "node:assert/strict";
import test from "node:test";

import { coalesceOfflineWorkoutQueue, isQueueableWorkoutSaveFailure } from "../app/offlineQueue.ts";
import type { WorkoutSessionPayload } from "../app/trackTypes.ts";

const session = (id: string): WorkoutSessionPayload => ({
  splitId: "split-1",
  splitName: "Push",
  clientMutationId: id,
  occurredAt: "2026-08-27T12:00:00.000Z",
  dateKey: "2026-08-27",
  logs: [
    {
      exerciseId: "exercise-1",
      exerciseName: "Bench Press",
      setNumber: 1,
      weight: 60,
      unit: "kg",
      reps: 8,
      rir: 2,
    },
  ],
});

test("only transient workout save failures are queueable", () => {
  assert.equal(isQueueableWorkoutSaveFailure("Failed to fetch", true), true);
  assert.equal(isQueueableWorkoutSaveFailure("Gateway timeout", true), true);
  assert.equal(isQueueableWorkoutSaveFailure("Failed to fetch", false), true);
  assert.equal(isQueueableWorkoutSaveFailure("Authentication is required", true), false);
  assert.equal(isQueueableWorkoutSaveFailure("A client mutation id is required", true), false);
  assert.equal(isQueueableWorkoutSaveFailure("Migration is unavailable until deployed", true), false);
});

test("offline queue preserves FIFO order and deduplicates replayed mutations", () => {
  const first = session("mutation-1");
  const second = session("mutation-2");

  const queued = coalesceOfflineWorkoutQueue([], first, 50);
  assert.deepEqual(
    queued?.map((entry) => entry.clientMutationId),
    ["mutation-1"],
  );

  const withSecond = coalesceOfflineWorkoutQueue(queued ?? [], second, 50);
  assert.deepEqual(
    withSecond?.map((entry) => entry.clientMutationId),
    ["mutation-1", "mutation-2"],
  );

  const duplicate = coalesceOfflineWorkoutQueue(withSecond ?? [], first, 50);
  assert.deepEqual(
    duplicate?.map((entry) => entry.clientMutationId),
    ["mutation-1", "mutation-2"],
  );
  assert.notEqual(duplicate, withSecond);
});

test("a full offline queue fails explicitly instead of dropping a workout", () => {
  const existing = [session("mutation-1"), session("mutation-2")];
  assert.equal(coalesceOfflineWorkoutQueue(existing, session("mutation-3"), 2), null);
  assert.deepEqual(
    coalesceOfflineWorkoutQueue(existing, session("mutation-1"), 2)?.map((entry) => entry.clientMutationId),
    ["mutation-1", "mutation-2"],
  );
});
