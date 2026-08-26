"use client";

import { useMemo, useState } from "react";
import { buildRankSummaries } from "../rankData";
import { detectExerciseTargets } from "../exerciseClassifier.js";
import {
  averageVolumeForDates,
  buildActivityPoints,
  dateKeyTimestamp,
  formatShortDate,
  performedDateKey,
  performedTimestamp,
  splitVolumeTrend,
  timeframeBounds,
  volumeByWorkoutDate,
  WEEK_MS,
  type DashboardTimeframe,
} from "../dashboardMetrics";
import { buildProgressFeed } from "../dashboardProgressFeed";
import type { RankTask } from "../rankModels";
import type { Checklist } from "../trackTypes";
import { TRACK_LIMITS } from "../trackConstants";
import { DashboardActivityGraph } from "./DashboardActivityGraph";
import { MotionSelect } from "./MotionSelect";

type DashboardScreenProps = {
  lists: Checklist[];
  rankTasks: RankTask[];
  historyTasks: RankTask[];
  workoutDates: Set<string>;
  bodyWeightKg: number;
};

const WEEKLY_SET_TARGET = TRACK_LIMITS.weeklyMuscleSetTarget;
const TIMEFRAME_OPTIONS: { value: DashboardTimeframe; label: string }[] = [
  { value: "week", label: "Last week" },
  { value: "month", label: "Last month" },
  { value: "ytd", label: "Year to date" },
  { value: "all", label: "All time" },
];

