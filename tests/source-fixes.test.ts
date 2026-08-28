import assert from "node:assert/strict";
import test from "node:test";

import { rankHistoryGroupKey } from "../app/historyKeys.ts";
import { formatPersonalInput, toMetricPersonalInput } from "../app/personalMeasurements.ts";
import { buildAllSplitRankTasks, buildLatestExerciseProgressPlan } from "../app/exerciseProgress.ts";
import {
  aggregateSessions,
  averageVolumeForDates,
  buildActivityPoints,
  dateKeyTimestamp,
  timeframeBounds,
  splitVolumeTrend,
} from "../app/dashboardMetrics.ts";
import { aggregateWeeklyMuscleSets } from "../app/dashboardMuscleVolume.ts";
import {
  buildHistoryTrendPoints,
  collapseHistoryEntries,
  groupHistoryEntries,
  logicalHistorySessionKey,
  summarizeHistory,
} from "../app/exerciseHistoryMetrics.ts";
import { normalizeSettingsView } from "../app/trackConstants.ts";
import { cloneWorkoutTasks, workoutDraftSignature } from "../app/workoutDraft.ts";
import { formatTrackDisplayVersion } from "../app/trackConfig.ts";
import { ACCOUNT_PRESENCE_LABELS, SYNC_PHASE_LABELS, syncPhaseForLabel } from "../app/syncHealth.ts";
import {
  convertSetUnit,
  mergeTrackLists,
  normalizeWeightInputOnBlur,
  restMinutesInputFromSeconds,
  restSecondsFromMinutes,
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

test("workout drafts copy set data and ignore presentation-only collapse state", () => {
  const tasks = [{ ...task("bench"), collapsed: false }];
  const cloned = cloneWorkoutTasks(tasks);
  cloned[0].sets![0].weight = "30";
  assert.equal(tasks[0].sets?.[0].weight, "10");

  const base = { splitId: "split-1", splitTitle: "Push", tasks };
  assert.equal(
    workoutDraftSignature(base),
    workoutDraftSignature({ ...base, tasks: [{ ...tasks[0], collapsed: true }] }),
  );
  assert.notEqual(workoutDraftSignature(base), workoutDraftSignature({ ...base, tasks: [{ ...tasks[0], reps: "9" }] }));
});

test("settings always resolves to a visible safe page", () => {
  assert.equal(normalizeSettingsView("appearance"), "appearance");
  assert.equal(normalizeSettingsView("admin", true), "admin");
  assert.equal(normalizeSettingsView("admin", false), "appearance");
});

test("shared health labels distinguish sync and account connectivity states", () => {
  assert.equal(syncPhaseForLabel("Couldn’t sync"), "attention");
  assert.equal(syncPhaseForLabel("Offline"), "offline");
  assert.equal(syncPhaseForLabel("Saving…"), "syncing");
  assert.equal(syncPhaseForLabel("Saved"), "synced");
  assert.equal(SYNC_PHASE_LABELS.synced, "Synced");
  assert.equal(ACCOUNT_PRESENCE_LABELS.online, "Online");
  assert.equal(ACCOUNT_PRESENCE_LABELS.offline, "Offline");
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

test("custom rest input treats the fractional part as seconds notation", () => {
  assert.equal(restSecondsFromMinutes("0.3"), 30);
  assert.equal(restSecondsFromMinutes("1.5"), 110);
  assert.equal(restSecondsFromMinutes("1.30"), 90);
  assert.equal(restSecondsFromMinutes("0.03"), 6);
  assert.equal(restMinutesInputFromSeconds(30), "0.3");
  assert.equal(restMinutesInputFromSeconds(90), "1.3");
  assert.equal(restMinutesInputFromSeconds(105), "1.45");
});

test("user-facing version labels stay compact while release versions stay lossless", () => {
  assert.equal(formatTrackDisplayVersion("v1.0.12"), "1.1");
  assert.equal(formatTrackDisplayVersion("1.9.10"), "2.0");
  assert.equal(formatTrackDisplayVersion("2.4"), "2.4");
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

test("dashboard buckets use local days while modern sessions stay distinct", () => {
  const sessions = aggregateSessions([
    {
      text: "Bench Press",
      sessionId: "session-a",
      exerciseId: "bench",
      performedAt: "2026-08-05T10:00:00.000Z",
      sets: [{ weight: 20, unit: "kg" as const, reps: 5 }],
    },
    {
      text: "Cable Row",
      sessionId: "session-a",
      exerciseId: "row",
      performedAt: "2026-08-05T10:10:00.000Z",
      sets: [{ weight: 30, unit: "kg" as const, reps: 5 }],
    },
    {
      text: "Bench Press",
      sessionId: "session-b",
      exerciseId: "bench",
      performedAt: "2026-08-05T18:00:00.000Z",
      sets: [{ weight: 25, unit: "kg" as const, reps: 5 }],
    },
  ]);

  assert.equal(sessions.length, 2);
  assert.deepEqual(
    sessions.map(({ id, volumeKg, exerciseCount }) => ({ id, volumeKg, exerciseCount })),
    [
      { id: "session-a", volumeKg: 250, exerciseCount: 2 },
      { id: "session-b", volumeKg: 125, exerciseCount: 1 },
    ],
  );

  const now = new Date(2026, 7, 26, 18, 0, 0, 0).getTime();
  const week = timeframeBounds("week", [], now);
  const all = timeframeBounds("all", [new Date(2026, 7, 5, 23, 30).getTime()], now);
  assert.equal(new Date(week.start).getDate(), 20);
  assert.equal(new Date(week.end).getTime(), now);
  assert.equal(new Date(all.start).getDate(), 5);
  assert.equal(new Date(all.end).getTime(), now);
});

test("dashboard collapses repeated finishes by local day and split", () => {
  const sessions = aggregateSessions([
    {
      text: "Leg Curl Machine",
      sessionId: "session-first",
      splitId: "split-legs",
      performedAt: "2026-08-14T08:00:00+07:00",
      sets: [{ setNumber: 1, weight: 65, unit: "kg" as const, reps: 6 }],
    },
    {
      text: "Leg Curl Machine",
      sessionId: "session-repeat",
      splitId: "split-legs",
      performedAt: "2026-08-14T08:20:00+07:00",
      sets: [{ setNumber: 1, weight: 65, unit: "kg" as const, reps: 6 }],
    },
    {
      text: "Leg Curl Machine",
      sessionId: "session-other-split",
      splitId: "split-pull",
      performedAt: "2026-08-14T08:30:00+07:00",
      sets: [{ setNumber: 1, weight: 50, unit: "kg" as const, reps: 8 }],
    },
  ]);

  assert.equal(sessions.length, 2);
  assert.deepEqual(
    sessions.map(({ id, volumeKg, setCount }) => ({ id, volumeKg, setCount })),
    [
      { id: "split:split-legs:date:2026-08-14", volumeKg: 390, setCount: 1 },
      { id: "split:split-pull:date:2026-08-14", volumeKg: 400, setCount: 1 },
    ],
  );
});

test("recovery volume uses canonical muscle detection for every group", () => {
  const totals = aggregateWeeklyMuscleSets([
    { exerciseId: "squat", exerciseName: "Back squat", setCount: 4 },
    { exerciseId: "press", exerciseName: "Shoulder press", setCount: 3 },
    { exerciseId: "fly", exerciseName: "Machine chest fly", setCount: 2 },
    { exerciseId: "curl", exerciseName: "Cable curl", setCount: 2 },
    { exerciseId: "abs", exerciseName: "Cable crunch", setCount: 1 },
  ]);

  assert.deepEqual(
    [...totals.entries()],
    [
      ["legs", 4],
      ["shoulders", 3],
      ["chest", 2],
      ["arms", 2],
      ["core", 1],
    ],
  );
});

test("exercise history groups duplicate dates while keeping session identity", () => {
  const entries = [
    {
      id: "set-1",
      sessionId: "session-a",
      createdAt: "2026-08-14T08:00:00+07:00",
      setNumber: 1,
      weight: 32.5,
      unit: "kg" as const,
      reps: 6,
      rir: 1,
    },
    {
      id: "set-2",
      sessionId: "session-a",
      createdAt: "2026-08-14T08:10:00+07:00",
      setNumber: 2,
      weight: 32.5,
      unit: "kg" as const,
      reps: 6,
      rir: 1,
    },
    {
      id: "set-3",
      sessionId: "session-b",
      createdAt: "2026-08-12T08:00:00+07:00",
      setNumber: 1,
      weight: 30,
      unit: "kg" as const,
      reps: 7,
      rir: 1,
    },
  ];
  const groups = groupHistoryEntries(entries);

  assert.equal(groups.length, 2);
  assert.equal(groups[0].entries.length, 2);
  assert.equal(summarizeHistory(entries).sessionCount, 2);
  assert.equal(buildHistoryTrendPoints(groups).length, 2);
});

test("exercise history collapses repeated same-split finishes but keeps split changes", () => {
  const entries = [
    {
      id: "set-first",
      sessionId: "session-first",
      splitId: "split-legs",
      createdAt: "2026-08-14T08:00:00+07:00",
      setNumber: 1,
      weight: 65,
      unit: "kg" as const,
      reps: 6,
      rir: 1,
    },
    {
      id: "set-repeat",
      sessionId: "session-repeat",
      splitId: "split-legs",
      createdAt: "2026-08-14T08:20:00+07:00",
      setNumber: 1,
      weight: 65,
      unit: "kg" as const,
      reps: 6,
      rir: 1,
    },
    {
      id: "set-other-split",
      sessionId: "session-other",
      splitId: "split-pull",
      createdAt: "2026-08-14T08:30:00+07:00",
      setNumber: 1,
      weight: 50,
      unit: "kg" as const,
      reps: 8,
      rir: 1,
    },
  ];
  const collapsed = collapseHistoryEntries(entries);

  assert.equal(logicalHistorySessionKey(entries[0]), "split:split-legs:date:2026-7-14");
  assert.equal(collapsed.length, 2);
  assert.equal(summarizeHistory(collapsed).sessionCount, 2);
  assert.deepEqual(
    collapsed.map((entry) => entry.id),
    ["set-other-split", "set-repeat"],
  );
});
