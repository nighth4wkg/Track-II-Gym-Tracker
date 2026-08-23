import { detectExerciseTargets } from "./exerciseClassifier.js";
import { MUSCLE_GROUPS, type MuscleGroup } from "./rankTypes.ts";
import {
  RANK_META,
  FREE_WEIGHT_UNILATERAL_MULTIPLIER,
  equipmentAdjustedBenchmark,
  exerciseBenchmark,
  detectEquipmentType,
  exerciseFamilyKey,
} from "./rankBenchmarks.ts";
import {
  clamp,
  estimateOneRepMax,
  evidenceAdjustedLevel,
  nextRankLabel,
  numberValue,
  rankPercent,
  scoreToLevel,
} from "./rankScoring.ts";
import type {
  MuscleTarget,
  RankContribution,
  RankConfidence,
  RankExerciseMatch,
  RankOptions,
  RankSet,
  RankSummary,
  RankTask,
} from "./rankModels.ts";

export { EQUIPMENT_TYPES, MUSCLE_GROUPS } from "./rankTypes.ts";
export {
  EQUIPMENT_LABELS,
  MUSCLE_LABELS,
  RANK_META,
  FREE_WEIGHT_UNILATERAL_MULTIPLIER,
  detectEquipmentType,
  exerciseFamilyKey,
} from "./rankBenchmarks.ts";
export { nextRankLabel, rankPercent } from "./rankScoring.ts";
export type { EquipmentType, MuscleGroup } from "./rankTypes.ts";
export type {
  MuscleTarget,
  RankConfidence,
  RankExerciseMatch,
  RankLevel,
  RankOptions,
  RankSet,
  RankSummary,
  RankTask,
} from "./rankModels.ts";

export function classifyExercise(name: string): MuscleTarget[] {
  // SAFETY: the classifier's public result is built exclusively from the
  // MuscleTarget objects declared in exerciseClassifier.js.
  const primary = primaryMuscleTarget(detectExerciseTargets(name).targets as MuscleTarget[]);
  return primary ? [primary] : [];
}

function primaryMuscleTarget(targets: MuscleTarget[]) {
  return targets.reduce<MuscleTarget | null>((primary, candidate) => {
    if (!primary || candidate.weight > primary.weight) return candidate;
    return primary;
  }, null);
}

function formatBestSet(set: RankSet) {
  const weight = numberValue(set.weight);
  const reps = numberValue(set.reps);
  const rir = numberValue(set.rir);
  const unit = set.unit === "lb" ? "lb" : "kg";
  return `${weight} ${unit} x ${reps} reps - ${rir} RIR`;
}

