"use client";

import { useState } from "react";
export function useNavigationState() {
  const [showTimer, setShowTimer] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showRank, setShowRank] = useState(false);

  return {
    showTimer,
    setShowTimer,
    showCalendar,
    setShowCalendar,
    showRank,
    setShowRank,
  };
}

export type NavigationState = ReturnType<typeof useNavigationState>;
