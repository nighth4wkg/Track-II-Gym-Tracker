import type { KeyboardEvent as ReactKeyboardEvent } from "react";

export type TaskCardSet = {
  id: string;
  weight: string;
  unit: "kg" | "lb";
  reps: string;
  rir: string;
  lastWeight?: number;
  lastWeightUnit?: "kg" | "lb";
  lastReps?: number;
  lastRir?: number;
};

export type TaskCardTask = {
  id: string;
  text: string;
  sets?: TaskCardSet[];
  done: boolean;
  collapsed?: boolean;
};

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
      leftSet.lastRir === rightSet.lastRir
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
