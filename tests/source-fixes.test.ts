import assert from "node:assert/strict";
import test from "node:test";

import { rankHistoryGroupKey } from "../app/historyKeys.ts";
import { formatPersonalInput, toMetricPersonalInput } from "../app/personalMeasurements.ts";
import { buildAllSplitRankTasks, buildLatestExerciseProgressPlan } from "../app/exerciseProgress.ts";
import {
  averageVolumeForDates,
  buildActivityPoints,
  dateKeyTimestamp,
  splitVolumeTrend,
} from "../app/dashboardMetrics.ts";
import { normalizeSettingsView } from "../app/trackConstants.ts";
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

test("settings always resolves to a visible safe page", () => {
  assert.equal(normalizeSettingsView("appearance"), "appearance");
  assert.equal(normalizeSettingsView("admin", true), "admin");
  assert.equal(normalizeSettingsView("admin", false), "appearance");
});

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

test("progress sync copies only latest values while preserving split, exercise, and set identity", () => {
  const oldSplit = {
    id: "old-split",
    title: "Push A",
    updatedAt: 10,
    tasks: [
      {
        ...task("old-exercise", [setEntry("old-set", "20")]),
        text: "Barbell Bench Press",
        lastWeight: 17.5,
      },
    ],
  };
  const latestSplit = {
    id: "latest-split",
    title: "Push B",
    updatedAt: 20,
    tasks: [
      {
        ...task("latest-exercise", [
          { ...setEntry("latest-set-1", "32.5"), reps: "7", rir: "1" },
          { ...setEntry("latest-set-2", "30"), reps: "8", rir: "2" },
        ]),
        text: "Barbell Bench Press",
      },
    ],
  };

  const plan = buildLatestExerciseProgressPlan([oldSplit, latestSplit], 99);
  const synced = plan.nextLists[0].tasks[0];

  assert.deepEqual(plan.changedSplitIds, ["old-split"]);
  assert.equal(plan.exerciseCount, 1);
  assert.equal(synced.id, "old-exercise");
  assert.equal(synced.text, "Barbell Bench Press");
  assert.equal(synced.sets?.length, 1);
  assert.equal(synced.sets?.[0].id, "old-set");
  assert.equal(synced.sets?.[0].weight, "32.5");
  assert.equal(synced.sets?.[0].reps, "7");
  assert.equal(synced.sets?.[0].rir, "1");
  assert.equal(synced.lastWeight, 17.5);
  assert.equal(plan.nextLists[0].updatedAt, 99);
  assert.strictEqual(plan.nextLists[1], latestSplit);
});

test("all-split Rank selects the newest matching exercise without duplicate rows", () => {
  const earlier = {
    id: "split-a",
    title: "A",
    updatedAt: 10,
    tasks: [{ ...task("bench-old", [setEntry("set-old", "20")]), text: "Barbell Bench Press" }],
  };
  const latest = {
    id: "split-b",
    title: "B",
    updatedAt: 20,
    tasks: [
      { ...task("bench-latest", [setEntry("set-latest", "40")]), text: "Barbell Bench Press" },
      { ...task("row", [setEntry("row-set", "50")]), text: "Barbell Row" },
    ],
  };

  const ranked = buildAllSplitRankTasks([earlier, latest]);

  assert.equal(ranked.length, 2);
  assert.equal(ranked.find((item) => item.text.includes("Bench"))?.id, "bench-latest");
  assert.equal(ranked.find((item) => item.text.includes("Bench"))?.exerciseId, "bench-latest");
  assert.equal(ranked.find((item) => item.text.includes("Bench"))?.sets?.[0].weight, "40");
});

test("dashboard volume uses the filtered workout dates and compares its two halves", () => {
  const tasks = [
    { text: "Bench", performedAt: "2026-08-01T10:00:00.000Z", sets: [{ weight: 10, unit: "kg" as const, reps: 10 }] },
    { text: "Bench", performedAt: "2026-08-02T10:00:00.000Z", sets: [{ weight: 10, unit: "kg" as const, reps: 10 }] },
    { text: "Bench", performedAt: "2026-08-03T10:00:00.000Z", sets: [{ weight: 10, unit: "kg" as const, reps: 10 }] },
    { text: "Bench", performedAt: "2026-08-04T10:00:00.000Z", sets: [{ weight: 20, unit: "kg" as const, reps: 10 }] },
    { text: "Bench", performedAt: "2026-08-05T10:00:00.000Z", sets: [{ weight: 20, unit: "kg" as const, reps: 10 }] },
    { text: "Bench", performedAt: "2026-08-06T10:00:00.000Z", sets: [{ weight: 20, unit: "kg" as const, reps: 10 }] },
    { text: "Bench", performedAt: "2026-08-07T10:00:00.000Z", sets: [{ weight: 20, unit: "kg" as const, reps: 10 }] },
  ];
  const selectedDates = ["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06"];

  assert.equal(averageVolumeForDates(tasks, selectedDates), 150);
  assert.equal(splitVolumeTrend(tasks, selectedDates), 100);
  assert.equal(splitVolumeTrend(tasks, ["2026-08-01"]), null);

  const yearToDatePoints = buildActivityPoints(
    ["2026-08-05", "2026-08-09", "2026-08-12", "2026-08-14", "2026-08-18", "2026-08-21"].map(dateKeyTimestamp),
    "ytd",
    dateKeyTimestamp("2026-08-05"),
    dateKeyTimestamp("2026-08-21"),
  );
  assert.equal(yearToDatePoints.length, 4);
  assert.equal(
    yearToDatePoints.reduce((sum, point) => sum + point.count, 0),
    6,
  );
});
