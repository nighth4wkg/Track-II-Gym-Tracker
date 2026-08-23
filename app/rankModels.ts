import type { EquipmentType, MuscleGroup } from "./rankTypes.ts";

export type RankLevel = "newbie" | "intermediate" | "gym-bro" | "advanced" | "elite" | "untracked";
export type RankConfidence = "low" | "medium" | "high";

export type RankSet = {
  weight?: string | number;
  unit?: "kg" | "lb";
  reps?: string | number;
  rir?: string | number;
};

export type RankTask = {
  id?: string;
  exerciseId?: string;
  rankGroupOverride?: MuscleGroup;
  rankEquipmentOverride?: EquipmentType;
  text: string;
  sets?: RankSet[];
  weight?: string | number;
  unit?: "kg" | "lb";
  reps?: string | number;
  rir?: string | number;
  performedAt?: string | number;
  source?: "current" | "history";
};

export type MuscleTarget = { group: MuscleGroup; weight: number };

export type RankExerciseMatch = {
  exerciseId?: string;
  exercise: string;
  detectedAs: string;
  detectionConfidence: number;
  score: number;
  bestSet: string;
  hasWeightedData: boolean;
  isUnilateral: boolean;
  isMachine: boolean;
  equipment: EquipmentType;
  loadMultiplier: number;
  benchmarkKg: number;
  benchmarkLabel: string;
  source: "current" | "history";
};

export type RankSummary = {
  group: MuscleGroup;
  score: number;
  level: RankLevel;
  label: string;
  color: string;
  targets: MuscleTarget[];
  bestExercise: string;
  bestSet: string;
  detectedAs: string;
  detectionConfidence: number;
  trackedExercises: number;
  matchedExercises: RankExerciseMatch[];
  confidence: RankConfidence;
  recentPerformances: number;
  progress: number;
  nextLevelLabel: string;
};

export type RankOptions = { bodyWeightKg?: number; recentDays?: number };

export type BenchmarkRule = {
  pattern: RegExp;
  kg: number;
  equipment?: EquipmentType;
};

export type EvidenceContext = {
  exerciseCount: number;
  sessionCount: number;
  detectionConfidence: number;
};

export type RankContribution = {
  score: number;
  exercise: string;
  exerciseId?: string;
  identityKey: string;
  familyKey: string;
  order: number;
  set: RankSet;
  targets: MuscleTarget[];
  detectedAs: string;
  confidence: number;
  hasWeightedData: boolean;
  isUnilateral: boolean;
  isMachine: boolean;
  equipment: EquipmentType;
  loadMultiplier: number;
  benchmarkKg: number;
  benchmarkLabel: string;
  source: "current" | "history";
  performedAt?: string | number;
};
