"use client";

import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
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

function BodyMap({
  side,
  summaries,
  selected,
  onSelect,
}: {
  side: "front" | "back";
  summaries: ReturnType<typeof buildRankSummaries>;
  selected: MuscleGroup | null;
  onSelect: (group: MuscleGroup) => void;
}) {
  const colors = new Map(summaries.map((summary) => [summary.group, summary.color]));
  const color = (group: MuscleGroup) => colors.get(group) ?? RANK_META.untracked.color;
  const opacity = (group: MuscleGroup) => (selected && selected !== group ? 0.25 : 1);
  const focusProps = (group: MuscleGroup, label = MUSCLE_LABELS[group]) => ({
    fill: color(group),
    opacity: opacity(group),
    className: "rank-body-region",
    onClick: () => onSelect(group),
    role: "button",
    tabIndex: 0,
    onKeyDown: (event: ReactKeyboardEvent<SVGGElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelect(group);
      }
    },
    "aria-label": label,
  });

  return (
    <svg className="rank-body-map" viewBox="0 0 320 520" aria-label={`${side} body muscle map`} role="img">
      <g className="rank-neutral-parts">
        <path d="M143 22 Q160 9 177 22 Q186 37 181 60 Q175 78 160 84 Q145 78 139 60 Q134 37 143 22 Z" />
        <path d="M147 78 L173 78 L180 101 L169 113 L151 113 L140 101 Z" />
        <path d="M70 264 L58 285 L61 303 L76 286 L82 266 Z M250 264 L262 285 L259 303 L244 286 L238 266 Z" />
        <path d="M119 484 Q108 494 103 505 L142 505 L145 491 Z M201 484 Q212 494 217 505 L178 505 L175 491 Z" />
        <path d="M151 275 L160 285 L169 275 L174 300 L160 315 L146 300 Z" />
      </g>
      {side === "front" ? (
        <>
          <g {...focusProps("shoulders")}>
            <path d="M139 103 Q113 98 92 114 Q82 124 84 143 Q91 157 104 163 L127 141 L151 116 Z" />
            <path d="M181 103 Q207 98 228 114 Q238 124 236 143 Q229 157 216 163 L193 141 L169 116 Z" />
          </g>
          <g {...focusProps("chest")}>
            <path d="M151 113 Q126 113 112 133 Q113 159 151 169 L157 121 Z" />
            <path d="M169 113 Q194 113 208 133 Q207 159 169 169 L163 121 Z" />
          </g>
          <g {...focusProps("arms", "Biceps and brachialis")}>
            <path d="M92 143 Q76 159 75 190 L84 212 L100 188 L108 158 Z M228 143 Q244 159 245 190 L236 212 L220 188 L212 158 Z" />
          </g>
          <g {...focusProps("arms", "Forearms")}>
            <path d="M84 207 Q68 228 66 258 L70 283 L87 251 L89 216 Z M236 207 Q252 228 254 258 L250 283 L233 251 L231 216 Z" />
          </g>
          <g {...focusProps("core", "Obliques and serratus")}>
            <path d="M112 158 Q111 207 124 267 L140 275 L132 214 L151 171 Z" />
            <path d="M208 158 Q209 207 196 267 L180 275 L188 214 L169 171 Z" />
          </g>
          <g {...focusProps("core", "Abdominals")}>
            <path d="M133 173 L155 175 L155 204 L134 202 Z M165 175 L187 173 L186 202 L165 204 Z" />
            <path d="M135 209 L155 209 L155 238 L137 236 Z M165 209 L185 209 L183 236 L165 238 Z" />
            <path d="M138 243 L155 243 L155 272 L142 267 Z M165 243 L182 243 L178 267 L165 272 Z" />
          </g>
          <g {...focusProps("legs", "Quadriceps")}>
            <path d="M143 274 Q117 276 109 303 Q104 348 119 391 L143 374 L153 309 L151 282 Z M177 274 Q203 276 211 303 Q216 348 201 391 L177 374 L167 309 L169 282 Z" />
          </g>
          <g {...focusProps("legs", "Hamstrings and calves")}>
            <path d="M151 310 L146 372 L126 410 L145 424 L156 382 L157 317 Z M169 310 L174 372 L194 410 L175 424 L164 382 L163 317 Z" />
            <path d="M122 392 Q109 414 116 442 Q120 452 132 457 L139 490 L145 455 L141 419 Z M198 392 Q211 414 204 442 Q200 452 188 457 L181 490 L175 455 L179 419 Z" />
          </g>
        </>
      ) : (
        <>
          <g {...focusProps("shoulders")}>
            <path d="M139 103 Q113 98 92 114 Q82 124 84 143 Q91 157 104 163 L127 141 L151 116 Z" />
            <path d="M181 103 Q207 98 228 114 Q238 124 236 143 Q229 157 216 163 L193 141 L169 116 Z" />
          </g>
          <g {...focusProps("back")}>
            <path d="M145 104 L175 104 L187 141 L160 165 L133 141 Z" />
            <path d="M132 126 Q108 147 111 194 L133 235 L154 173 L153 119 Z M188 126 Q212 147 209 194 L187 235 L166 173 L167 119 Z" />
            <path d="M134 205 L157 176 L157 274 L127 267 Z M186 205 L163 176 L163 274 L193 267 Z" />
          </g>
          <g {...focusProps("arms", "Triceps")}>
            <path d="M92 143 Q76 159 75 190 L84 212 L100 188 L108 158 Z M228 143 Q244 159 245 190 L236 212 L220 188 L212 158 Z" />
          </g>
          <g {...focusProps("arms", "Forearms")}>
            <path d="M84 207 Q68 228 66 258 L70 283 L87 251 L89 216 Z M236 207 Q252 228 254 258 L250 283 L233 251 L231 216 Z" />
          </g>
          <g {...focusProps("legs", "Glutes and hamstrings")}>
            <path d="M151 270 Q119 271 108 301 Q108 333 126 348 L153 337 Z M169 270 Q201 271 212 301 Q212 333 194 348 L167 337 Z" />
            <path d="M126 342 Q106 368 117 410 L142 427 L153 342 Z M194 342 Q214 368 203 410 L178 427 L167 342 Z" />
          </g>
          <g {...focusProps("legs", "Calves")}>
            <path d="M119 402 Q108 420 114 441 Q118 453 130 458 L139 490 L147 453 L142 423 Z M201 402 Q212 420 206 441 Q202 453 190 458 L181 490 L173 453 L178 423 Z" />
          </g>
        </>
      )}
      <g className="rank-anatomy-separators" aria-hidden="true">
        {side === "front" ? (
          <>
            <path d="M109 159 Q126 169 148 169 M211 159 Q194 169 172 169" />
            <path d="M111 185 Q121 194 132 198 M209 185 Q199 194 188 198" />
            <path d="M84 207 Q92 212 100 188 M236 207 Q228 212 220 188" />
            <path d="M136 278 Q147 286 156 280 M164 280 Q173 286 184 278" />
            <path d="M127 390 Q137 398 147 392 M193 390 Q183 398 173 392" />
            <path d="M131 410 Q137 432 139 455 M189 410 Q183 432 181 455" />
          </>
        ) : (
          <>
            <path d="M92 143 Q112 155 133 163 M228 143 Q208 155 187 163" />
            <path d="M145 104 L160 133 L175 104" />
            <path d="M132 190 Q145 198 154 205 M188 190 Q175 198 166 205" />
            <path d="M131 264 Q145 272 155 264 M189 264 Q175 272 165 264" />
            <path d="M126 342 Q141 351 153 342 M194 342 Q179 351 167 342" />
            <path d="M132 409 Q138 431 139 456 M188 409 Q182 431 181 456" />
          </>
        )}
      </g>
    </svg>
  );
}

