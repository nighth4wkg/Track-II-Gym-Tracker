import assert from "node:assert/strict";
import test from "node:test";

import { rankHistoryGroupKey } from "../app/historyKeys.ts";
import { formatPersonalInput, toMetricPersonalInput } from "../app/personalMeasurements.ts";
import {
  convertSetUnit,
  mergeTrackLists,
  normalizeWeightInputOnBlur,
  sanitizeDecimalInput,
  weightProgressionDelta,
} from "../app/trackUtils.ts";

const setEntry = (id: string, weight: string) => ({ id, weight, unit: "kg" as const, reps: "8", rir: "2" });
const task = (id: string, sets = [setEntry(`${id}-set`, "10")]) => ({
  id,
  text: id,
  reps: "8",
  rir: "2",
  done: false,
  sets,
});
const list = (tasks: ReturnType<typeof task>[]) => ({ id: "split-1", title: "Push", updatedAt: 1, tasks });

test("three-way list merging keeps local deletions and remote additions", () => {
  const base = list([
    task("kept"),
    task("deleted"),
    task("set-edited", [setEntry("set-1", "10"), setEntry("set-2", "12")]),
  ]);
  const remote = list([
    task("kept"),
    task("deleted"),
    task("set-edited", [setEntry("set-1", "10"), setEntry("set-2", "12")]),
    task("remote-addition"),
  ]);
  const local = list([task("kept"), task("set-edited", [setEntry("set-1", "11")])]);

  const merged = mergeTrackLists([remote], [local], [base]);
  const mergedTaskIds = merged[0].tasks.map((item) => item.id);

  assert.deepEqual(mergedTaskIds, ["kept", "set-edited", "remote-addition"]);
  assert.equal(merged[0].tasks[1].sets?.[0].weight, "11");
  assert.equal(
    merged[0].tasks[1].sets?.some((item) => item.id === "set-2"),
    false,
  );
});

test("weight editing accepts temporary decimal syntax but never persists an invalid value", () => {
  assert.equal(sanitizeDecimalInput("1..2kg", 6), "1.2");
  assert.equal(normalizeWeightInputOnBlur("1."), "1");
  assert.equal(normalizeWeightInputOnBlur("."), null);
  assert.equal(normalizeWeightInputOnBlur(""), null);
});

test("weight progression compares the latest baseline in the current unit", () => {
  const previousPounds = {
    id: "set-1",
    weight: "71.65",
    unit: "lb" as const,
    reps: "7",
    rir: "1",
    lastWeight: 71.65,
    lastWeightUnit: "lb" as const,
  };
  const currentKg = convertSetUnit(previousPounds, "kg");

  assert.equal(currentKg.weight, "32.5");
  assert.equal(currentKg.lastWeight, 32.5);
  assert.equal(weightProgressionDelta(currentKg), null);
  assert.equal(weightProgressionDelta({ ...currentKg, weight: "30" }), -2.5);
  assert.equal(weightProgressionDelta({ ...currentKg, lastWeightUnit: undefined }), null);
});

test("personal measurements convert height and bodyweight in the correct direction", () => {
  assert.equal(formatPersonalInput("171", "height", "lb"), "67.3");
  assert.equal(toMetricPersonalInput("67.3", "height", "lb"), "170.9");
  assert.equal(formatPersonalInput("61", "weight", "lb"), "134.5");
  assert.equal(toMetricPersonalInput("134.5", "weight", "lb"), "61");
  assert.equal(formatPersonalInput("171", "height", "kg"), "171");
});

test("legacy rank rows without session ids remain independently addressable", () => {
  const row = {
    session_id: null,
    exercise_id: "row",
    exercise_name: "Bench Press",
    set_number: 1,
    created_at: "2026-08-23T09:00:00.000Z",
  } as const;
  assert.notEqual(rankHistoryGroupKey(row, 0), rankHistoryGroupKey(row, 1));
  assert.equal(rankHistoryGroupKey({ ...row, session_id: "session-1" }, 0), "session-1:row");
});
