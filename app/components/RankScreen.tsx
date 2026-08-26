"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { applyAnimatedStyles } from "../domMotion";
import {
  buildRankSummaries,
  EQUIPMENT_LABELS,
  EQUIPMENT_TYPES,
  MUSCLE_GROUPS,
  MUSCLE_LABELS,
  RANK_META,
  type EquipmentType,
  type MuscleGroup,
  type RankTask,
} from "../rankData";
import { TRACK_LIMITS } from "../trackConstants";
import { RankBodyMap } from "./RankBodyMap";
import { MotionSelect } from "./MotionSelect";

type RankScreenProps = {
  tasks: RankTask[];
  historyTasks?: RankTask[];
  bodyWeightKg: number;
  heightCm: number;
  categoryOverrides?: Record<string, MuscleGroup>;
  equipmentOverrides?: Record<string, EquipmentType>;
  onCategoryOverride?: (exerciseId: string, group: MuscleGroup | null) => void;
  onEquipmentOverride?: (exerciseId: string, equipment: EquipmentType | null) => void;
};

function rankToneClass(label: string) {
  return `rank-tone-${label.toLowerCase().replace(/\s+/g, "-")}`;
}

function RankMeter({ progress, tone }: { progress: number; tone: string }) {
  const fillRef = useRef<HTMLElement>(null);
  const visualProgress = progress >= 99 ? 94 : progress;
  useLayoutEffect(() => {
    applyAnimatedStyles(fillRef.current, { "--rank-progress": `${visualProgress}%` }, 180);
  }, [visualProgress]);
  return (
    <span className={`rank-meter ${tone}`}>
      <i ref={fillRef} />
    </span>
  );
}

function muscleGroupFromSelect(value: string): MuscleGroup | null {
  return MUSCLE_GROUPS.find((group) => group === value) ?? null;
}

function equipmentFromSelect(value: string): EquipmentType | null {
  return EQUIPMENT_TYPES.find((equipment) => equipment === value) ?? null;
}

const MUSCLE_SELECT_OPTIONS = [
  { value: "auto", label: "Auto" },
  ...MUSCLE_GROUPS.map((group) => ({ value: group, label: MUSCLE_LABELS[group] })),
] as const;

const EQUIPMENT_SELECT_OPTIONS = [
  { value: "auto", label: "Auto" },
  ...EQUIPMENT_TYPES.map((equipment) => ({ value: equipment, label: EQUIPMENT_LABELS[equipment] })),
] as const;

