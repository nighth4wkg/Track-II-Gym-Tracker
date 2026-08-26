"use client";

import { useState } from "react";
import type { EquipmentType, MuscleGroup } from "../rankTypes";
import type { RankTask } from "../rankData";
import type { DashboardSummary } from "../dashboardSummary";

export function useRankCalendarState() {
  const [rankHistoryTasks, setRankHistoryTasks] = useState<RankTask[]>([]);
  const [rankCategoryOverrides, setRankCategoryOverrides] = useState<Record<string, MuscleGroup>>({});
  const [rankEquipmentOverrides, setRankEquipmentOverrides] = useState<Record<string, EquipmentType>>({});
  const [rankHistoryVersion, setRankHistoryVersion] = useState(0);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [workoutDates, setWorkoutDates] = useState<Set<string>>(new Set());
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);

  return {
    rankHistoryTasks,
    setRankHistoryTasks,
    rankCategoryOverrides,
    setRankCategoryOverrides,
    rankEquipmentOverrides,
    setRankEquipmentOverrides,
    rankHistoryVersion,
    setRankHistoryVersion,
    calendarMonth,
    setCalendarMonth,
    workoutDates,
    setWorkoutDates,
    dashboardSummary,
    setDashboardSummary,
  };
}

export type RankCalendarState = ReturnType<typeof useRankCalendarState>;
