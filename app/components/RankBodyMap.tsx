import { useLayoutEffect, useMemo, useRef } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from "react";
import rankMuscleMapSvg from "../assets/rank-muscle-map.svg?raw";
import { MUSCLE_LABELS, type MuscleGroup } from "../rankData";
import type { RankSummary } from "../rankModels";

type RankBodySide = "front" | "back";

type RankBodyMapProps = {
  summaries: RankSummary[];
  selected: MuscleGroup | null;
  activeSide?: RankBodySide | null;
  onSelect: (group: MuscleGroup, side: RankBodySide) => void;
};

const BASE_FILL = "#e8e8e8";
const MUSCLE_PATH_SELECTOR = "path[data-muscle-group]";
const RANK_MAP_MARKUP = { __html: rankMuscleMapSvg };
const FULL_MAP_VIEWBOX = "0 0 900 600";
const FOCUSED_VIEWBOX = {
  front: "0 0 450 600",
  back: "450 0 450 600",
} satisfies Record<RankBodySide, string>;

export const RANK_MUSCLE_PATH_IDS = [
  "chest_l",
  "chest_r",
  "deltoid_front_l",
  "deltoid_front_r",
  "deltoid_rear_l",
  "deltoid_rear_r",
  "biceps_l",
  "biceps_r",
  "triceps_l",
  "triceps_r",
  "forearm_l",
  "forearm_r",
  "forearm_back_l",
  "forearm_back_r",
  "abs_upper",
  "abs_lower",
  "obliques_l",
  "obliques_r",
  "lats_l",
  "lats_r",
  "traps_upper",
  "traps_mid",
  "traps_lower",
  "rhomboids",
  "quad_l",
  "quad_r",
  "hamstring_l",
  "hamstring_r",
  "calf_l",
  "calf_r",
  "calf_back_l",
  "calf_back_r",
  "glute_l",
  "glute_r",
  "erector_spinae",
] as const;

function isActivationKey(event: ReactKeyboardEvent<HTMLDivElement>) {
  return event.key === "Enter" || event.key === " ";
}

function getMusclePath(target: EventTarget | null, root: HTMLDivElement | null) {
  if (!(target instanceof Element) || !root) return null;
  const path = target.closest<SVGPathElement>(MUSCLE_PATH_SELECTOR);
  return path && root.contains(path) ? path : null;
}

function isMuscleGroup(value: string): value is MuscleGroup {
  return value in MUSCLE_LABELS;
}

function rankFill(summary: RankSummary | undefined) {
  return summary && Number.isFinite(summary.score) && summary.score > 0 && summary.color ? summary.color : BASE_FILL;
}

export function RankBodyMap({ summaries, selected, activeSide = null, onSelect }: RankBodyMapProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const colors = useMemo(() => new Map(summaries.map((summary) => [summary.group, summary])), [summaries]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const svg = root.querySelector<SVGSVGElement>("svg.rank-body-map");
    const isFocused = Boolean(selected && activeSide);
    if (svg) {
      svg.setAttribute("viewBox", isFocused && activeSide ? FOCUSED_VIEWBOX[activeSide] : FULL_MAP_VIEWBOX);
      svg.setAttribute("aria-label", isFocused ? `${activeSide} strength map` : "Front and back body muscle map");
      root.dataset.activeSide = isFocused && activeSide ? activeSide : "all";
      root.setAttribute(
        "aria-label",
        isFocused && activeSide ? `${activeSide} body muscle map` : "Front and back body muscle map",
      );
      root.classList.toggle("is-focused", isFocused);
      root.querySelectorAll<SVGGElement>("#front-view, #back-view").forEach((view) => {
        view.setAttribute("aria-hidden", String(isFocused && view.id !== `${activeSide}-view`));
      });
    }

    root.querySelectorAll<SVGPathElement>(MUSCLE_PATH_SELECTOR).forEach((path) => {
      const groupValue = path.dataset.muscleGroup;
      const side = path.dataset.view;
      if (!groupValue || !isMuscleGroup(groupValue)) return;
      const summary = colors.get(groupValue);
      const isSelected = selected === groupValue && (!activeSide || activeSide === side);
      const isDimmed = Boolean(selected && !isSelected);
      const fill = rankFill(summary);
      path.setAttribute("fill", fill);
      path.style.setProperty("fill", fill);
      path.style.setProperty("--rank-muscle-color", fill);
      path.classList.toggle("is-selected", isSelected);
      path.classList.toggle("is-dimmed", isDimmed);
      path.setAttribute("aria-pressed", String(isSelected));
    });
  });

  function handleClick(event: ReactMouseEvent<HTMLDivElement>) {
    const path = getMusclePath(event.target, rootRef.current);
    if (!path) return;
    const group = path.dataset.muscleGroup;
    const side = path.dataset.view;
    if (group && side && isMuscleGroup(group) && (side === "front" || side === "back")) onSelect(group, side);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!isActivationKey(event)) return;
    const path = getMusclePath(event.target, rootRef.current);
    if (!path) return;
    const group = path.dataset.muscleGroup;
    const side = path.dataset.view;
    if (!group || !side || !isMuscleGroup(group) || (side !== "front" && side !== "back")) return;
    event.preventDefault();
    onSelect(group, side);
  }

  return (
    <div
      ref={rootRef}
      className="rank-body-map-shell"
      role="group"
      aria-label="Front and back body muscle map"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      dangerouslySetInnerHTML={RANK_MAP_MARKUP}
    />
  );
}
