import type { EquipmentType } from "./rankTypes.ts";
import { bodyweightMovementFactor, RANK_META } from "./rankBenchmarks.ts";
import type { EvidenceContext, RankLevel, RankSet } from "./rankModels.ts";
import { WEIGHT_CONVERSION_FACTOR } from "./trackConstants.ts";

const KG_PER_LB = 1 / WEIGHT_CONVERSION_FACTOR;

export function numberValue(value: string | number | undefined, fallback = 0) {
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function setWeightKg(set: RankSet) {
  const weight = Math.max(0, numberValue(set.weight));
  return set.unit === "lb" ? weight * KG_PER_LB : weight;
}

const EQUIPMENT_LOAD_FACTORS = {
  "free-weight": 1,
  "smith-machine": 0.92,
  machine: 0.78,
  cable: 0.72,
  bodyweight: 1,
} satisfies Record<EquipmentType, number>;

function effectiveSetLoadKg(
  set: RankSet,
  equipment: EquipmentType,
  exerciseName: string,
  bodyWeightKg: number,
  loadMultiplier: number,
) {
  const externalLoad = setWeightKg(set);
  if (equipment !== "bodyweight") return externalLoad * loadMultiplier * EQUIPMENT_LOAD_FACTORS[equipment];
  const baseLoad = Math.max(0, bodyWeightKg) * bodyweightMovementFactor(exerciseName);
  const assisted = /\b(assisted|assistance|band assisted)\b/.test(
    exerciseName.toLowerCase().replace(/[^a-z0-9]+/g, " "),
  );
  return Math.max(0, baseLoad + (assisted ? -externalLoad : externalLoad));
}

export function estimateOneRepMax(
  set: RankSet,
  equipment: EquipmentType,
  exerciseName: string,
  bodyWeightKg: number,
  loadMultiplier = 1,
) {
  const weight = effectiveSetLoadKg(set, equipment, exerciseName, bodyWeightKg, loadMultiplier);
  const reps = clamp(numberValue(set.reps), 0, 15);
  const rir = clamp(numberValue(set.rir), 0, 4);
  if (weight <= 0 || reps <= 0) return 0;
  // Blend the Epley and Brzycki estimates, using RIR only to estimate the
  // missing reps in the set. Capping the final estimate avoids a high-rep,
  // high-RIR set producing an unrealistic rank jump.
  const effectiveReps = clamp(reps + rir * 0.45, 1, 15);
  const epley = weight * (1 + effectiveReps / 30);
  const brzycki = effectiveReps < 3 ? epley : weight * (36 / (37 - effectiveReps));
  return Math.min(epley, brzycki);
}

const RANK_THRESHOLDS = {
  newbie: { min: 0, max: 0.65 },
  intermediate: { min: 0.65, max: 0.95 },
  "gym-bro": { min: 0.95, max: 1.25 },
  advanced: { min: 1.25, max: 1.6 },
  elite: { min: 1.6, max: 2.0 },
} satisfies Record<Exclude<RankLevel, "untracked">, { min: number; max: number }>;

const RANK_ORDER: Exclude<RankLevel, "untracked">[] = ["newbie", "intermediate", "gym-bro", "advanced", "elite"];

export function scoreToLevel(score: number): RankLevel {
  if (!Number.isFinite(score) || score <= 0) return "untracked";
  return (
    RANK_ORDER.map((level) => ({ level, max: RANK_THRESHOLDS[level].max })).find(({ max }) => score < max)?.level ??
    "elite"
  );
}

function capLevel(level: RankLevel, maxLevel: Exclude<RankLevel, "untracked">): RankLevel {
  if (level === "untracked") return level;
  return RANK_ORDER[Math.min(RANK_ORDER.indexOf(level), RANK_ORDER.indexOf(maxLevel))];
}

const EVIDENCE_LEVEL_RULES: readonly {
  matches: (context: EvidenceContext) => boolean;
  maxLevel: Exclude<RankLevel, "untracked">;
}[] = [
  { matches: ({ exerciseCount }) => exerciseCount <= 1, maxLevel: "intermediate" },
  { matches: ({ exerciseCount }) => exerciseCount === 2, maxLevel: "gym-bro" },
  { matches: ({ sessionCount }) => sessionCount < 2, maxLevel: "gym-bro" },
  {
    matches: ({ exerciseCount, sessionCount, detectionConfidence }) =>
      exerciseCount < 4 || sessionCount < 3 || detectionConfidence < 0.8,
    maxLevel: "advanced",
  },
];

export function evidenceAdjustedLevel(
  level: RankLevel,
  exerciseCount: number,
  sessionCount: number,
  detectionConfidence: number,
): RankLevel {
  const rule = EVIDENCE_LEVEL_RULES.find(({ matches }) =>
    matches({ exerciseCount, sessionCount, detectionConfidence }),
  );
  return rule ? capLevel(level, rule.maxLevel) : level;
}

export function rankPercent(score: number, level: RankLevel = scoreToLevel(score)) {
  if (level === "untracked" || score <= 0) return 0;
  const range = RANK_THRESHOLDS[level];
  const progress = ((score - range.min) / (range.max - range.min)) * 100;
  return Math.max(0, Math.min(level === "elite" ? 100 : 99, Math.round(progress)));
}

export function nextRankLabel(level: RankLevel) {
  if (level === "untracked") return RANK_META.newbie.label;
  const index = RANK_ORDER.indexOf(level);
  const next = RANK_ORDER[index + 1];
  return next ? RANK_META[next].label : "Elite mastery";
}
