import type { EquipmentType, MuscleGroup } from "./rankTypes.ts";
import type { BenchmarkRule } from "./rankModels.ts";

export const MUSCLE_LABELS = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  arms: "Arms",
  legs: "Legs",
  core: "Core",
};

export const EQUIPMENT_LABELS = {
  machine: "Machine",
  cable: "Cable",
  "free-weight": "Free weight",
  bodyweight: "Bodyweight",
  "smith-machine": "Smith machine",
};

export const RANK_META = {
  untracked: { label: "Needs data", color: "#737373" },
  newbie: { label: "Newbie", color: "#f5f5f5" },
  intermediate: { label: "Intermediate", color: "#f4c542" },
  "gym-bro": { label: "Gym Bro", color: "#9b6cff" },
  advanced: { label: "Advanced", color: "#ff914d" },
  elite: { label: "Elite", color: "#ef4444" },
};

export const FREE_WEIGHT_UNILATERAL_MULTIPLIER = 1.2;
export const REFERENCE_BODY_WEIGHT_KG = 75;

const SMITH_MACHINE_BENCHMARK_MULTIPLIER = 1.05;
const UNLABELED_CABLE_BENCHMARK_MULTIPLIER = 0.9;

const BODYWEIGHT_MOVEMENT_RULES: readonly { pattern: RegExp; factor: number }[] = [
  { pattern: /\b(?:pull ?up|chin ?up)\b/, factor: 1 },
  { pattern: /\b(?:push ?up|dip)\b/, factor: 0.7 },
  { pattern: /\b(?:inverted row|bodyweight row)\b/, factor: 0.65 },
  { pattern: /\b(?:squat|lunge|split squat)\b/, factor: 0.7 },
];
const DEFAULT_BODYWEIGHT_MOVEMENT_FACTOR = 0.7;

export function normalizedName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function bodyweightMovementFactor(name: string) {
  const value = normalizedName(name);
  return (
    BODYWEIGHT_MOVEMENT_RULES.find(({ pattern }) => pattern.test(value))?.factor ?? DEFAULT_BODYWEIGHT_MOVEMENT_FACTOR
  );
}

const EQUIPMENT_DETECTION_RULES: readonly { type: EquipmentType; pattern: RegExp }[] = [
  { type: "smith-machine", pattern: /\bsmith\b/ },
  { type: "bodyweight", pattern: /\b(?:bodyweight|body weight|push ?up|pull ?up|chin ?up|dip|inverted row)\b/ },
  { type: "cable", pattern: /\b(?:cable|pulley)\b/ },
  { type: "machine", pattern: /\b(?:machine|selectorized|lever)\b/ },
];

export function detectEquipmentType(originalName: string, matchedName = ""): EquipmentType {
  const name = normalizedName(`${originalName} ${matchedName}`);
  return EQUIPMENT_DETECTION_RULES.find(({ pattern }) => pattern.test(name))?.type ?? "free-weight";
}

const FAMILY_MODIFIERS = new Set([
  "alternate",
  "alternating",
  "bilateral",
  "bilaterally",
  "left",
  "one",
  "right",
  "single",
  "unilateral",
  "unilaterally",
]);

const FAMILY_SIDE_WORDS = new Set(["arm", "hand", "leg", "side"]);

const MOVEMENT_EQUIPMENT_WORDS = new Set([
  "assisted",
  "band",
  "banded",
  "barbell",
  "bodyweight",
  "cable",
  "dumbbell",
  "ez",
  "kettlebell",
  "machine",
  "plate",
  "resistance",
  "selectorized",
  "smith",
  "weighted",
]);

const EXPLICIT_EQUIPMENT_RULES: readonly { type: EquipmentType; pattern: RegExp }[] = [
  { type: "smith-machine", pattern: /\bsmith\b/ },
  { type: "bodyweight", pattern: /\b(?:bodyweight|body weight|assisted|push ?up|pull ?up|chin ?up|dip)\b/ },
  { type: "cable", pattern: /\b(?:cable|pulley)\b/ },
  { type: "machine", pattern: /\b(?:machine|selectorized|lever)\b/ },
  { type: "free-weight", pattern: /\b(?:barbell|dumbbell|kettlebell|ez bar|plate)\b/ },
];

