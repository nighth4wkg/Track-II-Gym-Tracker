import type { User } from "@supabase/supabase-js";
import type { MutableRefObject } from "react";
import type { ThemeMode } from "../trackTypes";
import type { IdentityState } from "./useIdentityState";
import type { WorkoutState } from "./useWorkoutState";
import type { SettingsState } from "./useSettingsState";
import type { RankCalendarState } from "./useRankCalendarState";
import type { TimerState } from "./useTimerState";

export type LifecycleIdentityState = Pick<
  IdentityState,
  | "setAuthLoading"
  | "setUser"
  | "setExerciseNames"
  | "setUsernamePromptOpen"
  | "setUsernameInput"
  | "setUsernameMessage"
  | "setPersonalInfo"
  | "setPersonalHeightInput"
  | "setPersonalWeightInput"
  | "setPersonalInfoPromptOpen"
  | "setPersonalInfoMessage"
  | "setAnnouncement"
  | "setAnnouncementOffset"
  | "setAdminAuthorized"
>;

export type LifecycleWorkoutState = Pick<
  WorkoutState,
  "setSidebarCollapsed" | "setMobileSidebarOpen" | "setFilter" | "setSplitMenu"
>;

export type LifecycleSettingsState = Pick<
  SettingsState,
  | "settingsOpen"
  | "completionEnabled"
  | "defaultUnit"
  | "savedSplits"
  | "dirtySplits"
  | "finishedSignatures"
  | "finishedDates"
  | "accountLocalReadyFor"
  | "setThemeMode"
  | "setCompletionEnabled"
  | "setNotificationPermission"
  | "setNotificationPrompt"
  | "setSavedSplits"
  | "setDirtySplits"
  | "setFinishedSignatures"
  | "setFinishedDates"
  | "setAccountLocalReadyFor"
  | "setSettingsTabsAtEnd"
  | "setShowScrollTop"
  | "setShowScrollBottom"
>;

export type LifecycleRankState = Pick<
  RankCalendarState,
  | "setRankCategoryOverrides"
  | "setRankEquipmentOverrides"
  | "rankHistoryVersion"
  | "setRankHistoryTasks"
  | "setDashboardSummary"
  | "setCalendarMonth"
>;

export type LifecycleTimerState = Pick<
  TimerState,
  | "timerMode"
  | "restSeconds"
  | "restCustom"
  | "timerRunning"
  | "timerRuntime"
  | "setRestRemaining"
  | "setTimerElapsed"
  | "setTimerRunning"
>;

export type LifecycleRefs = {
  savedSplitsRef: MutableRefObject<Set<string>>;
  finishedSignaturesRef: MutableRefObject<Record<string, string>>;
  finishedDatesRef: MutableRefObject<Record<string, string>>;
  mobileOrientationRef: MutableRefObject<"portrait" | "landscape" | null>;
  timerStartedAt: MutableRefObject<number>;
  restEndsAt: MutableRefObject<number>;
  settingsTabsRef: MutableRefObject<HTMLDivElement | null>;
  calendarInitializedFor: MutableRefObject<string>;
  openPasswordResetRef: MutableRefObject<() => void>;
  clearAccountClientStateRef: MutableRefObject<(userId?: string) => void>;
  announcementTimer: MutableRefObject<number | null>;
  latestAnnouncementId: MutableRefObject<string | null>;
  activeUserIdRef: MutableRefObject<string | null>;
};

export type UseTrackAppLifecycleOptions = {
  user: User | null;
  showDashboard: boolean;
  showCalendar: boolean;
  showRank: boolean;
  cloudReady: boolean;
  announcement: { id: string; message: string } | null;
  local: {
    setReady: (ready: boolean) => void;
  };
  identity: LifecycleIdentityState;
  workout: LifecycleWorkoutState;
  settings: LifecycleSettingsState;
  rank: LifecycleRankState;
  timer: LifecycleTimerState;
  markTimerChanged: () => void;
  refs: LifecycleRefs;
  updateSettingsTabsEdge: () => void;
  readWorkoutDates: (userId: string) => Promise<Set<string> | null>;
  applyWorkoutDates: (dates: Set<string>) => void;
};

export type { ThemeMode };