export function buildRankSummaries(tasks: RankTask[], options: RankOptions = {}): RankSummary[] {
  const bodyWeightKg = Math.max(0, numberValue(options.bodyWeightKg));
  const recentDays = clamp(numberValue(options.recentDays, 84), 7, 365);
  const cutoff = Date.now() - recentDays * 86_400_000;
  type PreparedTask = {
    task: RankTask;
    detection: ReturnType<typeof detectExerciseTargets>;
    familyKey: string;
    detectedFamilyKey: string;
    identityKey: string;
    order: number;
  };
  const contributions = new Map<MuscleGroup, RankContribution[]>();

  const prepared: PreparedTask[] = tasks.map((task, index) => {
    const detection = detectExerciseTargets(task.text);
    return {
      task,
      detection,
      familyKey: exerciseFamilyKey(task.text, detection.matchedName),
      detectedFamilyKey: detection.matchedName ? exerciseFamilyKey(detection.matchedName) : "",
      identityKey: task.exerciseId ? `id:${task.exerciseId}` : `task:${index}`,
      order: index,
    };
  });

  // The current split is the naming authority. Historical rows can contain an
  // older title (or, in legacy data, a different/missing exercise id) after an
  // exercise was renamed. Resolve each old row back to one unique current
  // movement so Rank displays and counts the exercise only once.
  const currentTasks = prepared.filter((item) => item.task.source !== "history");
  const currentById = new Map(
    currentTasks.flatMap((item) => (item.task.exerciseId ? [[item.task.exerciseId, item] as const] : [])),
  );
  const uniqueCurrentLookup = (keyFor: (item: PreparedTask) => string) => {
    const buckets = new Map<string, PreparedTask[]>();
    for (const item of currentTasks) {
      const key = keyFor(item);
      if (!key) continue;
      const bucket = buckets.get(key) ?? [];
      bucket.push(item);
      buckets.set(key, bucket);
    }
    return new Map([...buckets].filter(([, bucket]) => bucket.length === 1).map(([key, bucket]) => [key, bucket[0]]));
  };
  const currentByFamily = uniqueCurrentLookup((item) => item.familyKey);
  const currentByDetectedFamily = uniqueCurrentLookup((item) =>
    item.detection.confidence >= 0.8 ? item.detectedFamilyKey : "",
  );

  for (const preparedTask of prepared) {
    const task = preparedTask.task;
    if (task.source === "history" && task.performedAt && new Date(task.performedAt).getTime() < cutoff) continue;
    const exactCurrent = task.source === "history" && task.exerciseId ? currentById.get(task.exerciseId) : undefined;
    const familyCurrent = task.source === "history" ? currentByFamily.get(preparedTask.familyKey) : undefined;
    const detectedCurrent =
      task.source === "history" && preparedTask.detection.confidence >= 0.8
        ? currentByDetectedFamily.get(preparedTask.detectedFamilyKey)
        : undefined;
    const currentMatch = exactCurrent ?? familyCurrent ?? detectedCurrent;

    // Rank describes the exercises in the active split. Historical rows are
    // supporting evidence only: if an old id/name can no longer be resolved
    // to one current exercise, it must not create a second ghost movement or
    // leak into a different muscle region. History-only mode remains available
    // for callers that do not provide current split exercises.
    if (task.source === "history" && currentTasks.length > 0 && !currentMatch) continue;

    const detection = currentMatch?.detection ?? preparedTask.detection;
    const effectiveExerciseName = currentMatch?.task.text ?? task.text;
    const overrideGroup = currentMatch?.task.rankGroupOverride ?? task.rankGroupOverride;
    // SAFETY: detectExerciseTargets returns MuscleTarget objects; this is the
    // same classifier contract used by classifyExercise above.
    const primary = overrideGroup
      ? { group: overrideGroup, weight: 1 }
      : primaryMuscleTarget(detection.targets as MuscleTarget[]);
    if (!primary) continue;
    const targets = [primary];
    const sets = task.sets?.length
      ? task.sets
      : [{ weight: task.weight, unit: task.unit, reps: task.reps, rir: task.rir }];
    // Historical rows can retain a pre-rename exercise name. Always use the
    // current split name when one is available so an old "JM Press" log does
    // not strip the Machine identity, restore x1.3, or select a free-weight
    // benchmark after the exercise is renamed to "JM Press Machine".
    const equipment =
      currentMatch?.task.rankEquipmentOverride ??
      task.rankEquipmentOverride ??
      detectEquipmentType(effectiveExerciseName, detection.matchedName);
    const machine = equipment === "machine";
    const loadMultiplier = detection.unilateral && equipment === "free-weight" ? FREE_WEIGHT_UNILATERAL_MULTIPLIER : 1;
    const best = sets
      .map((set) => ({
        set,
        oneRepMax: estimateOneRepMax(set, equipment, effectiveExerciseName, bodyWeightKg, loadMultiplier),
      }))
      .sort((a, b) => b.oneRepMax - a.oneRepMax)[0];
    const bestSet = best?.set ?? sets[0] ?? {};
    const oneRepMax = best?.oneRepMax ?? 0;
    for (const target of targets) {
      const baseBenchmark = exerciseBenchmark(target.group, detection.matchedName, effectiveExerciseName, equipment);
      const benchmarkKg = equipmentAdjustedBenchmark(baseBenchmark.kg, bodyWeightKg, equipment);
      const rows = contributions.get(target.group) ?? [];
      rows.push({
        score: oneRepMax > 0 ? (oneRepMax / benchmarkKg) * target.weight : 0,
        exercise: effectiveExerciseName,
        exerciseId: currentMatch?.task.exerciseId ?? task.exerciseId,
        identityKey: currentMatch?.identityKey ?? preparedTask.identityKey,
        familyKey: currentMatch?.familyKey ?? preparedTask.familyKey,
        order: currentMatch?.order ?? preparedTask.order,
        set: bestSet,
        targets,
        detectedAs: detection.matchedName,
        confidence: overrideGroup ? 1 : detection.confidence,
        hasWeightedData: oneRepMax > 0,
        isUnilateral: detection.unilateral,
        isMachine: machine,
        equipment,
        loadMultiplier,
        benchmarkKg,
        benchmarkLabel: baseBenchmark.label,
        source: task.source === "history" ? "history" : "current",
        performedAt: task.performedAt,
      });
      contributions.set(target.group, rows);
    }
  }

  return MUSCLE_GROUPS.map((group) => {
    const allRows = contributions.get(group) ?? [];
    const deduplicated = new Map<string, RankContribution>();
    for (const row of allRows) {
      const existing = deduplicated.get(row.identityKey);
      if (!existing || row.score > existing.score || (!existing.hasWeightedData && row.hasWeightedData))
        deduplicated.set(row.identityKey, row);
    }

    // Older workout logs may not have exercise_id. Merge those legacy rows
    // into an id-backed current exercise when their movement family matches.
    const byFamily = new Map<string, RankContribution>();
    for (const row of deduplicated.values()) {
      const existing = byFamily.get(row.familyKey);
      if (!existing || row.score > existing.score || (!existing.hasWeightedData && row.hasWeightedData))
        byFamily.set(row.familyKey, row);
    }
    // Keep the exercise list anchored to the active split's source order.
    // Classification and equipment corrections may change score or muscle
    // group, but should never make a row jump to the top of the list.
    const rows = [...byFamily.values()].sort((a, b) => a.order - b.order);
    // The presentation order must not affect the strength calculation. Use
    // the strongest weighted rows for the score while keeping `rows` stable
    // for the exercise list shown in the UI.
    const weightedRows = rows.filter((row) => row.hasWeightedData).sort((a, b) => b.score - a.score);
    const strongest = weightedRows[0] ?? rows[0];
    const score =
      weightedRows.length > 1
        ? weightedRows[0].score * 0.65 + weightedRows[1].score * 0.35
        : (weightedRows[0]?.score ?? 0);
    const averageDetection = rows.length ? rows.reduce((sum, row) => sum + row.confidence, 0) / rows.length : 0;
    const recentSessionKeys = new Set(
      allRows
        .filter((row) => row.source === "history" && row.hasWeightedData && row.performedAt)
        .map((row) => new Date(row.performedAt ?? "").toISOString().slice(0, 10)),
    );
    const recentPerformances = recentSessionKeys.size;
    const level = evidenceAdjustedLevel(scoreToLevel(score), weightedRows.length, recentPerformances, averageDetection);
    const confidence: RankConfidence =
      weightedRows.length >= 3 && averageDetection >= 0.8 && recentPerformances >= 2
        ? "high"
        : weightedRows.length >= 1 && averageDetection >= 0.65
          ? "medium"
          : "low";
    const matchedExercises = rows.map(
      (row) =>
        ({
          exerciseId: row.exerciseId,
          exercise: row.exercise,
          detectedAs: row.detectedAs,
          detectionConfidence: row.confidence,
          score: row.score,
          bestSet: row.hasWeightedData ? formatBestSet(row.set) : "Add weight and reps to rank this exercise",
          hasWeightedData: row.hasWeightedData,
          isUnilateral: row.isUnilateral,
          isMachine: row.isMachine,
          equipment: row.equipment,
          loadMultiplier: row.loadMultiplier,
          benchmarkKg: row.benchmarkKg,
          benchmarkLabel: row.benchmarkLabel,
          source: row.source,
        }) satisfies RankExerciseMatch,
    );
    return {
      group,
      score,
      level,
      label: RANK_META[level].label,
      color: RANK_META[level].color,
      targets: strongest?.targets ?? [],
      bestExercise: strongest?.exercise ?? "Log a weighted set to rank this area",
      bestSet: strongest ? formatBestSet(strongest.set) : "No weighted set yet",
      detectedAs: strongest?.detectedAs ?? "",
      detectionConfidence: strongest?.confidence ?? 0,
      trackedExercises: rows.length,
      matchedExercises,
      confidence,
      recentPerformances,
      progress: rankPercent(score, level),
      nextLevelLabel: nextRankLabel(level),
    } satisfies RankSummary;
  });
}