/**
 * Stable identity for renamed and historical versions of the same movement.
 * Load-side wording is intentionally ignored so a unilateral edit does not
 * create a second Rank exercise. Meaningful variants remain part of the family.
 */
export function exerciseFamilyKey(name: string, matchedName = "") {
  const source = normalizedName(name || matchedName).replace(/\bplane\b/g, " ");
  const rawTokens = source.split(/\s+/).filter(Boolean);
  const tokens: string[] = [];
  for (let index = 0; index < rawTokens.length; index += 1) {
    const token = rawTokens[index];
    if (FAMILY_MODIFIERS.has(token)) {
      if ((token === "one" || token === "single") && FAMILY_SIDE_WORDS.has(rawTokens[index + 1] ?? "")) index += 1;
      continue;
    }
    tokens.push(token === "delts" ? "delt" : token === "flyes" || token === "flies" ? "fly" : token);
  }
  let family = tokens.join(" ");

  // Keenan flap names appear in both prefix and suffix forms in imported and
  // current data. Normalize both forms before comparing exercise identities.
  family = family
    .replace(/^frontal keenan flap$/, "keenan flap frontal")
    .replace(/^sagittal keenan flap$/, "keenan flap sagittal")
    .replace(/^reverse barbell lunge$/, "barbell reverse lunge")
    .replace(/^reverse dumbbell lunge$/, "dumbbell reverse lunge")
    .replace(/^machine chest press$/, "chest press machine")
    .replace(/^dumbbell chest supported row$/, "chest supported dumbbell row")
    .replace(/^machine lat pulldown$/, "lat pulldown machine")
    .replace(/^preacher curl machine$/, "machine preacher curl")
    .replace(/^reverse machine fly$/, "reverse fly machine");

  return family || normalizedName(matchedName || name);
}

/**
 * A softer identity used only when reconciling renamed Rank history. The
 * strict family key intentionally keeps equipment variants separate; this
 * key lets an old generic name such as "Chest Fly" follow a current
 * "Machine Chest Fly" when there is no competing equipment variant.
 */
export function exerciseMovementCoreKey(name: string) {
  const tokens = normalizedName(name)
    .split(/\s+/)
    .filter((token) => token && !MOVEMENT_EQUIPMENT_WORDS.has(token));
  return exerciseFamilyKey(tokens.join(" "));
}

export function explicitExerciseEquipment(name: string): EquipmentType | null {
  const normalized = normalizedName(name);
  return EXPLICIT_EQUIPMENT_RULES.find(({ pattern }) => pattern.test(normalized))?.type ?? null;
}

const GROUP_FALLBACK_BENCHMARKS = {
  chest: 72,
  back: 62,
  shoulders: 42,
  arms: 32,
  legs: 125,
  core: 38,
} satisfies Record<MuscleGroup, number>;

