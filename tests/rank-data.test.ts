import assert from "node:assert/strict";
import test from "node:test";

import { buildRankSummaries, detectEquipmentType, exerciseFamilyKey, type RankTask } from "../app/rankData.ts";
import { EXERCISE_PRIMARY_CATALOG } from "../app/exercisePrimaryCatalog.js";
import { detectExerciseTargets } from "../app/exerciseClassifier.js";

test("explicit upper-chest wording overrides generic shoulder-press matching", () => {
  const detection = detectExerciseTargets("Machine Sagittal Shoulder Press (Upper Chest)");
  assert.equal(detection.targets[0]?.group, "chest");
  assert.equal(detection.source, "semantic-priority");
});

test("machine curls use a dedicated machine estimate without unilateral load inflation", () => {
  const detection = detectExerciseTargets("Machine Curl (Dead Stop, Unilateral)");
  assert.equal(detection.matchedName, "machine curl");
  assert.equal(detection.targets[0]?.group, "arms");

  const arms = buildRankSummaries(
    [
      {
        exerciseId: "machine-curl",
        text: "Machine Curl (Dead Stop, Unilateral)",
        weight: 41,
        reps: 8,
        rir: 0,
        source: "current",
      },
    ],
    { bodyWeightKg: 75 },
  ).find((summary) => summary.group === "arms");

  assert.ok(arms);
  assert.equal(arms.matchedExercises.length, 1);
  assert.equal(arms.matchedExercises[0].isMachine, true);
  assert.equal(arms.matchedExercises[0].isUnilateral, true);
  assert.equal(arms.matchedExercises[0].loadMultiplier, 1);
  assert.equal(arms.matchedExercises[0].benchmarkKg, 38);
  assert.equal(arms.matchedExercises[0].benchmarkLabel, "Machine estimate");
  assert.ok(arms.matchedExercises[0].score > 0);
});

test("unilateral cable exercises do not inherit a free-weight multiplier", () => {
  const arms = buildRankSummaries(
    [
      {
        exerciseId: "cable-extension",
        text: "Cable Triceps Extension (Unilateral)",
        weight: 17.5,
        reps: 4,
        rir: 0,
        source: "current",
      },
    ],
    { bodyWeightKg: 75 },
  ).find((summary) => summary.group === "arms");

  assert.ok(arms);
  assert.equal(arms.matchedExercises[0].isMachine, false);
  assert.equal(arms.matchedExercises[0].equipment, "cable");
  assert.equal(arms.matchedExercises[0].loadMultiplier, 1);
});

test("machine-specific standards cover JM press, rear delts, crunch, calves, and chest fly", () => {
  const cases = [
    { id: "jm", text: "JM Press Machine (Unilateral)", group: "arms", weight: 50, reps: 10, benchmark: 44 },
    {
      id: "rear-delts",
      text: "Rear Delts Fly Machine (Unilaterally)",
      group: "shoulders",
      weight: 36,
      reps: 5,
      benchmark: 28,
    },
    { id: "ab-crunch", text: "AB Crunch Machine", group: "core", weight: 73, reps: 6, benchmark: 50 },
    { id: "calves", text: "Calves Raise Machine", group: "legs", weight: 136, reps: 9, benchmark: 110 },
    { id: "chest-fly", text: "Machine Chest Fly", group: "chest", weight: 36, reps: 8, benchmark: 32 },
  ] as const;

  for (const item of cases) {
    const summary = buildRankSummaries(
      [{ exerciseId: item.id, text: item.text, weight: item.weight, reps: item.reps, rir: 0, source: "current" }],
      { bodyWeightKg: 75 },
    ).find((row) => row.group === item.group);

    assert.ok(summary, `${item.text} should map to ${item.group}`);
    assert.equal(summary.matchedExercises.length, 1);
    assert.equal(summary.matchedExercises[0].isMachine, true);
    assert.equal(summary.matchedExercises[0].loadMultiplier, 1);
    assert.equal(summary.matchedExercises[0].benchmarkKg, item.benchmark);
    assert.equal(summary.matchedExercises[0].benchmarkLabel, "Machine estimate");
  }
});

