import type { MuscleGroup } from "./rankTypes";
import type { Filter, SettingsView, ThemeMode, WeightUnit } from "./trackTypes";

export const SETTINGS_CONTENT_VIEWS: SettingsView[] = [
  "appearance",
  "personal",
  "privacy",
  "workout",
  "data",
  "ai",
  "account",
];

export const THEME_MODES: ThemeMode[] = ["light", "dark"];
export const WEIGHT_UNITS: WeightUnit[] = ["kg", "lb"];
export const FILTER_OPTIONS: Filter[] = ["all", "open", "done"];
export const FILTER_LABELS = {
  all: "All exercises",
  open: "To do",
  done: "Completed",
} satisfies Record<Filter, string>;

// Product limits live in one data-only map so validation and copy stay aligned
// across the web and native shells.
export const TRACK_LIMITS = {
  minUsernameChars: 2,
  maxUsernameChars: 24,
  rankHistoryDays: 84,
  announcementLookbackDays: 7,
  maxRestSeconds: 3600,
  defaultRestSeconds: 90,
  minHeightCm: 100,
  maxHeightCm: 250,
  minWeightKg: 25,
  maxWeightKg: 350,
  maxAiImageBytes: 8 * 1024 * 1024,
  maxAnnouncementChars: 240,
  maxSplitNameChars: 40,
  usernameCheckDebounceMs: 250,
  undoDragRange: 180,
  undoSwipeDistance: 64,
} as const;

export const USERNAME_PATTERN = new RegExp(
  `^[a-zA-Z0-9_.-]{${TRACK_LIMITS.minUsernameChars},${TRACK_LIMITS.maxUsernameChars}}$`,
);

export const TRACK_INTERACTION = {
  maxExerciseSuggestions: 8,
  maxSetWeightChars: 6,
  maxSetCountChars: 3,
  maxCustomRestChars: 5,
  maxRepsOrRir: 100,
  dragMovementThreshold: 10,
  dragPointerHoldMs: 220,
  dragTouchHoldMs: 360,
  dragAutoScrollMinEdge: 110,
  dragAutoScrollMaxEdge: 170,
  dragAutoScrollViewportRatio: 0.24,
  focusDelayMs: 120,
} as const;

export const TRACK_TIMING = {
  workoutDateOptimisticTimeoutMs: 20_000,
  undoNoticeDurationMs: 6_000,
  settingsCloseAnimationMs: 260,
  settingsTabsScrollMs: 260,
  settingsTabsScrollStepPx: 180,
  undoDismissMs: 360,
  passwordResetCloseMs: 900,
  syncSavedFeedbackMs: 900,
  preferenceSaveRetryBaseMs: 1_000,
  preferenceSaveRetryMaxMs: 30_000,
  announcementDismissMs: 5_000,
  notificationDeliveryTimeoutMs: 5_000,
  adminHeartbeatStaleMs: 45_000,
  adminHeartbeatPollMs: 60_000,
  preferenceFallbackPollMs: 30_000,
  initialSyncRetryBaseMs: 1_000,
  initialSyncRetryMaxMs: 30_000,
  cloudSaveRetryMaxAttempts: 6,
  cloudWritePollMs: 250,
  cloudRequestTimeoutMs: 15_000,
  preferenceSaveDebounceMs: 450,
  announcementPollMs: 60_000,
  calendarDetailRefreshMs: 30_000,
  adminDirectoryClockMs: 30_000,
  adminMemberMenuHoldMs: 520,
  exportUrlRevokeMs: 1_000,
  splitCreateDelayMs: 360,
  touchDoubleTapGuardMs: 320,
  stopwatchTickMs: 31,
  restTimerTickMs: 200,
  releaseCountdownTickMs: 200,
  workoutFinishSavedDelayMs: 360,
  workoutFinishTransitionMs: 440,
} as const;

export const REST_PRESETS = [
  { seconds: 60, label: "1 min" },
  { seconds: TRACK_LIMITS.defaultRestSeconds, label: "1.5 min" },
  { seconds: 120, label: "2 min" },
] as const;
export const REST_PRESET_SECONDS: readonly number[] = REST_PRESETS.map(({ seconds }) => seconds);

export const BOTTOM_TAB_HOLD_MS = 110;
export const BOTTOM_TAB_DRAG_START_DISTANCE = 5;
export const BOTTOM_TAB_SWITCH_HYSTERESIS = 8;
export const BOTTOM_TAB_CANCEL_DISTANCE = 10;

export const SETTINGS_LABELS = {
  appearance: "Appearance",
  personal: "Personal Info",
  privacy: "Privacy & Notifications",
  updates: "Updates",
  workout: "Workout",
  data: "Data & Backup",
  ai: "AI Import",
  account: "Account & Security",
  about: "About Track II",
  admin: "Admin Panel",
} satisfies Record<SettingsView, string>;

export const TRACK_UI_COPY = {
  status: {
    saved: "Saved",
    saving: "Saving…",
    loading: "Loading…",
    syncing: "Syncing…",
    savedLocally: "Saved locally · Syncing…",
    updated: "Updated",
    retrying: "Retrying…",
    retry: "Couldn’t save · Retry",
    offline: "Offline · Retry",
    loadRetry: "Couldn’t load · Retry",
  },
  empty: {
    exercises: "No exercises yet",
    exercisesHint: "Add an exercise above.",
    filtered: "Nothing here yet",
    filteredHint: "Complete an exercise to see it here.",
  },
} as const;

export const MOBILE_SIDEBAR_GESTURE_EDGE = 68;
export const MOBILE_SIDEBAR_SWIPE_DISTANCE = 52;
export const MOBILE_SIDEBAR_SWIPE_DISTANCE_AWAY_FROM_EDGE = 72;
export const MOBILE_SIDEBAR_SWIPE_DIRECTION_RATIO = 1.12;
export const MOBILE_SIDEBAR_SWIPE_DIRECTION_RATIO_AWAY_FROM_EDGE = 1.3;
export const DESKTOP_SIDEBAR_SWIPE_DISTANCE = 36;
export const DESKTOP_SIDEBAR_SWIPE_DIRECTION_RATIO = 1.08;
export const MUSCLE_GROUPS: MuscleGroup[] = ["chest", "back", "shoulders", "arms", "legs", "core"];

export const QUERY_PAGE_SIZE = 1000;
// Keep large historical accounts from turning a paginated read into a browser-memory spike.
export const MAX_QUERY_PAGES = 100;

export const SITE_UPDATE_COUNTDOWN_SECONDS = 3;
// A deployment can briefly expose the new release manifest before its HTML
// and JavaScript are consistent at every edge. Remember one attempted reload
// per browser session so that propagation never becomes a reload loop.
export const SITE_UPDATE_RELOAD_GUARD_KEY = "track-update-reload-attempt";
// Keep already-open tabs reasonably fresh without turning the release manifest into a high-frequency request.
export const SITE_UPDATE_POLL_MS = 5 * 60 * 1000;
export const SYNC_SAVE_DEBOUNCE_MS = 350;
export const SYNC_REFRESH_DEBOUNCE_MS = 180;
export const SYNC_FALLBACK_POLL_MS = 60_000;
export const CALENDAR_SYNC_POLL_MS = 30_000;

export const ACCOUNT_LOCAL_KEYS = [
  "saved-splits",
  "dirty-splits",
  "finished-signatures",
  "finished-dates",
  "active-split",
] as const;