// The benchmark values are domain data, not control flow. Keeping them in a
// priority-ordered table makes the standards auditable and easy to extend.
const EXERCISE_BENCHMARK_RULES = {
  chest: [
    { pattern: /\b(?:fly|flye)\b/, kg: 32, equipment: "machine" },
    { pattern: /\bdumbbell (?:chest )?press\b/, kg: 38 },
    { pattern: /\b(?:fly|flye)\b/, kg: 24 },
    { pattern: /\bdip\b/, kg: 45 },
    { pattern: /\b(?:bench press|chest press)\b/, kg: 80 },
  ],
  back: [
    { pattern: /\bdeadlift\b/, kg: 135 },
    { pattern: /\b(?:dumbbell|kettlebell) row\b/, kg: 38 },
    { pattern: /\b(?:pull ?up|chin ?up)\b/, kg: 15 },
    { pattern: /\bkeenan flap\b/, kg: 42 },
    { pattern: /\bshrug\b/, kg: 75 },
    { pattern: /\b(?:row|pulldown|pull down)\b/, kg: 55 },
  ],
  shoulders: [
    { pattern: /\b(?:rear delts?|reverse fly)\b/, kg: 28, equipment: "machine" },
    { pattern: /\b(?:dumbbell (?:shoulder )?press|arnold press)\b/, kg: 24 },
    { pattern: /\b(?:lateral raise|rear delts?|reverse fly|front raise)\b/, kg: 16 },
    { pattern: /\bpress\b/, kg: 50 },
  ],
  arms: [
    { pattern: /\bjm press\b/, kg: 44, equipment: "machine" },
    { pattern: /\bcurl\b/, kg: 38, equipment: "machine" },
    { pattern: /\b(?:dumbbell|hammer|preacher) curl\b/, kg: 15 },
    { pattern: /\bcurl\b/, kg: 28 },
    { pattern: /\b(?:tricep|triceps|pushdown|extension)\b/, kg: 32 },
  ],
  legs: [
    { pattern: /\bleg press\b/, kg: 180 },
    { pattern: /\bhack squat\b/, kg: 130 },
    { pattern: /\bhip thrust\b/, kg: 130 },
    { pattern: /\b(?:calf|calves|heel raise)\b/, kg: 110, equipment: "machine" },
    { pattern: /\b(?:calf|calves|heel raise)\b/, kg: 80 },
    { pattern: /\b(?:leg extension|leg curl)\b/, kg: 55 },
    { pattern: /\b(?:lunge|split squat)\b/, kg: 40 },
    { pattern: /\bsquat\b/, kg: 130 },
  ],
  core: [
    { pattern: /\b(?:rollout|ab wheel)\b/, kg: 30 },
    { pattern: /\b(?:crunch|sit up)\b/, kg: 50, equipment: "machine" },
    { pattern: /\b(?:crunch|sit up)\b/, kg: 35 },
  ],
} satisfies Record<MuscleGroup, readonly BenchmarkRule[]>;

const EQUIPMENT_BENCHMARK_ADJUSTMENTS = {
  bodyweight: (_baseKg: number, name: string) => REFERENCE_BODY_WEIGHT_KG * bodyweightMovementFactor(name),
  "smith-machine": (baseKg: number) => baseKg * SMITH_MACHINE_BENCHMARK_MULTIPLIER,
  cable: (baseKg: number, name: string) =>
    name.includes("cable") ? baseKg : baseKg * UNLABELED_CABLE_BENCHMARK_MULTIPLIER,
} satisfies Partial<Record<EquipmentType, (baseKg: number, name: string) => number>>;

export function exerciseBenchmark(
  group: MuscleGroup,
  matchedName: string,
  originalName = matchedName,
  equipment = detectEquipmentType(originalName, matchedName),
) {
  const name = normalizedName(`${originalName} ${matchedName}`);
  const rule = EXERCISE_BENCHMARK_RULES[group].find((candidate) => {
    return (!("equipment" in candidate) || candidate.equipment === equipment) && candidate.pattern.test(name);
  });
  const baseKg = rule?.kg ?? GROUP_FALLBACK_BENCHMARKS[group];
  const adjustment = Object.entries(EQUIPMENT_BENCHMARK_ADJUSTMENTS).find(([type]) => type === equipment)?.[1];
  const kg = adjustment ? adjustment(baseKg, name) : baseKg;
  return { kg, label: `${EQUIPMENT_LABELS[equipment]} estimate` };
}

const EQUIPMENT_BODY_WEIGHT_EXPONENTS = {
  "free-weight": 0.67,
  "smith-machine": 0.55,
  bodyweight: 0.67,
  cable: 0.25,
  machine: 0.25,
} satisfies Record<EquipmentType, number>;

export function equipmentAdjustedBenchmark(baseKg: number, bodyWeightKg: number, equipment: EquipmentType) {
  if (!Number.isFinite(bodyWeightKg) || bodyWeightKg <= 0) return baseKg;
  const exponent = EQUIPMENT_BODY_WEIGHT_EXPONENTS[equipment];
  const scale = Math.max(0.75, Math.min(1.35, Math.pow(bodyWeightKg / REFERENCE_BODY_WEIGHT_KG, exponent)));
  return baseKg * scale;
}