test("renamed JM Press history inherits the current machine identity", () => {
  const now = new Date().toISOString();
  const arms = buildRankSummaries(
    [
      {
        exerciseId: "jm-machine",
        text: "JM Press Machine (Unilateral)",
        weight: 50,
        reps: 10,
        rir: 0,
        source: "current",
      },
      {
        exerciseId: "jm-machine",
        text: "JM Press (Unilateral)",
        weight: 50,
        reps: 10,
        rir: 0,
        source: "history",
        performedAt: now,
      },
    ],
    { bodyWeightKg: 75 },
  ).find((summary) => summary.group === "arms");

  assert.ok(arms);
  assert.equal(arms.matchedExercises.length, 1);
  assert.equal(arms.matchedExercises[0].exercise, "JM Press Machine (Unilateral)");
  assert.equal(arms.matchedExercises[0].detectedAs, "machine jm press");
  assert.equal(arms.matchedExercises[0].isMachine, true);
  assert.equal(arms.matchedExercises[0].loadMultiplier, 1);
  assert.equal(arms.matchedExercises[0].benchmarkKg, 44);
  assert.equal(arms.matchedExercises[0].benchmarkLabel, "Machine estimate");
});

test("equipment auto-detection distinguishes supported equipment families", () => {
  assert.equal(detectEquipmentType("Machine Chest Fly"), "machine");
  assert.equal(detectEquipmentType("Cable Triceps Extension"), "cable");
  assert.equal(detectEquipmentType("Dumbbell Bench Press"), "free-weight");
  assert.equal(detectEquipmentType("Pull-up"), "bodyweight");
  assert.equal(detectEquipmentType("Smith Machine Squat"), "smith-machine");
});

test("only unilateral free-weight work receives a conservative load normalization", () => {
  const cases = [
    { id: "free", text: "Dumbbell Curl (Unilateral)", expected: "free-weight", multiplier: 1.2 },
    { id: "cable", text: "Cable Curl (Unilateral)", expected: "cable", multiplier: 1 },
    { id: "machine", text: "Machine Curl (Unilateral)", expected: "machine", multiplier: 1 },
    { id: "smith", text: "Smith Machine Curl (Unilateral)", expected: "smith-machine", multiplier: 1 },
  ] as const;

  for (const item of cases) {
    const arms = buildRankSummaries(
      [{ exerciseId: item.id, text: item.text, weight: 20, reps: 8, rir: 0, source: "current" }],
      { bodyWeightKg: 75 },
    ).find((summary) => summary.group === "arms");
    assert.ok(arms, `${item.text} should rank as arms`);
    assert.equal(arms.matchedExercises[0].equipment, item.expected);
    assert.equal(arms.matchedExercises[0].loadMultiplier, item.multiplier);
  }
});

test("bodyweight scales equipment benchmarks by each load profile", () => {
  const scoreAt = (text: string, bodyWeightKg: number, rankEquipmentOverride?: RankTask["rankEquipmentOverride"]) => {
    const summary = buildRankSummaries(
      [{ exerciseId: text, text, weight: 50, reps: 8, rir: 0, source: "current", rankEquipmentOverride }],
      { bodyWeightKg },
    ).find((row) => row.matchedExercises.length > 0);
    assert.ok(summary);
    return summary.matchedExercises[0].score;
  };

  for (const text of ["Barbell Curl", "Smith Machine Curl", "Machine Curl", "Cable Curl"]) {
    assert.ok(scoreAt(text, 60) > scoreAt(text, 100), `${text} should scale down for a heavier body weight`);
  }
  const machineRatio = scoreAt("Machine Curl", 60) / scoreAt("Machine Curl", 100);
  const cableRatio = scoreAt("Cable Curl", 60) / scoreAt("Cable Curl", 100);
  assert.ok(Math.abs(machineRatio - cableRatio) < 1e-12, "machine and cable use the same body-weight exponent");
});