function muscleGroupFromSelect(value: string): MuscleGroup | null {
  return MUSCLE_GROUPS.find((group) => group === value) ?? null;
}

function equipmentFromSelect(value: string): EquipmentType | null {
  return EQUIPMENT_TYPES.find((equipment) => equipment === value) ?? null;
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
  const selectedSummary = summaries.find((summary) => summary.group === selected) ?? null;
  const selectedTone = selectedSummary ? rankToneClass(selectedSummary.label) : "";
  const selectBodyGroup = (group: MuscleGroup, side: "front" | "back") => {
    if (selected === group && selectedSide === side) {
      setSelected(null);
      return;
    }
    setSelected(group);
    setSelectedSide(side);
  };
  const selectCardGroup = (group: MuscleGroup) => {
    if (selected === group) {
      setSelected(null);
      return;
    }
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
      {!selectedSummary ? (
        <section className="rank-hero-card is-overview" aria-label="Front and back strength maps">
          <div className="rank-map-pair">
            <div className="rank-map-wrap">
              <BodyMap
                side="front"
                summaries={summaries}
                selected={null}
                onSelect={(group) => selectBodyGroup(group, "front")}
              />
            </div>
            <div className="rank-map-wrap">
              <BodyMap
                side="back"
                summaries={summaries}
                selected={null}
                onSelect={(group) => selectBodyGroup(group, "back")}
              />
            </div>
          </div>
        </section>
      ) : (
        <section className="rank-hero-card is-focused" key={selectedSummary.group}>
          <div className="rank-map-wrap">
            <BodyMap
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
                                <select
                                  value={categoryOverrides[match.exerciseId] ?? "auto"}
                                  onChange={(event) =>
                                    onCategoryOverride(
                                      match.exerciseId!,
                                      event.target.value === "auto" ? null : muscleGroupFromSelect(event.target.value),
                                    )
                                  }
                                >
                                  <option value="auto">Auto</option>
                                  {MUSCLE_GROUPS.map((group) => (
                                    <option key={group} value={group}>
                                      {MUSCLE_LABELS[group]}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            )}
                            {onEquipmentOverride && (
                              <label className="rank-category-control">
                                <span>Equipment</span>
                                <select
                                  value={equipmentOverrides[match.exerciseId] ?? "auto"}
                                  onChange={(event) =>
                                    onEquipmentOverride(
                                      match.exerciseId!,
                                      event.target.value === "auto" ? null : equipmentFromSelect(event.target.value),
                                    )
                                  }
                                >
                                  <option value="auto">Auto</option>
                                  {EQUIPMENT_TYPES.map((equipment) => (
                                    <option key={equipment} value={equipment}>
                                      {EQUIPMENT_LABELS[equipment]}
                                    </option>
                                  ))}
                                </select>
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
