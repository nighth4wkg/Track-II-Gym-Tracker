import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { convertWeight } from "./trackUtils.ts";

export type TaskCardSet = {
  id: string;
  weight: string;
  unit: "kg" | "lb";
  reps: string;
  rir: string;
  completed?: boolean;
  lastWeight?: number;
  lastWeightUnit?: "kg" | "lb";
  lastReps?: number;
  lastRir?: number;
  historySessions?: number;
  historySamples?: number;
  historyFailureCount?: number;
};

export type TaskCardTask = {
  id: string;
  text: string;
  sets?: TaskCardSet[];
  done: boolean;
  collapsed?: boolean;
};

export type ProgressionCoach = {
  title: string;
  detail: string;
  tone: "up" | "hold" | "plateau";
  confidence: "High" | "Medium" | "Insufficient data";
};

function formatCoachWeight(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

type CoachComparison = {
  currentWeight: number;
  currentReps: number;
  currentRir: number | null;
  previousWeight: number;
  previousReps: number;
  previousRir: number | null;
  historySessions: number;
  historySamples: number;
  historyFailureCount: number;
};

function finiteCoachNumber(value: string | number | undefined) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Turn the current workout into an advisory, autoregulated next-step cue.
 *
 * A load change is only suggested after at least two comparable work sets add
 * meaningful reps at the same load, with recorded effort staying in a
 * 1–3-RIR range. A single plateau or a single strong set therefore never
 * triggers an automatic weight jump. The cue is intentionally advisory: it
 * never mutates a set or assumes a medical or program-specific prescription.
 */
export function buildProgressionCoach(task: TaskCardTask): ProgressionCoach | null {
  const comparisons: CoachComparison[] = (task.sets ?? []).flatMap((candidate) => {
    if (
      candidate.lastWeight === undefined ||
      !candidate.lastWeightUnit ||
      candidate.lastReps === undefined ||
      !Number.isFinite(candidate.lastReps)
    ) {
      return [];
    }
    const currentWeight = finiteCoachNumber(candidate.weight);
    const currentReps = finiteCoachNumber(candidate.reps);
    const previousWeight = convertWeight(candidate.lastWeight, candidate.lastWeightUnit, candidate.unit);
    if (currentWeight === null || currentReps === null || !Number.isFinite(previousWeight)) return [];
    return [
      {
        currentWeight,
        currentReps,
        currentRir: finiteCoachNumber(candidate.rir),
        previousWeight,
        previousReps: candidate.lastReps,
        previousRir: finiteCoachNumber(candidate.lastRir),
        historySessions: Math.max(1, Math.floor(candidate.historySessions ?? 1)),
        historySamples: Math.max(1, Math.floor(candidate.historySamples ?? 1)),
        historyFailureCount: Math.max(0, Math.floor(candidate.historyFailureCount ?? 0)),
      },
    ];
  });
  if (!comparisons.length) return null;

  const lead = comparisons[0];
  const setUnit = (task.sets ?? []).find(
    (candidate) => candidate.lastWeight !== undefined && candidate.lastWeightUnit && candidate.lastReps !== undefined,
  )?.unit;
  const unit = (setUnit ?? "kg").toUpperCase();
  const increment = setUnit === "lb" ? 5 : 2.5;
  const currentLoad = formatCoachWeight(lead.currentWeight) + " " + unit;
  const sameLoad = comparisons.filter(
    (comparison) => Math.abs(comparison.currentWeight - comparison.previousWeight) < 0.01,
  );
  const hasAddedLoad = comparisons.some((comparison) => comparison.currentWeight > comparison.previousWeight + 0.01);
  const hasLoweredLoad = comparisons.some((comparison) => comparison.currentWeight < comparison.previousWeight - 0.01);
  const hasRepRegression = comparisons.some((comparison) => comparison.currentReps < comparison.previousReps);
  const hasRirDrop = comparisons.some(
    (comparison) =>
      comparison.currentRir !== null &&
      comparison.previousRir !== null &&
      comparison.currentRir < comparison.previousRir,
  );
  const hitFailure = comparisons.some((comparison) => comparison.currentRir === 0);
  const hasFatigueSignal = hasRirDrop || hitFailure;
  const allRirRecorded = comparisons.every((comparison) => comparison.currentRir !== null);
  const effortIsInTarget = comparisons.every(
    (comparison) => comparison.currentRir !== null && comparison.currentRir >= 1 && comparison.currentRir <= 3,
  );
  const allSameLoad = sameLoad.length === comparisons.length;
  const comparableSessions = Math.min(...comparisons.map((comparison) => comparison.historySessions));
  const comparableSamples = Math.min(...comparisons.map((comparison) => comparison.historySamples));
  const historicalFailureSignal = comparisons.some((comparison) => comparison.historyFailureCount > 0);
  const hasMultipleComparableSessions = comparableSessions >= 3;
  const allSetsImproved =
    allSameLoad &&
    comparisons.length >= 2 &&
    comparisons.every((comparison) => comparison.currentReps >= comparison.previousReps + 1);
  const meaningfulGain =
    allSetsImproved && comparisons.every((comparison) => comparison.currentReps >= comparison.previousReps + 2);
  const anyRepGain = comparisons.some((comparison) => comparison.currentReps > comparison.previousReps);
  const rirGuidance = " at 1–3 RIR";

  if (hasAddedLoad) {
    if (hasRepRegression || hasFatigueSignal) {
      return {
        title: "Hold the load",
        detail:
          "Keep " +
          currentLoad +
          " for another exposure. Reps or effort worsened after the load change, so do not increase again until every tracked set is stable" +
          rirGuidance +
          ".",
        tone: "hold",
        confidence: "Medium",
      };
    }
    return {
      title: "Load test logged",
      detail:
        "Keep " +
        currentLoad +
        " for another exposure. Only test " +
        formatCoachWeight(lead.currentWeight + increment) +
        " " +
        unit +
        " again when all tracked sets hold their reps" +
        rirGuidance +
        ".",
      tone: "up",
      confidence: "Medium",
    };
  }

  if (hasLoweredLoad || hasRepRegression) {
    return {
      title: "Build the reps",
      detail:
        "Keep " + currentLoad + " until every tracked set matches its last rep count" + rirGuidance + " with control.",
      tone: "hold",
      confidence: "Medium",
    };
  }

  if (meaningfulGain && allRirRecorded && effortIsInTarget && !hasFatigueSignal && !historicalFailureSignal) {
    if (!hasMultipleComparableSessions) {
      return {
        title: "Collect more evidence",
        detail:
          "This gain is promising across " +
          comparisons.length +
          " sets, but only " +
          comparableSessions +
          " comparable session" +
          (comparableSessions === 1 ? " is" : "s are") +
          " available. Repeat the same load and rep range until 3 sessions confirm the trend before increasing weight.",
        tone: "plateau",
        confidence: "Insufficient data",
      };
    }
    return {
      title: "Evidence supports a small increase",
      detail:
        "Across " +
        comparisons.length +
        " tracked sets, reps improved by at least 2 at the same load while effort stayed" +
        rirGuidance +
        ". Test " +
        formatCoachWeight(lead.currentWeight + increment) +
        " " +
        unit +
        " next session; return to " +
        currentLoad +
        " if reps or RIR fall.",
      tone: "up",
      confidence: "High",
    };
  }

  if (allSetsImproved && hasFatigueSignal) {
    return {
      title: "Repeat and protect recovery",
      detail:
        "Reps improved, but RIR dropped or reached failure. Repeat " +
        currentLoad +
        " once more" +
        rirGuidance +
        " before considering a load change.",
      tone: "hold",
      confidence: "Medium",
    };
  }

  if (allSetsImproved && !allRirRecorded) {
    return {
      title: "Log RIR to progress",
      detail:
        "The rep gain is promising across " +
        comparisons.length +
        " sets, but RIR is missing. Repeat " +
        currentLoad +
        " and record effort" +
        rirGuidance +
        " before testing a higher load.",
      tone: "hold",
      confidence: "Insufficient data",
    };
  }

  if (anyRepGain && (comparisons.length < 2 || !hasMultipleComparableSessions)) {
    return {
      title: "Collect more evidence",
      detail:
        (comparisons.length < 2 ? "One tracked set is not enough" : "The session trend is not established yet") +
        ". Repeat " +
        currentLoad +
        " across at least two work sets and 3 comparable sessions, then log RIR" +
        rirGuidance +
        " before testing " +
        increment +
        " " +
        unit +
        ".",
      tone: "plateau",
      confidence: "Insufficient data",
    };
  }

  if (anyRepGain) {
    return {
      title: "Repeat to confirm",
      detail:
        "There is a small gain across the tracked sets, but not enough evidence for a load jump. Repeat " +
        currentLoad +
        " once more" +
        rirGuidance +
        "; change load only if the gain holds.",
      tone: "plateau",
      confidence: hasMultipleComparableSessions ? "Medium" : "Insufficient data",
    };
  }

  return {
    title: "Hold the load",
    detail:
      "Need more session data to gauge progression. Stick with " + currentLoad + rirGuidance + " for the next set.",
    tone: "plateau",
    confidence: comparableSamples >= 3 ? "Medium" : "Insufficient data",
  };
}

export function sameTask(left: TaskCardTask, right: TaskCardTask) {
  if (
    left.id !== right.id ||
    left.text !== right.text ||
    left.done !== right.done ||
    left.collapsed !== right.collapsed
  )
    return false;
  const leftSets = left.sets ?? [];
  const rightSets = right.sets ?? [];
  if (leftSets.length !== rightSets.length) return false;
  return leftSets.every((leftSet, index) => {
    const rightSet = rightSets[index];
    return (
      leftSet.id === rightSet.id &&
      leftSet.weight === rightSet.weight &&
      leftSet.unit === rightSet.unit &&
      leftSet.reps === rightSet.reps &&
      leftSet.rir === rightSet.rir &&
      leftSet.lastWeight === rightSet.lastWeight &&
      leftSet.lastWeightUnit === rightSet.lastWeightUnit &&
      leftSet.lastReps === rightSet.lastReps &&
      leftSet.lastRir === rightSet.lastRir &&
      leftSet.completed === rightSet.completed &&
      leftSet.historySessions === rightSet.historySessions &&
      leftSet.historySamples === rightSet.historySamples &&
      leftSet.historyFailureCount === rightSet.historyFailureCount
    );
  });
}

export function summarizeSetValues(values: string[], suffix: string) {
  const numbers = values.map(Number).filter(Number.isFinite);
  if (!numbers.length) return `— ${suffix}`;
  const minimum = Math.min(...numbers);
  const maximum = Math.max(...numbers);
  const format = (value: number) => (Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2))));
  return minimum === maximum ? `${format(minimum)} ${suffix}` : `${format(minimum)}–${format(maximum)} ${suffix}`;
}

export function focusNextSetInput(event: ReactKeyboardEvent<HTMLInputElement>, field: "reps" | "rir" | null) {
  if (event.key !== "Enter") return;
  event.preventDefault();
  if (!field) return event.currentTarget.blur();
  const nextInput = event.currentTarget
    .closest<HTMLElement>(".set-row")
    ?.querySelector<HTMLInputElement>(`input[data-set-field="${field}"]`);
  if (nextInput) nextInput.focus();
  else event.currentTarget.blur();
}