test("bodyweight movements use body mass while assisted variants reduce effective load", () => {
  const rank = (text: string, weight: number) =>
    buildRankSummaries([{ exerciseId: text, text, weight, reps: 8, rir: 0, source: "current" }], {
      bodyWeightKg: 80,
    }).find((summary) => summary.group === "back")?.matchedExercises[0];

  const pullup = rank("Pull-up", 0);
  const assisted = rank("Assisted Pull-up", 20);
  assert.ok(pullup);
  assert.ok(assisted);
  assert.equal(pullup.equipment, "bodyweight");
  assert.ok(pullup.score > assisted.score);
});

test("manual equipment overrides affect Rank only and never mutate workout data", () => {
  const task: RankTask = {
    exerciseId: "custom",
    text: "Custom Press",
    weight: 40,
    reps: 8,
    rir: 1,
    source: "current",
    rankEquipmentOverride: "machine",
  };
  const before = structuredClone(task);
  const result = buildRankSummaries([task], { bodyWeightKg: 75 }).flatMap((summary) => summary.matchedExercises);
  assert.ok(result.length > 0);
  assert.equal(result[0].equipment, "machine");
  assert.deepEqual(task, before);
});

test("Rank keeps source exercise order when scores or corrections change", () => {
  const tasks: RankTask[] = [
    { exerciseId: "first", text: "Cable Curl", weight: 5, reps: 1, rir: 0, source: "current" },
    { exerciseId: "second", text: "Machine Curl", weight: 100, reps: 10, rir: 0, source: "current" },
    { exerciseId: "third", text: "Barbell Row", weight: 100, reps: 8, rir: 0, source: "current" },
  ];
  const initialArms = buildRankSummaries(tasks, { bodyWeightKg: 75 }).find((summary) => summary.group === "arms");
  assert.ok(initialArms);
  assert.deepEqual(
    initialArms.matchedExercises.map((row) => row.exercise),
    ["Cable Curl", "Machine Curl"],
  );
  assert.equal(initialArms.level, "gym-bro");
  assert.ok(initialArms.score > 0);

  const corrected = tasks.map((task) =>
    task.exerciseId === "first"
      ? { ...task, rankGroupOverride: "back" as const, rankEquipmentOverride: "machine" as const }
      : task,
  );
  const correctedBack = buildRankSummaries(corrected, { bodyWeightKg: 75 }).find((summary) => summary.group === "back");
  assert.ok(correctedBack);
  assert.deepEqual(
    correctedBack.matchedExercises.map((row) => row.exercise),
    ["Cable Curl", "Barbell Row"],
  );
});

test("Rank tier uses the strongest back exercises instead of the first split rows", () => {
  const back = buildRankSummaries(
    [
      {
        exerciseId: "front",
        text: "Keenan Flap (Frontal, Unilateral)",
        weight: 32.5,
        reps: 7,
        rir: 1,
        source: "current",
      },
      {
        exerciseId: "sagittal",
        text: "Keenan Flap (Sagittal, Unilateral)",
        weight: 30,
        reps: 7,
        rir: 1,
        source: "current",
      },
      { exerciseId: "kelso", text: "Machine Kelso Shrug", weight: 86, reps: 9, rir: 0, source: "current" },
      { exerciseId: "spinal", text: "Cable Spinal Extension", weight: 95, reps: 10, rir: 0, source: "current" },
    ],
    { bodyWeightKg: 75 },
  ).find((summary) => summary.group === "back");

  assert.ok(back);
  assert.equal(back.level, "gym-bro");
  assert.ok(back.progress > 90);
});