export function RankScreen({
  tasks,
  historyTasks = [],
  bodyWeightKg,
  categoryOverrides = {},
  equipmentOverrides = {},
  onCategoryOverride,
  onEquipmentOverride,
}: RankScreenProps) {
  const [selectedSide, setSelectedSide] = useState<"front" | "back">("front");
  const [selected, setSelected] = useState<MuscleGroup | null>(null);
  const [switchDirection, setSwitchDirection] = useState<"forward" | "backward">("forward");
  const rankTasks = useMemo(
    () => [
      ...tasks.map((task) => {
        const exerciseId = task.exerciseId ?? task.id;
        return {
          ...task,
          exerciseId,
          rankGroupOverride: exerciseId ? categoryOverrides[exerciseId] : undefined,
          rankEquipmentOverride: exerciseId ? equipmentOverrides[exerciseId] : undefined,
          source: "current" as const,
        };
      }),
      ...historyTasks,
    ],
    [tasks, historyTasks, categoryOverrides, equipmentOverrides],
  );
  const summaries = useMemo(
    () => buildRankSummaries(rankTasks, { bodyWeightKg, recentDays: TRACK_LIMITS.rankHistoryDays }),
    [rankTasks, bodyWeightKg],
  );
  const trackedSummaries = useMemo(
    () => summaries.filter((summary) => summary.score > 0 || summary.trackedExercises > 0),
    [summaries],
  );
  const trackedExerciseCount = trackedSummaries.reduce((total, summary) => total + summary.trackedExercises, 0);
  const strongestSummary = trackedSummaries.length
    ? trackedSummaries.reduce((strongest, summary) => (summary.score > strongest.score ? summary : strongest))
    : null;
  const selectedSummary = summaries.find((summary) => summary.group === selected) ?? null;
  const selectedTone = selectedSummary ? rankToneClass(selectedSummary.label) : "";
  const selectBodyGroup = (group: MuscleGroup, side: "front" | "back") => {
    if (selected === group && selectedSide === side) {
      setSelected(null);
      return;
    }
    setSwitchDirection(
      selected === null || MUSCLE_GROUPS.indexOf(group) >= MUSCLE_GROUPS.indexOf(selected) ? "forward" : "backward",
    );
    setSelected(group);
    setSelectedSide(side);
  };
  const selectCardGroup = (group: MuscleGroup) => {
    if (selected === group) {
      setSelected(null);
      return;
    }
    setSwitchDirection(
      selected === null || MUSCLE_GROUPS.indexOf(group) >= MUSCLE_GROUPS.indexOf(selected) ? "forward" : "backward",
    );
    setSelected(group);
    setSelectedSide(group === "back" ? "back" : "front");
  };

  return (
    <div className="rank-screen">
      <div className="eyebrow">TRAINING INSIGHTS</div>
      <div className="rank-title-row">
        <div>
          <h1>Rank</h1>
          <p>Your strength by muscle group.</p>
        </div>
      </div>
      <section className="rank-insight-strip" aria-label="Rank overview">
        <div className="rank-insight-card">
          <span>Tracked groups</span>
          <strong>
            {trackedSummaries.length}/{summaries.length}
          </strong>
          <small>{trackedSummaries.length ? "with rank data" : "No data yet"}</small>
        </div>
        <div className="rank-insight-card">
          <span>Exercises analyzed</span>
          <strong>{trackedExerciseCount || "—"}</strong>
          <small>{trackedExerciseCount === 1 ? "exercise" : "across your log"}</small>
        </div>
        <div className="rank-insight-card">
          <span>Strongest area</span>
          <strong>{strongestSummary ? MUSCLE_LABELS[strongestSummary.group] : "—"}</strong>
          <small>{strongestSummary ? strongestSummary.label : "Complete a session"}</small>
        </div>
      </section>
      {!selectedSummary ? (
        <section className="rank-hero-card is-overview" aria-label="Front and back strength maps">
          <div className="rank-map-pair">
            <div className="rank-map-wrap">
              <RankBodyMap
                side="front"
                summaries={summaries}
                selected={null}
                onSelect={(group) => selectBodyGroup(group, "front")}
              />
            </div>
            <div className="rank-map-wrap">
              <RankBodyMap
                side="back"
                summaries={summaries}
                selected={null}
                onSelect={(group) => selectBodyGroup(group, "back")}
              />
            </div>
          </div>
          {!trackedSummaries.length && (
            <div className="rank-empty-note" role="status">
              <strong>Complete a workout to unlock your rank map.</strong>
              <span>Your logged sets will shape each muscle group over time.</span>
            </div>
          )}
        </section>
      ) : (
        <section className={`rank-hero-card is-focused rank-switch-${switchDirection}`} key={selectedSummary.group}>
          <div className="rank-map-wrap">
            <RankBodyMap
              side={selectedSide}
              summaries={summaries}
              selected={selected}
              onSelect={(group) => selectBodyGroup(group, selectedSide)}
            />
          </div>
          <div className="rank-hero-copy">
            <div className="rank-selected-detail">
              <div className="rank-selected-heading">
                <span className={`rank-selected-dot ${selectedTone}`} />
                <div>
                  <strong>
                    {MUSCLE_LABELS[selectedSummary.group]} - {selectedSummary.label}
                  </strong>
                </div>
              </div>
              <div className="rank-selected-list">
                {selectedSummary.matchedExercises.length ? (
                  selectedSummary.matchedExercises.map((match, index) => (
                    <div className="rank-selected-exercise" key={`${match.exercise}-${index}`}>
                      <div className="rank-selected-name">
                        <strong>{match.exercise}</strong>
                        {match.exerciseId && (
                          <div className="rank-correction-controls">
                            {onCategoryOverride && (
                              <label className="rank-category-control">
                                <span>Muscle</span>
                                <MotionSelect
                                  ariaLabel={`Muscle category for ${match.exercise}`}
                                  value={categoryOverrides[match.exerciseId] ?? "auto"}
                                  options={MUSCLE_SELECT_OPTIONS}
                                  onChange={(value) =>
                                    onCategoryOverride(
                                      match.exerciseId!,
                                      value === "auto" ? null : muscleGroupFromSelect(value),
                                    )
                                  }
                                />
                              </label>
                            )}
                            {onEquipmentOverride && (
                              <label className="rank-category-control">
                                <span>Equipment</span>
                                <MotionSelect
                                  ariaLabel={`Equipment for ${match.exercise}`}
                                  value={equipmentOverrides[match.exerciseId] ?? "auto"}
                                  options={EQUIPMENT_SELECT_OPTIONS}
                                  onChange={(value) =>
                                    onEquipmentOverride(
                                      match.exerciseId!,
                                      value === "auto" ? null : equipmentFromSelect(value),
                                    )
                                  }
                                />
                              </label>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="rank-selected-set">
                        <small>{match.bestSet}</small>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rank-selected-empty">No matching exercises yet.</div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}
      <div className="rank-section-heading">
        <div>
          <span className="rank-kicker">MUSCLE GROUPS</span>
          <h2>Strength ranks</h2>
        </div>
        <span className="rank-method">Last 12 weeks</span>
      </div>
      <section className="rank-grid" aria-label="Muscle group ranks">
        {summaries.map((summary) => {
          const tone = rankToneClass(summary.label);
          return (
            <button
              key={summary.group}
              className={selected === summary.group ? "rank-card selected" : "rank-card"}
              onClick={() => selectCardGroup(summary.group)}
            >
              <span className="rank-card-top">
                <span className="rank-card-name">{MUSCLE_LABELS[summary.group]}</span>
                <span className={`rank-card-level ${tone}`}>{summary.label}</span>
              </span>
              <RankMeter progress={summary.progress} tone={tone} />
              <span className="rank-card-bottom">
                <span>
                  {summary.trackedExercises
                    ? `${summary.trackedExercises} ${summary.trackedExercises === 1 ? "exercise" : "exercises"}`
                    : "No data yet"}
                </span>
                <span className="rank-card-progress">
                  <b>{summary.score > 0 ? `${summary.progress}%` : "-"}</b>
                  {summary.score > 0 && summary.level !== "elite" && <small>to {summary.nextLevelLabel}</small>}
                </span>
              </span>
            </button>
          );
        })}
      </section>
      <section className="rank-legend" aria-label="Rank legend">
        <div className="rank-legend-title">Rank scale</div>
        <div className="rank-legend-items">
          {(["newbie", "intermediate", "gym-bro", "advanced", "elite"] as const).map((level) => (
            <span key={level}>
              <i className={rankToneClass(RANK_META[level].label)} />
              {RANK_META[level].label}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
