"use client";

import { useMemo, useState } from "react";
import "../styles/pages/dashboard.css";
import { detectExerciseTargets } from "../exerciseClassifier.js";
import { buildRankSummaries } from "../rankData";
import {
  aggregateSessions,
  averageVolumeForSessions,
  buildActivityPoints,
  formatShortDate,
  performedTimestamp,
  splitVolumeTrendForSessions,
  startOfLocalDay,
  timeframeBounds,
  type DashboardSessionMetric,
  type DashboardTimeframe,
} from "../dashboardMetrics";
import type { DashboardSummary, DashboardVolumePeriod } from "../dashboardSummary";
import { buildProgressFeed } from "../dashboardProgressFeed";
import type { RankSummary, RankTask } from "../rankModels";
import type { Checklist } from "../trackTypes";
import { TRACK_LIMITS } from "../trackConstants";
import { DashboardActivityGraph } from "./DashboardActivityGraph";
import { MotionSelect } from "./MotionSelect";

export type DashboardScreenProps = {
  lists: Checklist[];
  rankTasks: RankTask[];
  historyTasks: RankTask[];
  workoutDates: Set<string>;
  bodyWeightKg: number;
  dashboardSummary?: DashboardSummary | null;
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

function formatLiftLoad(value: number, unit: "kg" | "lb") {
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Math.round(Math.max(0, value)))} ${unit}`;
}

function formatVolumeDelta(value: number) {
  const direction = value > 0 ? "↑" : value < 0 ? "↓" : "→";
  return `${direction} ${Math.abs(value)}%`;
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

function sessionTimestamp(session: DashboardSessionMetric) {
  const timestamp = new Date(session.createdAt).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function summaryProgressFeed(summary: DashboardSummary) {
  return summary.progressFeed.map((item) => ({
    id: item.id,
    exercise: item.exercise,
    detail: `${formatLiftLoad(item.weight, item.unit)} × ${item.reps} reps${item.isPr ? " · PR" : ""}`,
    timestamp: new Date(item.createdAt).getTime(),
    pr: item.isPr,
  }));
}

function sessionSource(
  summary: DashboardSummary | null | undefined,
  historyTasks: RankTask[],
  workoutDates: Set<string>,
) {
  if (summary && (summary.sessions.length > 0 || summary.sessionCount === 0)) return summary.sessions;
  return aggregateSessions(historyTasks, workoutDates);
}

export type DashboardStableMetrics = {
  splitCount: number;
  exerciseCount: number;
  totalSets: number;
  overallScore: number;
  muscleBalance: Array<RankSummary & { weeklySets: number }>;
  progressFeed: ReturnType<typeof buildProgressFeed>;
  sessions: DashboardSessionMetric[];
  totalVolume: number;
  volumeByPeriod: Partial<Record<DashboardTimeframe, DashboardVolumePeriod>>;
};

/** Stable calculations intentionally do not depend on the selected timeframe. */
export function buildDashboardStableMetrics({
  lists,
  rankTasks,
  historyTasks,
  workoutDates,
  bodyWeightKg,
  dashboardSummary,
}: DashboardScreenProps): DashboardStableMetrics {
  const sessions = sessionSource(dashboardSummary, historyTasks, workoutDates);
  const summaries = buildRankSummaries([...rankTasks, ...historyTasks], { bodyWeightKg });
  const ranked = summaries.filter((summary) => summary.score > 0);
  const overallScore = ranked.length ? ranked.reduce((sum, summary) => sum + summary.score, 0) / ranked.length : 0;
  const totalSets = lists.reduce(
    (sum, list) => sum + list.tasks.reduce((taskSum, task) => taskSum + Math.max(1, task.sets?.length ?? 0), 0),
    0,
  );
  const weeklySets = new Map<string, number>();
  if (dashboardSummary?.weeklyMuscleTotals.length) {
    for (const item of dashboardSummary.weeklyMuscleTotals) weeklySets.set(item.group, item.setCount);
  } else if (dashboardSummary?.weeklyExerciseSets.length) {
    for (const item of dashboardSummary.weeklyExerciseSets) {
      const primaryGroup = detectExerciseTargets(item.exerciseName).targets[0]?.group;
      if (primaryGroup) weeklySets.set(primaryGroup, (weeklySets.get(primaryGroup) ?? 0) + item.setCount);
    }
  } else {
    const now = Date.now();
    for (const task of historyTasks) {
      if (performedTimestamp(task) < startOfLocalDay(now - 6 * 24 * 60 * 60 * 1000)) continue;
      const primaryGroup = detectExerciseTargets(task.text).targets[0]?.group;
      if (primaryGroup) weeklySets.set(primaryGroup, (weeklySets.get(primaryGroup) ?? 0) + (task.sets?.length ?? 0));
    }
  }
  const muscleBalance = summaries
    .map((summary) => ({ ...summary, weeklySets: weeklySets.get(summary.group) ?? 0 }))
    .sort((left, right) => right.score - left.score);

  return {
    splitCount: lists.length,
    exerciseCount: rankTasks.length,
    totalSets,
    overallScore,
    muscleBalance,
    progressFeed: dashboardSummary?.progressFeed.length
      ? summaryProgressFeed(dashboardSummary)
      : buildProgressFeed(historyTasks),
    sessions,
    totalVolume:
      dashboardSummary?.volumeByPeriod.all?.volumeKg ??
      sessions.reduce((sum, session) => sum + Math.max(0, session.volumeKg), 0),
    volumeByPeriod: dashboardSummary?.volumeByPeriod ?? {},
  };
}

export function buildDashboardTimeframeMetrics(
  stable: DashboardStableMetrics,
  timeframe: DashboardTimeframe = "week",
  now = Date.now(),
) {
  const timestamps = stable.sessions.map(sessionTimestamp).filter((timestamp) => timestamp > 0);
  const { start, end } = timeframeBounds(timeframe, timestamps, now);
  const selectedSessions = stable.sessions.filter((session) => {
    const timestamp = sessionTimestamp(session);
    return timestamp >= start && timestamp <= end;
  });
  const activity = buildActivityPoints(timestamps, timeframe, start, end);
  const progressFeed = stable.progressFeed.filter((item) => item.timestamp >= start && item.timestamp <= end);
  const serverPeriod = stable.volumeByPeriod[timeframe];
  return {
    ...stable,
    recentWorkouts: serverPeriod?.sessionCount ?? selectedSessions.length,
    recentAverageVolume:
      serverPeriod && serverPeriod.sessionCount > 0
        ? serverPeriod.volumeKg / serverPeriod.sessionCount
        : averageVolumeForSessions(selectedSessions),
    volumeChange: splitVolumeTrendForSessions(selectedSessions),
    activity,
    activityWorkoutCount: activity.reduce((sum, point) => sum + point.count, 0),
    progressFeed,
  };
}

export function buildDashboardMetrics(
  props: DashboardScreenProps,
  timeframe: DashboardTimeframe = "week",
  now = Date.now(),
) {
  return buildDashboardTimeframeMetrics(buildDashboardStableMetrics(props), timeframe, now);
}

export function DashboardScreen(props: DashboardScreenProps) {
  const [timeframe, setTimeframe] = useState<DashboardTimeframe>("week");
  const { lists, rankTasks, historyTasks, workoutDates, bodyWeightKg, dashboardSummary } = props;
  const stableMetrics = useMemo(
    () => buildDashboardStableMetrics({ lists, rankTasks, historyTasks, workoutDates, bodyWeightKg, dashboardSummary }),
    [bodyWeightKg, dashboardSummary, historyTasks, lists, rankTasks, workoutDates],
  );
  const metrics = useMemo(() => buildDashboardTimeframeMetrics(stableMetrics, timeframe), [stableMetrics, timeframe]);
  const timeframeLabel = TIMEFRAME_OPTIONS.find((option) => option.value === timeframe)?.label ?? "Last week";

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
