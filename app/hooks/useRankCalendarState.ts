"use client";

import { useState } from "react";
import type { EquipmentType, MuscleGroup } from "../rankTypes";
import type { RankTask } from "../rankData";

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
  };
}

export type RankCalendarState = ReturnType<typeof useRankCalendarState>;
