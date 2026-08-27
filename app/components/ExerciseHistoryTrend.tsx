"use client";

import type { WeightUnit } from "../trackTypes.ts";
import { valueInUnit, type ExerciseHistoryTrendPoint } from "../exerciseHistoryMetrics.ts";

const VIEWBOX_WIDTH = 320;
const VIEWBOX_HEIGHT = 96;
const GRAPH_LEFT = 10;
const GRAPH_RIGHT = 10;
const GRAPH_TOP = 12;
const GRAPH_BOTTOM = 22;

function formatValue(valueKg: number, unit: WeightUnit) {
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(valueInUnit(valueKg, unit))} ${unit}`;
}

function signedPercent(first: number, last: number) {
  if (first <= 0 || first === last) return first === last ? "0%" : null;
  const value = Math.round(((last - first) / first) * 100);
  return `${value > 0 ? "+" : ""}${value}%`;
}

export function ExerciseHistoryTrend({
  points,
  unit,
}: {
  points: readonly ExerciseHistoryTrendPoint[];
  unit: WeightUnit;
}) {
  if (!points.length) return null;
  const minValue = Math.min(...points.map((point) => point.valueKg));
  const maxValue = Math.max(...points.map((point) => point.valueKg));
  const padding = maxValue === minValue ? Math.max(1, maxValue * 0.12) : (maxValue - minValue) * 0.18;
  const domainMin = Math.max(0, minValue - padding);
  const domainMax = maxValue + padding;
  const domainRange = Math.max(1, domainMax - domainMin);
  const graphWidth = VIEWBOX_WIDTH - GRAPH_LEFT - GRAPH_RIGHT;
  const graphHeight = VIEWBOX_HEIGHT - GRAPH_TOP - GRAPH_BOTTOM;
  const xFor = (index: number) =>
    points.length === 1 ? VIEWBOX_WIDTH / 2 : GRAPH_LEFT + (index / (points.length - 1)) * graphWidth;
  const yFor = (value: number) => GRAPH_TOP + ((domainMax - value) / domainRange) * graphHeight;
  const path = points.map((point, index) => `${index ? "L" : "M"}${xFor(index)} ${yFor(point.valueKg)}`).join(" ");
  const change = signedPercent(points[0].valueKg, points[points.length - 1].valueKg);
  const latest = points[points.length - 1];

  return (
    <section className="exercise-history-trend" aria-label="Estimated one-rep max progression">
      <div className="exercise-history-trend-heading">
        <div>
          <span>Estimated 1RM</span>
          <strong>
            {formatValue(latest.valueKg, unit)}
            {change && <small>{change}</small>}
          </strong>
        </div>
        <span>{points.length} sessions</span>
      </div>
      <svg
        className="exercise-history-trend-graph"
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        role="img"
        aria-label={`Estimated 1RM from ${points[0].label} to ${latest.label}`}
      >
        <path
          className="exercise-history-trend-guide"
          d={`M${GRAPH_LEFT} ${VIEWBOX_HEIGHT - GRAPH_BOTTOM}H${VIEWBOX_WIDTH - GRAPH_RIGHT}`}
        />
        <path className="exercise-history-trend-line" d={path} />
        {points.map((point, index) => (
          <circle key={point.key} cx={xFor(index)} cy={yFor(point.valueKg)} r="3.5">
            <title>{`${point.label}: ${formatValue(point.valueKg, unit)}`}</title>
          </circle>
        ))}
      </svg>
      <div
        className="exercise-history-trend-labels"
        style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}
      >
        {points.map((point, index) => (
          <span
            key={point.key}
            className={points.length > 4 && index !== 0 && index !== points.length - 1 ? "is-muted" : ""}
          >
            {points.length <= 4 ||
            index === 0 ||
            index === Math.floor((points.length - 1) / 2) ||
            index === points.length - 1
              ? point.label
              : ""}
          </span>
        ))}
      </div>
    </section>
  );
}
