import type { WeightUnit } from "./trackTypes.ts";
import { WEIGHT_CONVERSION_FACTOR } from "./trackConstants.ts";

export type PersonalMeasurement = "height" | "weight";

export const PERSONAL_CONVERSION = {
  centimetersPerInch: 2.54,
  poundsPerKilogram: WEIGHT_CONVERSION_FACTOR,
} as const;

function formatMeasurement(value: number) {
  return String(Number(value.toFixed(1)));
}

function metricToImperialFactor(measurement: PersonalMeasurement) {
  return measurement === "height" ? 1 / PERSONAL_CONVERSION.centimetersPerInch : PERSONAL_CONVERSION.poundsPerKilogram;
}

function imperialToMetricFactor(measurement: PersonalMeasurement) {
  return measurement === "height" ? PERSONAL_CONVERSION.centimetersPerInch : 1 / PERSONAL_CONVERSION.poundsPerKilogram;
}

export function formatPersonalInput(value: string, measurement: PersonalMeasurement, unit: WeightUnit) {
  if (unit === "kg" || !value.trim()) return value;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? formatMeasurement(numeric * metricToImperialFactor(measurement)) : value;
}

export function toMetricPersonalInput(value: string, measurement: PersonalMeasurement, unit: WeightUnit) {
  if (unit === "kg" || !value.trim()) return value;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? formatMeasurement(numeric * imperialToMetricFactor(measurement)) : value;
}
