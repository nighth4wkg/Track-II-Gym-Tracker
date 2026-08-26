"use client";

import { useMemo, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { ActivityPoint } from "../dashboardMetrics";

const VIEWBOX_WIDTH = 296;
const VIEWBOX_HEIGHT = 84;
const HORIZONTAL_INSET = 8;
const BASELINE_Y = 74;
const VERTICAL_RANGE = 58;
const TOOLTIP_FLIP_Y = 34;
const MAX_BAR_WIDTH = 18;
const REFERENCE_COUNT = 4;

export function DashboardActivityGraph({ points }: { points: ActivityPoint[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const geometry = useMemo(() => {
    const max = Math.max(REFERENCE_COUNT, ...points.map((point) => point.count));
    const graphWidth = VIEWBOX_WIDTH - HORIZONTAL_INSET * 2;
    const slotWidth = points.length ? graphWidth / points.length : graphWidth;
    const barWidth = Math.min(MAX_BAR_WIDTH, Math.max(8, slotWidth - 8));
    const xFor = (index: number) =>
      points.length <= 1
        ? VIEWBOX_WIDTH / 2 - barWidth / 2
        : HORIZONTAL_INSET + index * slotWidth + (slotWidth - barWidth) / 2;
    const centerXFor = (index: number) => xFor(index) + barWidth / 2;
    const yFor = (value: number) => BASELINE_Y - (value / max) * VERTICAL_RANGE;
    const heightFor = (value: number) => (value > 0 ? Math.max(3, BASELINE_Y - yFor(value)) : 0);
    return { centerXFor, yFor, heightFor, xFor, barWidth };
  }, [points]);

  const selectFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width)));
    setActiveIndex(Math.round(ratio * Math.max(0, points.length - 1)));
  };
  const activePoint = activeIndex === null ? null : points[activeIndex];
  const tooltipPlacement = activePoint && geometry.yFor(activePoint.count) < TOOLTIP_FLIP_Y ? " is-below" : "";
  const tooltipEdge =
    activeIndex !== null && points.length > 1 && activeIndex === 0
      ? " is-edge-left"
      : activeIndex !== null && points.length > 1 && activeIndex === points.length - 1
        ? " is-edge-right"
        : "";

  return (
    <div
      className={activePoint ? "dashboard-graph-wrap is-inspecting" : "dashboard-graph-wrap"}
      onPointerDown={selectFromPointer}
      onPointerMove={(event) => activePoint && selectFromPointer(event)}
      onPointerUp={() => setActiveIndex(null)}
      onPointerCancel={() => setActiveIndex(null)}
      onPointerLeave={() => setActiveIndex(null)}
    >
      <div className="dashboard-graph-stage">
        {activePoint && activeIndex !== null && (
          <output
            className={`dashboard-graph-tooltip${tooltipPlacement}${tooltipEdge}`}
            style={{
              left: `${(geometry.centerXFor(activeIndex) / VIEWBOX_WIDTH) * 100}%`,
              top: `${(geometry.yFor(activePoint.count) / VIEWBOX_HEIGHT) * 100}%`,
            }}
            aria-live="polite"
          >
            <strong>{activePoint.count}</strong>
            <span>{activePoint.label}</span>
          </output>
        )}
        <svg
          className="dashboard-activity-graph"
          viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
          preserveAspectRatio="none"
          role="img"
          aria-label="Training workouts per period bar chart"
        >
          <path d={`M${HORIZONTAL_INSET} ${BASELINE_Y}H${VIEWBOX_WIDTH - HORIZONTAL_INSET}`} />
          {points.map((point, index) => (
            <g key={`${point.shortLabel}-${index}`}>
              <rect
                className="dashboard-activity-bar-track"
                x={geometry.xFor(index)}
                y={BASELINE_Y - VERTICAL_RANGE}
                width={geometry.barWidth}
                height={VERTICAL_RANGE}
                rx={geometry.barWidth / 2}
              />
              {point.count > 0 && (
                <rect
                  className={`dashboard-activity-bar${activeIndex === index ? " is-active" : ""}`}
                  x={geometry.xFor(index)}
                  y={geometry.yFor(point.count)}
                  width={geometry.barWidth}
                  height={geometry.heightFor(point.count)}
                  rx={2}
                />
              )}
            </g>
          ))}
        </svg>
      </div>
      <div
        className="dashboard-week-labels"
        style={{ gridTemplateColumns: `repeat(${Math.max(1, points.length)}, minmax(0, 1fr))` }}
      >
        {points.length ? (
          points.map((point, index) => <span key={`${point.shortLabel}-${index}`}>{point.shortLabel}</span>)
        ) : (
          <span>Now</span>
        )}
      </div>
      <small className="dashboard-graph-hint">Hold and slide across the graph to inspect each period.</small>
    </div>
  );
}
