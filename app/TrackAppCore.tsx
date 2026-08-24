"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { AppLoadingSkeleton } from "./components/LoadingSkeletons";
import { AuthScreen } from "./components/AuthScreen";
import { TrackAppView } from "./components/TrackAppView";
import type { BottomTabId } from "./components/BottomTabBar";
import { useIdentityState } from "./hooks/useIdentityState";
import { useWorkoutState } from "./hooks/useWorkoutState";
import { useSettingsState } from "./hooks/useSettingsState";
import { useNavigationState } from "./hooks/useNavigationState";
import { useRankCalendarState } from "./hooks/useRankCalendarState";
import { useTimerState } from "./hooks/useTimerState";
import { useBottomTabNavigation } from "./hooks/useBottomTabNavigation";
import { useWorkoutEditorController } from "./hooks/useWorkoutEditorController";
import { useReleaseManager } from "./hooks/useReleaseManager";
import { useTrackAppRuntimeLifecycle } from "./hooks/useTrackAppRuntimeLifecycle";
import { useTrackCloudSync, type TrackSyncEventName, type TrackSyncEventPayload } from "./hooks/useTrackCloudSync";
import { useTrackAccountActions } from "./hooks/useTrackAccountActions";
import { useUndoNotice } from "./hooks/useUndoNotice";
import { useWorkoutDateSync } from "./hooks/useWorkoutDateSync";
import { useSavedWorkoutMarkers } from "./hooks/useSavedWorkoutMarkers";
import { useTrackAppInteractions } from "./hooks/useTrackAppInteractions";
import { useTimerActions } from "./hooks/useTimerActions";
import { useTimerPersistence } from "./hooks/useTimerPersistence";
import { useSidebarGestures } from "./hooks/useSidebarGestures";
import { useSplitReorderGesture } from "./hooks/useSplitReorderGesture";
import { useSplitActions } from "./hooks/useSplitActions";
import { useTrackAppWorkoutActions } from "./hooks/useTrackAppWorkoutActions";

import type { AiExercise, Checklist } from "./trackTypes";

const EMPTY_TASKS: Checklist["tasks"] = [];