test("manual muscle overrides are trusted instead of lowering rank evidence confidence", () => {
  const today = new Date();
  const performedAt = (daysAgo: number) => {
    const date = new Date(today);
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString();
  };
  const current: RankTask[] = [
    {
      exerciseId: "custom",
      text: "Foobar Movement",
      weight: 180,
      reps: 8,
      rir: 0,
      source: "current",
      rankGroupOverride: "chest",
    },
    { exerciseId: "bench", text: "Barbell Bench Press", weight: 180, reps: 8, rir: 0, source: "current" },
    { exerciseId: "fly", text: "Machine Chest Fly", weight: 100, reps: 8, rir: 0, source: "current" },
    { exerciseId: "dip", text: "Chest Dip", weight: 100, reps: 8, rir: 0, source: "current" },
  ];
  const history = current.flatMap((task) =>
    [0, 1, 2].map((daysAgo) => ({ ...task, source: "history" as const, performedAt: performedAt(daysAgo) })),
  );
  const chest = buildRankSummaries([...current, ...history], { bodyWeightKg: 75 }).find(
    (summary) => summary.group === "chest",
  );

  assert.ok(chest);
  assert.equal(chest.detectionConfidence, 1);
  assert.equal(chest.confidence, "high");
  assert.equal(chest.level, "elite");
});

test("rank family identity ignores unilateral wording but preserves meaningful variants", () => {
  assert.equal(exerciseFamilyKey("Keenan Flap (Frontal, Unilateral)"), exerciseFamilyKey("Frontal-plane Keenan Flap"));
  assert.equal(
    exerciseFamilyKey("Keenan Flap (Sagittal, Unilateral)"),
    exerciseFamilyKey("Sagittal-plane Keenan Flap"),
  );
  assert.notEqual(
    exerciseFamilyKey("Keenan Flap (Frontal, Unilateral)"),
    exerciseFamilyKey("Keenan Flap (Sagittal, Unilateral)"),
  );
  assert.notEqual(exerciseFamilyKey("Cable High-to-Low Wood Chop"), exerciseFamilyKey("Cable Low-to-High Wood Chop"));
});

test("rank summaries merge current and historical names for every exercise id", () => {
  const now = new Date().toISOString();
  const tasks: RankTask[] = [
    { exerciseId: "front", text: "Keenan Flap (Frontal, Unilateral)", weight: 30, reps: 10, rir: 0, source: "current" },
    {
      exerciseId: "sagittal",
      text: "Keenan Flap (Sagittal, Unilateral)",
      weight: 30,
      reps: 7,
      rir: 0,
      source: "current",
    },
    {
      exerciseId: "front",
      text: "Keenan Flap (Frontal)",
      weight: 30,
      reps: 10,
      rir: 0,
      source: "history",
      performedAt: now,
    },
    {
      exerciseId: "sagittal",
      text: "Keenan Flap (Sagittal)",
      weight: 30,
      reps: 7,
      rir: 0,
      source: "history",
      performedAt: now,
    },
  ];

  const back = buildRankSummaries(tasks, { bodyWeightKg: 75 }).find((summary) => summary.group === "back");
  assert.ok(back);
  assert.equal(back.matchedExercises.filter((row) => /keenan flap/i.test(row.exercise)).length, 2);
});

test("legacy history without exercise ids also merges by movement family", () => {
  const now = new Date().toISOString();
  const tasks: RankTask[] = [
    { exerciseId: "front", text: "Keenan Flap (Frontal, Unilateral)", weight: 30, reps: 10, rir: 0, source: "current" },
    { text: "Frontal-plane Keenan Flap", weight: 28, reps: 9, rir: 0, source: "history", performedAt: now },
  ];

  const back = buildRankSummaries(tasks, { bodyWeightKg: 75 }).find((summary) => summary.group === "back");
  assert.ok(back);
  assert.equal(
    back.matchedExercises.filter((row) => /keenan flap/i.test(`${row.exercise} ${row.detectedAs}`)).length,
    1,
  );
});

