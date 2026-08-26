"use client";

import { useState } from "react";
export function useNavigationState() {
  const [showDashboard, setShowDashboard] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showRank, setShowRank] = useState(false);

  return {
    showDashboard,
    setShowDashboard,
    showTimer,
    setShowTimer,
    showCalendar,
    setShowCalendar,
    showRank,
    setShowRank,
  };
}

export type NavigationState = ReturnType<typeof useNavigationState>;