export default function TrackApp() {
  const nativeApp = Capacitor.isNativePlatform();
  const identityState = useIdentityState();
  const {
    user,
    setUser,
    authLoading,
    setUsernamePromptOpen,
    usernameInput,
    setUsernameMessage,
    setUsernameSaving,
    setPersonalInfo,
    personalHeightInput,
    personalWeightInput,
    setPersonalInfoPromptOpen,
    setPersonalInfoSaving,
    setPersonalInfoMessage,
    cloudReady,
    setCloudReady,
    exerciseNames,
    setSyncLabel,
    siteUpdateSeconds,
    setSiteUpdateSeconds,
    updateReady,
    setUpdateReady,
    setUpdatesViewBusy,
    setUpdatesViewMessage,
    adminAuthorized,
    setAdminAuthorized,
    setUpdateCheckBusy,
    setUpdateCheckMessage,
    setAvailableUpdateVersion,
    announcement,
    setAnnouncement,
  } = identityState;
  const workoutState = useWorkoutState();
  const {
    lists,
    setLists,
    activeId,
    setActiveId,
    searchQuery,
    setSearchQuery,
    splitName,
    setShowSuggestions,
    setSplitMenu,
    setRenamingId,
    setHomeTransition,
    setProgressFading,
    setWorkoutActionsExiting,
    sidebarCollapsed,
    setSidebarCollapsed,
    setMobileExerciseMenu,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    setFilter,
    dragging,
    setDragging,
    setDraggingSplit,
    setEditing,
  } = workoutState;
  const settingsState = useSettingsState();
  const {
    setThemeMode,
    setSettingsOpen,
    settingsClosing,
    setSettingsClosing,
    setSettingsView,
    completionEnabled,
    setCompletionEnabled,
    rememberExercisesAcrossSplits,
    setRememberExercisesAcrossSplits,
    setPasswordResetOpen,
    passwordResetValue,
    setPasswordResetValue,
    passwordResetConfirm,
    setPasswordResetConfirm,
    setPasswordResetMessage,
    setPasswordResetBusy,
    setNotificationPrompt,
    notificationRequestBusy,
    setNotificationRequestBusy,
    setNotificationPermission,
    setNotificationSettingsAvailable,
    setNotificationMessage,
    setAdminUsersOpen,
    announcementText,
    setAnnouncementText,
    announcementSendBusy,
    setAnnouncementSendBusy,
    setAnnouncementSendMessage,
    setPendingExerciseName,
    defaultUnit,
    setDefaultUnit,
    setSavedSplits,
    setDirtySplits,
    setFinishedSignatures,
    setFinishedDates,
    accountLocalReadyFor,
    setAccountLocalReadyFor,
  } = settingsState;
  const navigationState = useNavigationState();
  const { showTimer, setShowTimer, showCalendar, setShowCalendar, showRank, setShowRank } = navigationState;
  const rankState = useRankCalendarState();
  const {
    setRankHistoryTasks,
    rankCategoryOverrides,
    setRankCategoryOverrides,
    rankEquipmentOverrides,
    setRankEquipmentOverrides,
    setRankHistoryVersion,
    setWorkoutDates,
  } = rankState;
  const timerState = useTimerState();
  const {
    timerMode,
    setTimerMode,
    restSeconds,
    setRestSeconds,
    restCustom,
    setRestCustom,
    setCustomRestInput,
    timerRunning,
    setTimerRunning,
    timerElapsed,
    setTimerElapsed,
    restRemaining,
    setRestRemaining,
    timerLaps,
    setTimerLaps,
    timerRuntime,
    setTimerRuntime,
    setTimerTransition,
    setTimerTransitionKey,
  } = timerState;
  const finishedSignaturesRef = useRef<Record<string, string>>({});
  const finishedDatesRef = useRef<Record<string, string>>({});
  const savedSplitsRef = useRef<Set<string>>(new Set());
  const timerStartedAt = useRef(timerMode === "stopwatch" ? (timerRuntime.startedAtMs ?? 0) : 0);
  const restEndsAt = useRef(timerMode === "rest" ? (timerRuntime.restEndsAtMs ?? 0) : 0);
  const timerSwipeStart = useRef<{ x: number; y: number; pointerType: "touch" | "mouse" | "pen" } | null>(null);
  const [exportBusy, setExportBusy] = useState<"csv" | "json" | null>(null);
  const [exportMessage, setExportMessage] = useState("");
  // API keys are intentionally memory-only. Session storage is readable by
  // same-profile extensions and survives navigation within the tab; keeping
  // the key in React state still preserves the active import flow without
  // leaving the secret at rest in browser storage.
  const [aiKey, setAiKey] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiExercises, setAiExercises] = useState<AiExercise[]>([]);
  const [ready, setReady] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const settingsCloseTimer = useRef<number | null>(null);
  const mobileOrientationRef = useRef<"portrait" | "landscape" | null>(null);
  const openPasswordResetRef = useRef<() => void>(() => undefined);
  const clearAccountClientStateRef = useRef<(userId?: string) => void>(() => undefined);
  const applySavedTodayMarkersRef = useRef<
    (savedToday: Set<string>, sourceLists: Checklist[], clearStaleDirty: boolean) => void
  >(() => undefined);
  const broadcastSyncEventRef = useRef<(event: TrackSyncEventName, payload?: TrackSyncEventPayload) => void>(
    () => undefined,
  );
  const invalidateCloudReadsRef = useRef<() => void>(() => undefined);
  const resetCloudSyncStateRef = useRef<() => void>(() => undefined);
  const cloudSaveInFlightRef = useRef<() => boolean>(() => false);
  const siteUpdateCheckRef = useRef<((manual?: boolean) => Promise<"update" | "current" | "error">) | null>(null);
  const announcementTimer = useRef<number | null>(null);
  const latestAnnouncementId = useRef<string | null>(null);
  const announcementDragStart = useRef<number | null>(null);
  const activeUserIdRef = useRef<string | null>(null);
  const workoutFinishInFlight = useRef(false);
  const composerRef = useRef<HTMLFormElement>(null);
  const settingsTabsRef = useRef<HTMLDivElement>(null);
  const calendarInitializedFor = useRef("");
  const { markTimerChanged, applyTimerRuntime } = useTimerPersistence({
    timerMode,
    timerRunning,
    timerElapsed,
    restRemaining,
    timerLaps,
    timerStartedAtRef: timerStartedAt,
    restEndsAtRef: restEndsAt,
    setTimerMode,
    setTimerRunning,
    setTimerElapsed,
    setRestRemaining,
    setTimerLaps,
    setTimerRuntime,
  });

  const undoState = useUndoNotice();

  const workoutDateSync = useWorkoutDateSync({
    userId: user?.id,
    setWorkoutDates,
    savedSplitsRef,
    finishedSignaturesRef,
    finishedDatesRef,
    setSavedSplits,
    setFinishedSignatures,
    setFinishedDates,
    broadcastSyncEvent: (event, payload) => broadcastSyncEventRef.current(event, payload),
  });
  const {
    applyWorkoutDates,
    readWorkoutDates,
    markWorkoutDate,
    removeWorkoutDate,
    restoreWorkoutDate,
    resetWorkoutDateSync,
  } = workoutDateSync;

  const timerActions = useTimerActions({
    timerMode,
    timerRunning,
    timerElapsed,
    restSeconds,
    restRemaining,
    restCustom,
    timerStartedAtRef: timerStartedAt,
    restEndsAtRef: restEndsAt,
    timerSwipeStartRef: timerSwipeStart,
    setTimerMode,
    setTimerRunning,
    setTimerElapsed,
    setRestSeconds,
    setRestRemaining,
    setRestCustom,
    setCustomRestInput,
    setTimerTransition,
    setTimerTransitionKey,
    onTimerChanged: markTimerChanged,
  });
  const sidebarGestures = useSidebarGestures({
    mobileSidebarOpen,
    setMobileSidebarOpen,
    timerMode,
    sidebarCollapsed,
    setSidebarCollapsed,
  });
  const splitReorder = useSplitReorderGesture({ setLists, setDraggingSplit, setSplitMenu });

  const active = lists.find((list) => list.id === activeId);
  const splitActions = useSplitActions({
    active,
    activeId,
    lists,
    splitName,
    inputRef,
    savedSplitsRef,
    finishedSignaturesRef,
    finishedDatesRef,
    offerUndo: undoState.offerUndo,
    setLists,
    setActiveId,
    setShowTimer,
    setShowCalendar,
    setShowRank,
    setFilter,
    setSearchQuery,
    setHomeTransition,
    setMobileSidebarOpen,
    setEditing,
    setSplitMenu,
    setRenamingId,
    setSavedSplits,
    setFinishedSignatures,
    setFinishedDates,
    setDirtySplits,
  });
  const activeBottomTab: BottomTabId = showRank ? "rank" : showCalendar ? "calendar" : showTimer ? "timer" : "workout";
  const tasks = active?.tasks ?? EMPTY_TASKS;
  const workoutEditor = useWorkoutEditorController({
    activeId,
    lists,
    tasks,
    dragging,
    savedSplitsRef,
    setLists,
    setDirtySplits,
    setSavedSplits,
    setWorkoutActionsExiting,
    setDragging,
    setEditing,
    setMobileExerciseMenu,
    setDefaultUnit,
    offerUndo: undoState.offerUndo,
  });
  const { updateTasks } = workoutEditor;
  const accountActions = useTrackAccountActions({
    user,
    personalHeightInput,
    personalWeightInput,
    usernameInput,
    passwordResetValue,
    passwordResetConfirm,
    rankCategoryOverrides,
    rankEquipmentOverrides,
    timerMode,
    restSeconds,
    setPersonalInfo,
    setPersonalInfoSaving,
    setPersonalInfoMessage,
    setPersonalInfoPromptOpen,
    setUser,
    setUsernameMessage,
    setUsernameSaving,
    setUsernamePromptOpen,
    setRankCategoryOverrides,
    setRankEquipmentOverrides,
    setSyncLabel,
    setPasswordResetBusy,
    setPasswordResetMessage,
    setPasswordResetValue,
    setPasswordResetConfirm,
    setPasswordResetOpen,
    setAiKey,
    timerStartedAtRef: timerStartedAt,
    restEndsAtRef: restEndsAt,
    resetCloudSyncStateRef,
    resetWorkoutDateSync,
    setTimerRunning,
    setTimerElapsed,
    setRestRemaining,
    setTimerLaps,
    setTimerRuntime,
    setLists,
    setActiveId,
    setCloudReady,
    setAccountLocalReadyFor,
    setSavedSplits,
    setDirtySplits,
    setFinishedSignatures,
    setFinishedDates,
    setRankHistoryTasks,
    setWorkoutDates,
    setAdminAuthorized,
    setAdminUsersOpen,
    setSettingsOpen,
    setSettingsClosing,
    setNotificationPrompt,
    setAnnouncement,
    setUpdateReady,
    setAvailableUpdateVersion,
    setSiteUpdateSeconds,
    broadcastRankEquipmentOverrides: (overrides) =>
      broadcastSyncEventRef.current("rank-equipment-overrides", { overrides }),
  });
  const { openPasswordReset, clearAccountClientState } = accountActions;

  useTrackAppRuntimeLifecycle({
    announcement,
    applyWorkoutDates,
    cloudReady,
    identityState,
    local: { setReady },
    markTimerChanged,
    rankState,
    readWorkoutDates,
    refs: {
      savedSplitsRef,
      finishedSignaturesRef,
      finishedDatesRef,
      mobileOrientationRef,
      timerStartedAt,
      restEndsAt,
      settingsTabsRef,
      calendarInitializedFor,
      openPasswordResetRef,
      clearAccountClientStateRef,
      announcementTimer,
      latestAnnouncementId,
      activeUserIdRef,
    },
    settingsState,
    showCalendar,
    showRank,
    timerState,
    user,
    workoutState,
  });

  const applySavedTodayMarkers = useSavedWorkoutMarkers({
    savedSplitsRef,
    finishedDatesRef,
    finishedSignaturesRef,
    setSavedSplits,
    setDirtySplits,
  });

  useLayoutEffect(() => {
    openPasswordResetRef.current = openPasswordReset;
    clearAccountClientStateRef.current = clearAccountClientState;
    applySavedTodayMarkersRef.current = applySavedTodayMarkers;
  }, [applySavedTodayMarkers, clearAccountClientState, openPasswordReset]);

  const cloudSync = useTrackCloudSync({
    user,
    ready,
    cloudReady,
    lists,
    activeId,
    rememberExercisesAcrossSplits,
    defaultUnit,
    timerMode,
    timerRunning,
    timerRuntime,
    applyTimerRuntime,
    restSeconds,
    restCustom,
    completionEnabled,
    accountLocalReadyFor,
    setLists,
    setActiveId,
    setCloudReady,
    setSyncLabel,
    setDefaultUnit,
    setTimerMode,
    setRestSeconds,
    setRestCustom,
    setCustomRestInput,
    setRestRemaining,
    setRememberExercisesAcrossSplits,
    setCompletionEnabled,
    setRankEquipmentOverrides,
    setRankHistoryVersion,
    setUser,
    setSavedSplits,
    applySavedTodayMarkersRef,
    readWorkoutDates,
    applyWorkoutDates,
    markWorkoutDate,
    removeWorkoutDate,
    restoreWorkoutDate,
    workoutFinishInFlight,
  });
  useLayoutEffect(() => {
    broadcastSyncEventRef.current = cloudSync.broadcastSyncEvent;
    invalidateCloudReadsRef.current = cloudSync.invalidateCloudReads;
    resetCloudSyncStateRef.current = cloudSync.resetCloudSyncState;
    cloudSaveInFlightRef.current = cloudSync.isCloudSaveInFlight;
  }, [cloudSync]);

  const workoutActions = useTrackAppWorkoutActions({
    broadcastSyncEventRef,
    exportOptions: { lists, setExportBusy, setExportMessage },
    finishOptions: {
      active,
      user,
      accountLocalReadyFor,
      savedSplitsRef,
      finishedSignaturesRef,
      finishedDatesRef,
      workoutFinishInFlightRef: workoutFinishInFlight,
      setSavedSplits,
      setDirtySplits,
      setFinishedSignatures,
      setFinishedDates,
      setProgressFading,
      setSyncLabel,
      setFilter,
      setWorkoutActionsExiting,
      updateTasks,
      markWorkoutDate,
    },
    importOptions: {
      active,
      aiKey,
      aiExercises,
      defaultUnit,
      setAiError,
      setAiExercises,
      setAiBusy,
      setLists,
      setActiveId,
      setShowTimer,
      setShowCalendar,
      setShowRank,
      setSettingsOpen,
      updateTasks,
    },
    invalidateCloudReads: cloudSync.invalidateCloudReads,
  });
  const { exportActions, finishWorkout, importActions } = workoutActions;

  const releaseManager = useReleaseManager({
    nativeApp,
    siteUpdateSeconds,
    setSiteUpdateSeconds,
    updateReady,
    setUpdateReady,
    setAvailableUpdateVersion,
    setUpdateCheckBusy,
    setUpdateCheckMessage,
    isSaveInFlight: () => workoutFinishInFlight.current || cloudSaveInFlightRef.current(),
  });
  useLayoutEffect(() => {
    siteUpdateCheckRef.current = releaseManager.checkForSiteUpdate;
  }, [releaseManager.checkForSiteUpdate]);

  const appInteractions = useTrackAppInteractions({
    active,
    activeId,
    defaultUnit,
    exerciseNames,
    inputRef,
    searchQuery,
    setAnnouncement,
    setAnnouncementSendBusy,
    setAnnouncementSendMessage,
    setAnnouncementText,
    setEditing,
    setFilter,
    setLists,
    setMobileSidebarOpen,
    setNotificationMessage,
    setNotificationPermission,
    setNotificationPrompt,
    setNotificationRequestBusy,
    setNotificationSettingsAvailable,
    setPendingExerciseName,
    setSearchQuery,
    setSettingsClosing,
    setSettingsOpen,
    setSettingsView,
    setShowCalendar,
    setShowRank,
    setShowSuggestions,
    setShowTimer,
    setSidebarCollapsed,
    setThemeMode,
    setUpdatesViewBusy,
    setUpdatesViewMessage,
    siteUpdateCheckRef,
    settingsCloseTimer,
    updateTasks,
    isAdmin: adminAuthorized,
    settingsClosing,
    notificationRequestBusy,
    announcementText,
    announcementSendBusy,
  });
  const { navigateBottomTab } = appInteractions;
  const bottomTabs = useBottomTabNavigation({ activeTab: activeBottomTab, onNavigate: navigateBottomTab });

  if (authLoading) return <AppLoadingSkeleton />;
  if (!user) return <AuthScreen />;

  return (
    <TrackAppView
      active={active}
      controllers={{
        accountActions,
        bottomTabs,
        exportActions,
        finishWorkout,
        importActions,
        interactions: appInteractions,
        sidebarGestures,
        splitActions,
        splitReorder,
        timerActions,
        timerPersistence: { markTimerChanged },
        undo: undoState,
        workoutDate: workoutDateSync,
        workoutEditor,
      }}
      local={{
        aiBusy,
        aiError,
        aiExercises,
        aiKey,
        announcementDragStart,
        composerRef,
        exportBusy,
        exportMessage,
        inputRef,
        siteUpdateCheckRef,
        setAiExercises,
        setAiKey,
        settingsTabsRef,
      }}
      nativeApp={nativeApp}
      state={{
        identity: identityState,
        workout: workoutState,
        settings: settingsState,
        navigation: navigationState,
        rank: rankState,
        timer: timerState,
      }}
      tasks={tasks}
    />
  );
}
