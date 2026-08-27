"use client";

import { useCallback } from "react";
import type { useIdentityState } from "./useIdentityState";
import type { useRankCalendarState } from "./useRankCalendarState";
import type { useSettingsState } from "./useSettingsState";
import type { useTimerState } from "./useTimerState";
import type { useWorkoutState } from "./useWorkoutState";
import { useTrackAppLifecycle } from "./useTrackAppLifecycle";

type LifecycleOptions = Parameters<typeof useTrackAppLifecycle>[0];

type RuntimeLifecycleOptions = {
  announcement: LifecycleOptions["announcement"];
  applyWorkoutDates: LifecycleOptions["applyWorkoutDates"];
  cloudReady: LifecycleOptions["cloudReady"];
  identityState: ReturnType<typeof useIdentityState>;
  local: LifecycleOptions["local"];
  markTimerChanged: LifecycleOptions["markTimerChanged"];
  rankState: ReturnType<typeof useRankCalendarState>;
  readWorkoutDates: LifecycleOptions["readWorkoutDates"];
  refs: LifecycleOptions["refs"];
  settingsState: ReturnType<typeof useSettingsState>;
  showDashboard: LifecycleOptions["showDashboard"];
  showCalendar: LifecycleOptions["showCalendar"];
  showRank: LifecycleOptions["showRank"];
  timerState: ReturnType<typeof useTimerState>;
  user: LifecycleOptions["user"];
  workoutState: ReturnType<typeof useWorkoutState>;
};

export function useTrackAppRuntimeLifecycle({
  announcement,
  applyWorkoutDates,
  cloudReady,
  identityState,
  local,
  markTimerChanged,
  rankState,
  readWorkoutDates,
  refs,
  settingsState,
  showDashboard,
  showCalendar,
  showRank,
  timerState,
  user,
  workoutState,
}: RuntimeLifecycleOptions) {
  const { setSettingsTabsAtEnd } = settingsState;
  const updateSettingsTabsEdge = useCallback(() => {
    const element = refs.settingsTabsRef.current;
    if (!element) return;
    setSettingsTabsAtEnd(element.scrollLeft + element.clientWidth >= element.scrollWidth - 2);
  }, [refs.settingsTabsRef, setSettingsTabsAtEnd]);

  useTrackAppLifecycle({
    user,
    showDashboard,
    showCalendar,
    showRank,
    cloudReady,
    announcement,
    local,
    identity: {
      setAuthLoading: identityState.setAuthLoading,
      setAuthMessage: identityState.setAuthMessage,
      setUser: identityState.setUser,
      setExerciseNames: identityState.setExerciseNames,
      setUsernamePromptOpen: identityState.setUsernamePromptOpen,
      setUsernameInput: identityState.setUsernameInput,
      setUsernameMessage: identityState.setUsernameMessage,
      setPersonalInfo: identityState.setPersonalInfo,
      setPersonalHeightInput: identityState.setPersonalHeightInput,
      setPersonalWeightInput: identityState.setPersonalWeightInput,
      setPersonalInfoPromptOpen: identityState.setPersonalInfoPromptOpen,
      setPersonalInfoMessage: identityState.setPersonalInfoMessage,
      setAnnouncement: identityState.setAnnouncement,
      setAnnouncementOffset: identityState.setAnnouncementOffset,
      setAdminAuthorized: identityState.setAdminAuthorized,
    },
    workout: {
      setSidebarCollapsed: workoutState.setSidebarCollapsed,
      setMobileSidebarOpen: workoutState.setMobileSidebarOpen,
      setFilter: workoutState.setFilter,
      setSplitMenu: workoutState.setSplitMenu,
    },
    settings: {
      settingsOpen: settingsState.settingsOpen,
      completionEnabled: settingsState.completionEnabled,
      defaultUnit: settingsState.defaultUnit,
      savedSplits: settingsState.savedSplits,
      dirtySplits: settingsState.dirtySplits,
      finishedSignatures: settingsState.finishedSignatures,
      finishedDates: settingsState.finishedDates,
      accountLocalReadyFor: settingsState.accountLocalReadyFor,
      setThemeMode: settingsState.setThemeMode,
      setCompletionEnabled: settingsState.setCompletionEnabled,
      setNotificationPermission: settingsState.setNotificationPermission,
      setNotificationPrompt: settingsState.setNotificationPrompt,
      setSavedSplits: settingsState.setSavedSplits,
      setDirtySplits: settingsState.setDirtySplits,
      setFinishedSignatures: settingsState.setFinishedSignatures,
      setFinishedDates: settingsState.setFinishedDates,
      setAccountLocalReadyFor: settingsState.setAccountLocalReadyFor,
      setSettingsTabsAtEnd: settingsState.setSettingsTabsAtEnd,
      setShowScrollTop: settingsState.setShowScrollTop,
      setShowScrollBottom: settingsState.setShowScrollBottom,
    },
    rank: {
      setRankCategoryOverrides: rankState.setRankCategoryOverrides,
      setRankEquipmentOverrides: rankState.setRankEquipmentOverrides,
      rankHistoryVersion: rankState.rankHistoryVersion,
      setRankHistoryTasks: rankState.setRankHistoryTasks,
      setDashboardSummary: rankState.setDashboardSummary,
      setCalendarMonth: rankState.setCalendarMonth,
    },
    timer: {
      timerMode: timerState.timerMode,
      restSeconds: timerState.restSeconds,
      restCustom: timerState.restCustom,
      timerRunning: timerState.timerRunning,
      timerRuntime: timerState.timerRuntime,
      setRestRemaining: timerState.setRestRemaining,
      setTimerElapsed: timerState.setTimerElapsed,
      setTimerRunning: timerState.setTimerRunning,
    },
    markTimerChanged,
    refs,
    updateSettingsTabsEdge,
    readWorkoutDates,
    applyWorkoutDates,
  });
}