test("renamed historical exercises inherit the current split name through unique detected movement identity", () => {
  const now = new Date().toISOString();
  const tasks: RankTask[] = [
    { exerciseId: "current-spinal", text: "Cable Spinal Extension", weight: 105, reps: 6, rir: 0, source: "current" },
    {
      exerciseId: "legacy-spinal",
      text: "Spinal Extension",
      weight: 95,
      reps: 10,
      rir: 0,
      source: "history",
      performedAt: now,
    },
    { exerciseId: "current-kelso", text: "Machine Kelso Shrug", weight: 86, reps: 8, rir: 0, source: "current" },
    {
      exerciseId: "legacy-kelso",
      text: "Kelso Shrug",
      weight: 86,
      reps: 8,
      rir: 0,
      source: "history",
      performedAt: now,
    },
  ];

  const back = buildRankSummaries(tasks, { bodyWeightKg: 75 }).find((summary) => summary.group === "back");
  assert.ok(back);
  assert.deepEqual(back.matchedExercises.map((row) => row.exercise).sort(), [
    "Cable Spinal Extension",
    "Machine Kelso Shrug",
  ]);
});

test("same-id history always adopts the latest current name", () => {
  const now = new Date().toISOString();
  const tasks: RankTask[] = [
    { exerciseId: "stable-id", text: "Cable Spinal Extension", weight: 105, reps: 6, rir: 0, source: "current" },
    {
      exerciseId: "stable-id",
      text: "Old Custom Back Movement",
      weight: 95,
      reps: 10,
      rir: 0,
      source: "history",
      performedAt: now,
    },
  ];

  const back = buildRankSummaries(tasks, { bodyWeightKg: 75 }).find((summary) => summary.group === "back");
  assert.ok(back);
  assert.equal(back.matchedExercises.length, 1);
  assert.equal(back.matchedExercises[0].exercise, "Cable Spinal Extension");
});

test("unmatched old history cannot create ghost exercises in any muscle group", () => {
  const now = new Date().toISOString();
  const current: RankTask[] = [
    {
      exerciseId: "chest",
      text: "Machine Sagittal Shoulder Press (Upper Chest)",
      weight: 77,
      reps: 6,
      rir: 0,
      source: "current",
    },
    { exerciseId: "back", text: "Cable Spinal Extension", weight: 105, reps: 6, rir: 0, source: "current" },
    { exerciseId: "legs", text: "Leg Curl", weight: 65, reps: 8, rir: 0, source: "current" },
  ];
  const history: RankTask[] = [
    {
      exerciseId: "retired-shoulder",
      text: "Machine Shoulder Press",
      weight: 90,
      reps: 8,
      rir: 0,
      source: "history",
      performedAt: now,
    },
    {
      exerciseId: "retired-back",
      text: "Old Row Variation",
      weight: 100,
      reps: 8,
      rir: 0,
      source: "history",
      performedAt: now,
    },
    {
      exerciseId: "retired-legs",
      text: "Old Squat Variation",
      weight: 140,
      reps: 5,
      rir: 0,
      source: "history",
      performedAt: now,
    },
  ];

  const summaries = buildRankSummaries([...current, ...history], { bodyWeightKg: 75 });
  const displayed = summaries.flatMap((summary) => summary.matchedExercises.map((row) => row.exercise));
  assert.deepEqual(new Set(displayed), new Set(current.map((task) => task.text)));
  assert.equal(summaries.find((summary) => summary.group === "chest")?.matchedExercises[0]?.exercise, current[0].text);
});

test("all catalog family collisions stay inside the same muscle group", () => {
  const groupsByFamily = new Map<string, Set<string>>();
  for (const entry of EXERCISE_PRIMARY_CATALOG) {
    const groups = groupsByFamily.get(exerciseFamilyKey(entry.name)) ?? new Set<string>();
    groups.add(entry.group);
    groupsByFamily.set(exerciseFamilyKey(entry.name), groups);
  }

  const crossMuscleCollisions = [...groupsByFamily.entries()].filter(([, groups]) => groups.size > 1);
  assert.deepEqual(crossMuscleCollisions, []);
});
