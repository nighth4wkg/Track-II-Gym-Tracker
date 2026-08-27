"use client";

import { useLayoutEffect } from "react";
import type { BottomTabId } from "../components/BottomTabBar";
import type { IdentityState } from "./useIdentityState";
import type { WorkoutState } from "./useWorkoutState";
import type { SettingsState } from "./useSettingsState";
import type { RankCalendarState } from "./useRankCalendarState";
import type { TimerState } from "./useTimerState";
import type { NavigationState } from "./useNavigationState";
import type { Checklist } from "../trackTypes";
import { useBottomTabNavigation } from "./useBottomTabNavigation";
import { useWorkoutEditorController } from "./useWorkoutEditorController";
import { useReleaseManager } from "./useReleaseManager";
import { useTrackAppRuntimeLifecycle } from "./useTrackAppRuntimeLifecycle";
import { useTrackCloudSync } from "./useTrackCloudSync";
import { useTrackAccountActions } from "./useTrackAccountActions";
import { useUndoNotice } from "./useUndoNotice";
import { useWorkoutDateSync } from "./useWorkoutDateSync";
import { useSavedWorkoutMarkers } from "./useSavedWorkoutMarkers";
import { useTrackAppInteractions } from "./useTrackAppInteractions";
import { useTimerActions } from "./useTimerActions";
import { useTimerPersistence } from "./useTimerPersistence";
import { useSidebarGestures } from "./useSidebarGestures";
import { useSplitReorderGesture } from "./useSplitReorderGesture";
import { useSplitActions } from "./useSplitActions";
import { useTrackAppWorkoutActions } from "./useTrackAppWorkoutActions";
import { useTrackAppLocalState } from "./useTrackAppLocalState";
import { useWorkoutDraftRecovery } from "./useWorkoutDraftRecovery";

const EMPTY_TASKS: Checklist["tasks"] = [];

type TrackAppRuntimeOptions = {
  nativeApp: boolean;
  identityState: IdentityState;
  workoutState: WorkoutState;
  settingsState: SettingsState;
  navigationState: NavigationState;
  rankState: RankCalendarState;
  timerState: TimerState;
};

export function useTrackAppRuntime({
  nativeApp,
  identityState,
  workoutState,
  settingsState,
  navigationState,
  rankState,
  timerState,
}: TrackAppRuntimeOptions) {
  const {
    user,
    setUser,
    usernameInput,
    setUsernamePromptOpen,
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
    setLastSuccessfulSyncAt,
    siteUpdateSeconds,
    setSiteUpdateSeconds,
    updateReady,
    setUpdateReady,
    setDebugUpdateNotification,
    setUpdatesViewBusy,
    setUpdatesViewStatus,
    setUpdatesViewMessage,
    adminAuthorized,
    setAdminAuthorized,
    setUpdateCheckBusy,
    setUpdateCheckMessage,
    setAvailableUpdateVersion,
    announcement,
    setAnnouncement,
  } = identityState;
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
    dirtySplits,
    setDirtySplits,
    setFinishedSignatures,
    setFinishedDates,
    accountLocalReadyFor,
    setAccountLocalReadyFor,
  } = settingsState;
  const {
    showDashboard,
    setShowDashboard,
    showTimer,
    setShowTimer,
    showCalendar,
    setShowCalendar,
    showRank,
    setShowRank,
  } = navigationState;
  const {
    setRankHistoryTasks,
    rankCategoryOverrides,
    setRankCategoryOverrides,
    rankEquipmentOverrides,
    setRankEquipmentOverrides,
    setRankHistoryVersion,
    setWorkoutDates,
  } = rankState;
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

  const local = useTrackAppLocalState({ timerMode, timerRuntime });
  const {
    activeUserIdRef,
    aiBusy,
    aiError,
    aiExercises,
    aiKey,
    announcementDragStart,
    announcementTimer,
    applySavedTodayMarkersRef,
    broadcastSyncEventRef,
    calendarInitializedFor,
    clearAccountClientStateRef,
    cloudSaveInFlightRef,
    composerRef,
    exportBusy,
    exportMessage,
    finishedDatesRef,
    finishedSignaturesRef,
    inputRef,
    invalidateCloudReadsRef,
    latestAnnouncementId,
    mobileOrientationRef,
    openPasswordResetRef,
    ready,
    resetCloudSyncStateRef,
    restEndsAt,
    savedSplitsRef,
    setAiBusy,
    setAiError,
    setAiExercises,
    setAiKey,
    setExportBusy,
    setExportMessage,
    setReady,
    settingsCloseTimer,
    settingsTabsRef,
    siteUpdateCheckRef,
    timerStartedAt,
    timerSwipeStart,
    workoutFinishInFlight,
  } = local;
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
    setShowDashboard,
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
  const activeBottomTab: BottomTabId = showDashboard
    ? "dashboard"
    : showRank
      ? "rank"
      : showCalendar
        ? "calendar"
        : showTimer
          ? "timer"
          : "workout";
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
    setLastSuccessfulSyncAt,
    setPasswordResetBusy,
    setPasswordResetMessage,
    setPasswordResetValue,
    setPasswordResetConfirm,
    setPasswordResetOpen,
    setDeleteAccountBusy: settingsState.setDeleteAccountBusy,
    setDeleteAccountMessage: settingsState.setDeleteAccountMessage,
    setDeleteAccountConfirm: settingsState.setDeleteAccountConfirm,
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
    showDashboard,
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
  }, [
    applySavedTodayMarkers,
    applySavedTodayMarkersRef,
    clearAccountClientState,
    clearAccountClientStateRef,
    openPasswordReset,
    openPasswordResetRef,
  ]);

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
    setLastSuccessfulSyncAt,
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
  }, [broadcastSyncEventRef, cloudSaveInFlightRef, cloudSync, invalidateCloudReadsRef, resetCloudSyncStateRef]);

  const workoutDraftRecovery = useWorkoutDraftRecovery({
    userId: user?.id ?? null,
    accountReady: Boolean(user?.id && accountLocalReadyFor === user.id),
    cloudReady,
    active,
    lists,
    dirtySplits,
    savedSplitsRef,
    setLists,
    setActiveId,
    setDirtySplits,
    setSavedSplits,
    setWorkoutActionsExiting,
  });

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
      queueWorkoutSession: cloudSync.queueWorkoutSession,
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
      setShowDashboard,
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
  }, [releaseManager.checkForSiteUpdate, siteUpdateCheckRef]);
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
    setDebugUpdateNotification,
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
    setShowDashboard,
    setShowCalendar,
    setShowRank,
    setShowSuggestions,
    setShowTimer,
    setSidebarCollapsed,
    setThemeMode,
    setUpdatesViewBusy,
    setUpdatesViewStatus,
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

  return {
    active,
    authLoading: identityState.authLoading,
    controllers: {
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
      workoutDraftRecovery,
      workoutEditor,
      cloudSync,
    },
    local: {
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
    },
    tasks,
  };
}
