"use client";

import { useMemo, useState } from "react";
import {
  buildRankSummaries,
  EQUIPMENT_LABELS,
  EQUIPMENT_TYPES,
  MUSCLE_GROUPS,
  MUSCLE_LABELS,
  RANK_META,
  strongestRankSummary,
  type EquipmentType,
  type MuscleGroup,
  type RankLevel,
  type RankTask,
} from "../rankData";
import { TRACK_LIMITS } from "../trackConstants";
import { RankBodyMap } from "./RankBodyMap";
import { RankMeter } from "./RankMeter";
import { MotionSelect } from "./MotionSelect";
import { PageHeader } from "./PageHeader";
import { runViewTransition } from "../viewTransitions";

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

const RANK_LEVELS: RankLevel[] = ["newbie", "intermediate", "gym-bro", "advanced", "elite"];
const RANK_LABELS = {
  untracked: "Needs data",
  newbie: "Newbie",
  intermediate: "Pump chaser",
  "gym-bro": "Locked in",
  advanced: "Chad",
  elite: "Final boss",
} satisfies Record<RankLevel, string>;

function rankDisplayLabel(level: RankLevel) {
  return RANK_LABELS[level];
}

function nextDisplayRankLabel(level: RankLevel) {
  const index = RANK_LEVELS.indexOf(level);
  const next = index >= 0 ? RANK_LEVELS[index + 1] : RANK_LEVELS[0];
  return next ? rankDisplayLabel(next) : "Elite mastery";
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

function RankSideToggle({ side, onChange }: { side: "front" | "back"; onChange: (side: "front" | "back") => void }) {
  return (
    <div className="rank-map-toggle" role="tablist" aria-label="Body view">
      {(["front", "back"] as const).map((option) => (
        <button
          key={option}
          type="button"
          role="tab"
          aria-selected={side === option}
          className={side === option ? "selected" : ""}
          onClick={() => onChange(option)}
        >
          {option === "front" ? "Front" : "Back"}
        </button>
      ))}
    </div>
  );
}

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
  const strongestSummary = strongestRankSummary(trackedSummaries);
  const selectedSummary = summaries.find((summary) => summary.group === selected) ?? null;
  const selectedTone = selectedSummary ? rankToneClass(RANK_META[selectedSummary.level].label) : "";
  const selectGroup = (group: MuscleGroup, side: "front" | "back", canToggle = true) => {
    runViewTransition(() => {
      if (canToggle && selected === group && selectedSide === side) {
        setSelected(null);
        return;
      }
      setSwitchDirection(
        selected === null || MUSCLE_GROUPS.indexOf(group) >= MUSCLE_GROUPS.indexOf(selected) ? "forward" : "backward",
      );
      setSelected(group);
      setSelectedSide(side);
    });
  };
  const switchSide = (side: "front" | "back") => {
    if (side === selectedSide) return;
    runViewTransition(() => {
      setSwitchDirection(side === "back" ? "forward" : "backward");
      setSelectedSide(side);
    });
  };

  return (
    <div className="rank-screen">
      <PageHeader
        className="rank-page-header"
        eyebrow="TRAINING INSIGHTS"
        title="Rank"
        description="Your strength by muscle group."
      />
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
          <small>
            {strongestSummary
              ? `${rankDisplayLabel(strongestSummary.level)} · ${strongestSummary.progress}% through tier`
              : "Complete a session"}
          </small>
        </div>
      </section>
      {!selectedSummary ? (
        <section className="rank-hero-card is-overview" aria-label="Front and back strength maps">
          <div className="rank-map-wrap">
            <div className="rank-map-toolbar">
              <span>View</span>
              <RankSideToggle side={selectedSide} onChange={switchSide} />
            </div>
            <RankBodyMap
              summaries={summaries}
              selected={null}
              activeSide={selectedSide}
              onSelect={(group, side) => selectGroup(group, side)}
            />
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
            <div className="rank-map-toolbar">
              <span>View</span>
              <RankSideToggle side={selectedSide} onChange={switchSide} />
            </div>
            <RankBodyMap
              summaries={summaries}
              selected={selected}
              activeSide={selectedSide}
              onSelect={(group, side) => selectGroup(group, side)}
            />
          </div>
          <div className="rank-hero-copy">
            <div className="rank-selected-detail">
              <div className="rank-selected-heading">
                <span className={`rank-selected-dot ${selectedTone}`} />
                <div>
                  <strong>
                    {MUSCLE_LABELS[selectedSummary.group]} - {rankDisplayLabel(selectedSummary.level)}
                  </strong>
                </div>
              </div>
              <div className="rank-selected-list">
                {selectedSummary.matchedExercises.length ? (
                  selectedSummary.matchedExercises.map((match, index) => (
                    <div className="rank-selected-exercise" key={`${match.exercise}-${index}`}>
                      <div className="rank-selected-primary">
                        <strong>{match.exercise}</strong>
                        <span className="rank-selected-set">{match.bestSet}</span>
                      </div>
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
          const tone = rankToneClass(RANK_META[summary.level].label);
          const label = rankDisplayLabel(summary.level);
          return (
            <button
              key={summary.group}
              className={selected === summary.group ? "rank-card selected" : "rank-card"}
              onClick={() => selectGroup(summary.group, summary.group === "back" ? "back" : "front")}
            >
              <span className="rank-card-top">
                <span className="rank-card-name">{MUSCLE_LABELS[summary.group]}</span>
                <span className={`rank-card-level ${tone}`}>{label}</span>
              </span>
              <RankMeter progress={summary.progress} eliteProgress={summary.eliteProgress} tone={tone} />
              <span className="rank-card-bottom">
                <span>
                  {summary.trackedExercises
                    ? `${summary.trackedExercises} ${summary.trackedExercises === 1 ? "exercise" : "exercises"}`
                    : "No data yet"}
                </span>
                <span className="rank-card-progress">
                  <b>{summary.score > 0 ? `${summary.eliteProgress}% to Elite` : "-"}</b>
                  {summary.score > 0 && (
                    <small>
                      {summary.level === "elite"
                        ? "Elite reached"
                        : `${summary.progress}% through ${label} · next ${nextDisplayRankLabel(summary.level)}`}
                    </small>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </section>
      <section className="rank-legend" aria-label="Rank legend">
        <div className="rank-legend-header">
          <div>
            <div className="rank-legend-title">Rank scale</div>
            <small>Bars show total progress to Elite</small>
          </div>
        </div>
        <div className="rank-legend-items">
          {RANK_LEVELS.map((level) => (
            <span key={level}>
              <i className={rankToneClass(RANK_META[level].label)} />
              {rankDisplayLabel(level)}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