function formatVolumeLoad(value: number) {
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Math.round(Math.max(0, value)))} kg`;
}

function formatVolumeDelta(value: number) {
  const direction = value > 0 ? "↑" : value < 0 ? "↓" : "→";
  return `${direction} ${Math.abs(value)}%`;
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

export function buildDashboardMetrics(
  { lists, rankTasks, historyTasks, workoutDates, bodyWeightKg }: DashboardScreenProps,
  timeframe: DashboardTimeframe = "week",
) {
  const now = Date.now();
  const canonicalWorkoutDates = new Set([...workoutDates].filter((dateKey) => dateKeyTimestamp(dateKey) > 0));
  if (!canonicalWorkoutDates.size) {
    historyTasks
      .map(performedDateKey)
      .filter(Boolean)
      .forEach((dateKey) => canonicalWorkoutDates.add(dateKey));
  }
  const workoutTimestamps = [...canonicalWorkoutDates].map(dateKeyTimestamp);
  const allTimestamps = workoutTimestamps;
  const { start, end } = timeframeBounds(timeframe, allTimestamps, now);
  const summaries = buildRankSummaries([...rankTasks, ...historyTasks], { bodyWeightKg });
  const ranked = summaries.filter((summary) => summary.score > 0);
  const overallScore = ranked.length ? ranked.reduce((sum, summary) => sum + summary.score, 0) / ranked.length : 0;
  const selectedWorkoutDates = [...canonicalWorkoutDates]
    .filter((dateKey) => {
      const timestamp = dateKeyTimestamp(dateKey);
      return timestamp >= start && timestamp <= end;
    })
    .sort();
  const selectedDateSet = new Set(selectedWorkoutDates);
  const selectedHistory = historyTasks.filter((task) => selectedDateSet.has(performedDateKey(task)));
  const historyVolumeByDate = volumeByWorkoutDate(historyTasks);
  const recentAverageVolume = averageVolumeForDates(selectedHistory, selectedWorkoutDates);
  const volumeChange = splitVolumeTrend(selectedHistory, selectedWorkoutDates);
  const totalVolume = [...canonicalWorkoutDates].reduce(
    (sum, dateKey) => sum + (historyVolumeByDate.get(dateKey) ?? 0),
    0,
  );
  const activity = buildActivityPoints(workoutTimestamps, timeframe, start, end);
  const activityWorkoutCount = activity.reduce((sum, point) => sum + point.count, 0);
  const recentWorkouts = selectedWorkoutDates.length;
  const totalSets = lists.reduce(
    (sum, list) => sum + list.tasks.reduce((taskSum, task) => taskSum + Math.max(1, task.sets?.length ?? 0), 0),
    0,
  );
  const weeklySets = new Map<string, number>();
  historyTasks
    .filter((task) => performedTimestamp(task) >= now - WEEK_MS)
    .forEach((task) => {
      const primaryGroup = detectExerciseTargets(task.text).targets[0]?.group;
      if (!primaryGroup) return;
      weeklySets.set(primaryGroup, (weeklySets.get(primaryGroup) ?? 0) + (task.sets?.length ?? 0));
    });
  const muscleBalance = summaries
    .map((summary) => ({
      group: summary.group,
      score: summary.score,
      label: summary.label,
      color: summary.color,
      progress: summary.progress,
      weeklySets: weeklySets.get(summary.group) ?? 0,
    }))
    .sort((left, right) => right.score - left.score);

  return {
    splitCount: lists.length,
    exerciseCount: rankTasks.length,
    totalSets,
    recentWorkouts,
    recentAverageVolume,
    overallScore,
    volumeChange,
    totalVolume,
    activity,
    activityWorkoutCount,
    muscleBalance,
    progressFeed: buildProgressFeed(selectedHistory),
  };
}

export function DashboardScreen(props: DashboardScreenProps) {
  const [timeframe, setTimeframe] = useState<DashboardTimeframe>("week");
  const { lists, rankTasks, historyTasks, workoutDates, bodyWeightKg } = props;
  const metrics = useMemo(
    () => buildDashboardMetrics({ lists, rankTasks, historyTasks, workoutDates, bodyWeightKg }, timeframe),
    [bodyWeightKg, historyTasks, lists, rankTasks, timeframe, workoutDates],
  );
  const timeframeLabel = TIMEFRAME_OPTIONS.find((option) => option.value === timeframe)?.label ?? "All time";

  return (
    <section className="dashboard-screen">
      <span className="eyebrow">OVERVIEW</span>
      <div className="dashboard-title-row">
        <div>
          <h1>Dashboard</h1>
          <p>Your training pattern across every split.</p>
        </div>
        <MotionSelect
          className="dashboard-period-select"
          ariaLabel="Dashboard timeframe"
          value={timeframe}
          options={TIMEFRAME_OPTIONS}
          onChange={setTimeframe}
        />
      </div>

      <div className="dashboard-stat-grid" key={`dashboard-stats-${timeframe}`}>
        <article>
          <span>Workouts</span>
          <strong>{metrics.recentWorkouts}</strong>
          <small>{timeframeLabel.toLowerCase()}</small>
        </article>
        <article>
          <span>Exercises tracked</span>
          <strong>{metrics.exerciseCount}</strong>
          <small>across {metrics.splitCount} splits</small>
        </article>
        <article>
          <span>Planned sets</span>
          <strong>{metrics.totalSets}</strong>
          <small>current program</small>
        </article>
        <article>
          <span>Volume load</span>
          <div className="dashboard-volume-metric">
            <strong className={timeframe === "all" ? "all-time-volume" : "baseline"}>
              {timeframe === "all"
                ? formatVolumeLoad(metrics.totalVolume)
                : metrics.recentWorkouts
                  ? formatVolumeLoad(metrics.recentAverageVolume)
                  : "—"}
            </strong>
            {metrics.volumeChange !== null && (
              <small className={`dashboard-volume-delta ${metrics.volumeChange >= 0 ? "positive" : "negative"}`}>
                {formatVolumeDelta(metrics.volumeChange)}
              </small>
            )}
          </div>
          <small>
            {timeframe === "all"
              ? "total across all workouts"
              : metrics.recentWorkouts
                ? "average per workout"
                : "no logged workouts"}
          </small>
        </article>
      </div>

      <div className="dashboard-grid">
        <article className="dashboard-card dashboard-activity-card">
          <div className="dashboard-card-heading">
            <div>
              <span>Consistency</span>
              <strong>{timeframe === "week" || timeframe === "month" ? "Weekly activity" : "Monthly activity"}</strong>
            </div>
            <small>
              {metrics.activityWorkoutCount} {metrics.activityWorkoutCount === 1 ? "workout" : "workouts"}
            </small>
          </div>
          <DashboardActivityGraph points={metrics.activity} key={`dashboard-activity-${timeframe}`} />
        </article>

        <article className="dashboard-card dashboard-strength-card">
          <div className="dashboard-card-heading">
            <div>
              <span>Strength index</span>
              <strong>{metrics.overallScore ? metrics.overallScore.toFixed(2) : "—"}</strong>
            </div>
            <small>all muscle groups</small>
          </div>
          <div className="dashboard-muscle-list">
            {metrics.muscleBalance.map((item) => (
              <div key={item.group}>
                <span>{titleCase(item.group)}</span>
                <i>
                  <b style={{ width: `${Math.max(3, item.progress)}%`, backgroundColor: item.color }} />
                </i>
                <em style={{ color: item.color, borderColor: item.color }}>{item.label}</em>
              </div>
            ))}
          </div>
        </article>

        <article className="dashboard-card dashboard-feed-card">
          <div className="dashboard-card-heading">
            <div>
              <span>Progression</span>
              <strong>Recent PRs &amp; lifts</strong>
            </div>
          </div>
          <div className="dashboard-progress-feed">
            {metrics.progressFeed.length ? (
              metrics.progressFeed.map((item) => (
                <div key={item.id}>
                  <i className={item.pr ? "is-pr" : ""} aria-hidden="true" />
                  <div>
                    <strong>{item.exercise}</strong>
                    <span>{item.detail}</span>
                  </div>
                  <time dateTime={new Date(item.timestamp).toISOString()}>{formatShortDate(item.timestamp)}</time>
                </div>
              ))
            ) : (
              <p className="dashboard-empty-copy">Log another workout to start your progression feed.</p>
            )}
          </div>
        </article>

        <article className="dashboard-card dashboard-volume-card" aria-describedby="dashboard-recovery-description">
          <div className="dashboard-card-heading">
            <div>
              <span>Recovery radar</span>
              <strong>Weekly sets by muscle</strong>
            </div>
            <small>target {WEEKLY_SET_TARGET} sets</small>
          </div>
          <p id="dashboard-recovery-description" className="dashboard-card-description">
            Shows your sets from the last 7 days against a {WEEKLY_SET_TARGET}-set reference target. Use it as a volume
            guide—not a measure of fatigue or medical recovery.
          </p>
          <div className="dashboard-volume-list">
            {metrics.muscleBalance.map((item) => (
              <div key={item.group}>
                <span>{titleCase(item.group)}</span>
                <i>
                  <b style={{ width: `${Math.min(100, (item.weeklySets / WEEKLY_SET_TARGET) * 100)}%` }} />
                </i>
                <small>
                  {item.weeklySets}/{WEEKLY_SET_TARGET}
                </small>
              </div>
            ))}
          </div>
          <p className="dashboard-volume-note">A guide, not a prescription—recovery needs vary by person.</p>
        </article>
      </div>
    </section>
  );
}
