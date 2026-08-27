"use client";

import { useMemo, type ComponentProps } from "react";
import { TrackAppShell } from "./TrackAppShell";
import type { BottomTabId } from "./BottomTabBar";
import type { EquipmentType, MuscleGroup } from "../rankTypes";
import { POPULAR_QUICK_PICK_EXERCISES } from "../trackConstants";
import { haptic } from "../haptics";
import type { TrackAppViewProps } from "../trackAppViewTypes";
import { bottomTabFromNavigation, buildExerciseSuggestions, filterWorkoutTasks } from "../trackViewSelectors";
import { createWorkoutEditorContextValue } from "./createWorkoutEditorContextValue";
import { createSettingsContextValue } from "./createSettingsContextValue";
import { createSettingsModalProps } from "./createSettingsModalProps";
import { buildAllSplitRankTasks, buildLatestExerciseProgressPlan } from "../exerciseProgress";
import { createTrackAppOverlayProps } from "./createTrackAppOverlayProps";
import { createTrackSplitMenuProps } from "./createTrackSplitMenuProps";
import { activePageFromNavigation } from "../navigationPage";

export function TrackAppView({ active: activeResult, controllers, local, nativeApp, state, tasks }: TrackAppViewProps) {
  const active = activeResult ?? null;
  const { identity, navigation, rank, settings, timer, workout } = state;
  const { siteUpdateSeconds, syncLabel } = identity;
  const { completionEnabled, dirtySplits, settingsOpen } = settings;
  const {
    calendarMonth,
    dashboardSummary,
    rankCategoryOverrides,
    rankEquipmentOverrides,
    rankHistoryTasks,
    workoutDates,
  } = rank;
  const { showCalendar, showDashboard, showRank, showTimer } = navigation;
  const {
    customRestInput,
    restCustom,
    restRemaining,
    restSeconds,
    timerElapsed,
    timerLaps,
    timerMode,
    timerRunning,
    timerTransition,
    timerTransitionKey,
  } = timer;
  const {
    activeId,
    draggingSplit,
    filter,
    homeTransition,
    lists,
    mobileSidebarOpen,
    progressFading,
    renamingId,
    searchQuery,
    showSuggestions,
    sidebarCollapsed,
    splitMenu,
    splitName,
    workoutActionsExiting,
  } = workout;
  const { user, updateReady, debugUpdateNotification, availableUpdateVersion, personalInfo, exerciseNames, isAdmin } = {
    user: identity.user,
    updateReady: identity.updateReady,
    debugUpdateNotification: identity.debugUpdateNotification,
    availableUpdateVersion: identity.availableUpdateVersion,
    personalInfo: identity.personalInfo,
    exerciseNames: identity.exerciseNames,
    isAdmin: identity.adminAuthorized,
  };
  const { composerRef, inputRef, settingsTabsRef } = local;
  const {
    accountActions,
    bottomTabs,
    cloudSync,
    exportActions,
    finishWorkout,
    importActions,
    interactions,
    sidebarGestures,
    splitActions,
    splitReorder,
    timerActions,
    timerPersistence,
    undo,
    workoutDate,
    workoutEditor,
  } = controllers;

  const { visible, openCount } = useMemo(() => filterWorkoutTasks(tasks, filter), [filter, tasks]);
  const searchQueryTerm = searchQuery.trim();
  const exerciseSuggestions = buildExerciseSuggestions(exerciseNames, searchQueryTerm);
  const searchQueryActive = searchQueryTerm.length > 0;
  const syncProgressPreview = useMemo(() => {
    const { exerciseCount, splitCount } = buildLatestExerciseProgressPlan(lists);
    return { exerciseCount, splitCount };
  }, [lists]);
  const allSplitRankTasks = useMemo(() => buildAllSplitRankTasks(lists), [lists]);
  const activeBottomTab = bottomTabFromNavigation({ showCalendar, showDashboard, showRank, showTimer });
  const activePage = activePageFromNavigation({
    active: Boolean(active),
    showDashboard,
    showRank,
    showCalendar,
    showTimer,
  });
  const accountUsername = String(user?.user_metadata?.username ?? "").trim() || "username";
  const accountRoleLabel = isAdmin ? "Admin" : "User";
  const accountRoleInitial = isAdmin ? "A" : "U";
  const accountPresenceLabel = identity.cloudReady ? "Online" : "Connecting…";
  const activeSplitId = active?.id ?? "";
  const workoutActionsAvailable =
    identity.cloudReady &&
    tasks.length > 0 &&
    (dirtySplits.has(activeSplitId) || progressFading || workoutActionsExiting);
  const nativeUpdateCountdownActive = nativeApp && siteUpdateSeconds !== null;
  const headerStatus = nativeUpdateCountdownActive ? `Update in ${siteUpdateSeconds}s` : syncLabel;
  const releaseAvailable = nativeApp && Boolean(availableUpdateVersion || updateReady);
  const updateVersion = availableUpdateVersion ?? updateReady?.remoteVersion ?? "";
  const debugUpdateVisible = nativeApp && isAdmin && debugUpdateNotification;

  const { updateRankCategoryOverride, updateRankEquipmentOverride } = accountActions;
  const { addExercise, addTask, closeSettings, hideSidebar, navigateBottomTab, openSettings, toggleSidebar } =
    interactions;
  const { broadcastWorkoutDateEvent, removeWorkoutDate, restoreWorkoutDate } = workoutDate;
  const {
    beginTimerSwipe,
    cancelTimerSwipe,
    chooseTimerMode,
    currentStopwatchElapsed,
    finishTimerSwipe,
    startRestTimer,
    toggleTimer,
  } = timerActions;
  const { beginDesktopSidebarSwipe, cancelDesktopSidebarSwipe, handleSwipeEnd, handleSwipeStart } = sidebarGestures;
  const { beginSplitHold, cancelSplitPointer, finishSplitHold, moveSplitHold, splitHoldTriggered } = splitReorder;
  const { duplicateSplit, goHome, newChecklist, removeSplit, saveSplitName, selectChecklist } = splitActions;
  const {
    beginHold: beginBottomTabHold,
    draggingTab: draggingBottomTab,
    highlightedTab: highlightedBottomTab,
    holdTriggered: bottomTabHoldTriggeredRef,
    indicatorIndex: bottomTabIndicatorIndex,
    trackRef: bottomTabTrackRef,
  } = bottomTabs;
  const { offerUndo } = undo;
  const { markTimerChanged } = timerPersistence;

  const workoutEditorContextValue = createWorkoutEditorContextValue({
    completionEnabled,
    tasks,
    workout,
    editor: workoutEditor,
  });

  const settingsContextValue = createSettingsContextValue({
    active,
    tasks,
    syncProgressPreview,
    isAdmin,
    nativeApp,
    releaseAvailable,
    updateVersion,
    identity,
    settings,
    local,
    accountActions,
    exportActions,
    importActions,
    interactions,
    workoutEditor,
  });

  const mainHandlers: Pick<
    ComponentProps<"main">,
    "onTouchStartCapture" | "onTouchEndCapture" | "onPointerDownCapture" | "onPointerCancelCapture" | "onClickCapture"
  > = {
    onTouchStartCapture: handleSwipeStart,
    onTouchEndCapture: handleSwipeEnd,
    onPointerDownCapture: beginDesktopSidebarSwipe,
    onPointerCancelCapture: cancelDesktopSidebarSwipe,
    onClickCapture: (event) => {
      if (event.target instanceof Element && event.target.closest(".theme-toggle, .segmented-control button"))
        haptic(10);
    },
  };

  const sidebarProps = {
    mobileOpen: mobileSidebarOpen,
    sidebarCollapsed,
    nativeApp,
    activeId,
    showDashboard,
    showTimer,
    showCalendar,
    showRank,
    completionEnabled,
    filter,
    tasks,
    openCount,
    recentLists: lists,
    renamingId,
    splitName,
    draggingSplit,
    splitHoldTriggered,
    isAdmin,
    accountRoleLabel,
    accountRoleInitial,
    accountUsername,
    accountPresenceLabel,
    headerStatus,
    lastSuccessfulSyncAt: identity.lastSuccessfulSyncAt,
    onRetrySync: cloudSync.retrySync,
    onUseCloudCopy: cloudSync.resolveSyncConflict,
    offlineQueueCount: cloudSync.offlineQueueCount,
    settingsOpen,
    onGoHome: goHome,
    onHideSidebar: hideSidebar,
    onToggleSidebar: toggleSidebar,
    onNewChecklist: newChecklist,
    onFilterChange: workout.setFilter,
    onSplitNameChange: workout.setSplitName,
    onSaveSplitName: saveSplitName,
    onCancelRename: () => workout.setRenamingId(null),
    onSelectChecklist: selectChecklist,
    onBeginSplitHold: beginSplitHold,
    onMoveSplitHold: moveSplitHold,
    onFinishSplitHold: finishSplitHold,
    onCancelSplitPointer: cancelSplitPointer,
    onOpenSplitMenu: (event: React.MouseEvent<HTMLButtonElement>, id: string) =>
      workout.setSplitMenu({ id, x: event.clientX, y: event.clientY }),
    onCloseMobileSidebar: () => workout.setMobileSidebarOpen(false),
    onOpenSettings: openSettings,
  };

  const workspaceProps = {
    homeTransition,
    cloudReady: identity.cloudReady,
    activePage,
    active,
    lists,
    tasks,
    rankTasks: allSplitRankTasks,
    visible,
    completionEnabled,
    filter,
    openCount,
    exerciseSuggestions,
    quickPickExercises: POPULAR_QUICK_PICK_EXERCISES,
    value: searchQuery,
    showSuggestions,
    searchQueryActive,
    progressFading,
    workoutActionsAvailable,
    workoutActionsExiting,
    composerRef,
    inputRef,
    rankHistoryTasks,
    dashboardSummary,
    personalInfo,
    rankCategoryOverrides,
    rankEquipmentOverrides,
    onRankCategoryOverride: (exerciseId: string, group: MuscleGroup | null) =>
      void updateRankCategoryOverride(exerciseId, group),
    onRankEquipmentOverride: (exerciseId: string, equipment: EquipmentType | null) =>
      void updateRankEquipmentOverride(exerciseId, equipment),
    calendarMonth,
    onCalendarMonthChange: rank.setCalendarMonth,
    workoutDates,
    userId: user?.id ?? "",
    onWorkoutDateRemoved: removeWorkoutDate,
    onWorkoutDateRestored: restoreWorkoutDate,
    onOfferUndo: offerUndo,
    onWorkoutDateEvent: broadcastWorkoutDateEvent,
    timerMode,
    timerRunning,
    timerElapsed,
    restRemaining,
    restSeconds,
    restCustom,
    customRestInput,
    timerLaps,
    timerTransition,
    timerTransitionKey,
    onBeginTimerSwipe: beginTimerSwipe,
    onFinishTimerSwipe: finishTimerSwipe,
    onCancelTimerSwipe: cancelTimerSwipe,
    onChooseTimerMode: (mode: "stopwatch" | "rest") => {
      haptic(8);
      chooseTimerMode(mode);
    },
    onToggleTimer: toggleTimer,
    onLapOrReset: () => {
      haptic(14);
      if (timerRunning) timer.setTimerLaps((laps) => [...laps, currentStopwatchElapsed()]);
      else {
        timer.setTimerElapsed(0);
        timer.setTimerLaps([]);
      }
      markTimerChanged();
    },
    onClearLaps: () => {
      timer.setTimerLaps([]);
      markTimerChanged();
    },
    onStartRest: startRestTimer,
    onCreateChecklist: newChecklist,
    onAddExercise: addExercise,
    onAddTask: addTask,
    onFilterChange: workout.setFilter,
    onOpenAiImport: () => openSettings("ai"),
    onFinishWorkout: finishWorkout,
    onSearchValueChange: workout.setSearchQuery,
    onShowSuggestionsChange: workout.setShowSuggestions,
    workoutEditorContextValue,
  };

  const bottomTabProps = {
    activeTab: activeBottomTab,
    highlightedTab: highlightedBottomTab,
    draggingTab: draggingBottomTab,
    trackRef: bottomTabTrackRef,
    indicatorIndex: bottomTabIndicatorIndex,
    timerRunning,
    sidebarCollapsed,
    mobileSidebarOpen,
    hidden: settingsOpen,
    onClick: (event: React.MouseEvent<HTMLButtonElement>, id: BottomTabId) => {
      if (bottomTabHoldTriggeredRef.current) {
        event.preventDefault();
        event.stopPropagation();
        bottomTabHoldTriggeredRef.current = false;
        return;
      }
      navigateBottomTab(id);
    },
    onPointerDown: beginBottomTabHold,
  };

  const splitMenuProps = createTrackSplitMenuProps({
    menu: splitMenu,
    lists,
    setSplitName: workout.setSplitName,
    setRenamingId: workout.setRenamingId,
    closeMenu: () => workout.setSplitMenu(null),
    onDuplicate: duplicateSplit,
    onRemove: removeSplit,
  });

  const settingsModalProps = createSettingsModalProps({ closeSettings, isAdmin, settings, settingsTabsRef });
  const overlayProps = createTrackAppOverlayProps({
    controllers,
    debugUpdateVisible,
    local,
    mobileSidebarOpen,
    nativeApp,
    sidebarCollapsed,
    state,
    updateVersion,
  });

  return (
    <TrackAppShell
      nativeApp={nativeApp}
      shellClassName={`app-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}${mobileSidebarOpen ? " mobile-sidebar-visible" : ""}`}
      settingsOpen={settingsOpen}
      mobileSidebarOpen={mobileSidebarOpen}
      isAdmin={isAdmin}
      activePage={activePage}
      settingsContextValue={settingsContextValue}
      mainHandlers={mainHandlers}
      onOpenAdminUsers={() => {
        haptic(8);
        settings.setAdminUsersOpen(true);
      }}
      onOpenMobileSidebar={() => {
        haptic(6);
        workout.setMobileSidebarOpen(true);
      }}
      accountPromptProps={overlayProps.accountPromptProps}
      announcementProps={overlayProps.announcementProps}
      updateNotificationProps={overlayProps.updateNotificationProps}
      adminUsersPanelProps={overlayProps.adminUsersPanelProps}
      sidebarProps={sidebarProps}
      workspaceProps={workspaceProps}
      bottomTabProps={bottomTabProps}
      scrollShortcutsProps={{
        showTop: settings.showScrollTop,
        showBottom: settings.showScrollBottom,
      }}
      splitMenuProps={splitMenuProps}
      actionModalProps={overlayProps.actionModalProps}
      settingsModalProps={settingsModalProps}
      undoToastProps={overlayProps.undoToastProps}
      workoutDraftRecoveryProps={overlayProps.workoutDraftRecoveryProps}
    />
  );
}
