"use client";

import {
  useMemo,
  type ComponentProps,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from "react";
import { supabase } from "../supabase";
import { TrackAppShell } from "./TrackAppShell";
import type { BottomTabId } from "./BottomTabBar";
import type { useIdentityState } from "../hooks/useIdentityState";
import type { useWorkoutState } from "../hooks/useWorkoutState";
import type { useSettingsState } from "../hooks/useSettingsState";
import type { useNavigationState } from "../hooks/useNavigationState";
import type { useRankCalendarState } from "../hooks/useRankCalendarState";
import type { useTimerState } from "../hooks/useTimerState";
import type { useBottomTabNavigation } from "../hooks/useBottomTabNavigation";
import type { useWorkoutEditorController } from "../hooks/useWorkoutEditorController";
import type { useTrackAccountActions } from "../hooks/useTrackAccountActions";
import type { useUndoNotice } from "../hooks/useUndoNotice";
import type { useWorkoutDateSync } from "../hooks/useWorkoutDateSync";
import type { useTrackExportActions } from "../hooks/useTrackExportActions";
import type { useTrackAppInteractions } from "../hooks/useTrackAppInteractions";
import type { useTimerActions } from "../hooks/useTimerActions";
import type { useSidebarGestures } from "../hooks/useSidebarGestures";
import type { useSplitReorderGesture } from "../hooks/useSplitReorderGesture";
import type { useSplitActions } from "../hooks/useSplitActions";
import type { useWorkoutImportActions } from "../hooks/useWorkoutImportActions";
import type { AiExercise, Checklist } from "../trackTypes";
import type { EquipmentType, MuscleGroup } from "../rankTypes";
import { TRACK_INTERACTION, TRACK_TIMING } from "../trackConstants";
import { exerciseSearchScore } from "../exerciseSearch";
import { haptic } from "../haptics";
import { safeStorageSet, syncStatusTone } from "../trackUtils";
import { createWorkoutEditorContextValue } from "./createWorkoutEditorContextValue";
import { createSettingsContextValue } from "./createSettingsContextValue";

type AppState = {
  identity: ReturnType<typeof useIdentityState>;
  workout: ReturnType<typeof useWorkoutState>;
  settings: ReturnType<typeof useSettingsState>;
  navigation: ReturnType<typeof useNavigationState>;
  rank: ReturnType<typeof useRankCalendarState>;
  timer: ReturnType<typeof useTimerState>;
};

export type AppLocalState = {
  aiBusy: boolean;
  aiError: string;
  aiExercises: AiExercise[];
  aiKey: string;
  announcementDragStart: MutableRefObject<number | null>;
  composerRef: RefObject<HTMLFormElement | null>;
  exportBusy: "csv" | "json" | null;
  exportMessage: string;
  inputRef: RefObject<HTMLInputElement | null>;
  siteUpdateCheckRef: MutableRefObject<((manual?: boolean) => Promise<"update" | "current" | "error">) | null>;
  setAiExercises: Dispatch<SetStateAction<AiExercise[]>>;
  setAiKey: Dispatch<SetStateAction<string>>;
  settingsTabsRef: RefObject<HTMLDivElement | null>;
};

type AppControllers = {
  accountActions: ReturnType<typeof useTrackAccountActions>;
  bottomTabs: ReturnType<typeof useBottomTabNavigation>;
  exportActions: ReturnType<typeof useTrackExportActions>;
  finishWorkout: () => Promise<void>;
  importActions: ReturnType<typeof useWorkoutImportActions>;
  interactions: ReturnType<typeof useTrackAppInteractions>;
  sidebarGestures: ReturnType<typeof useSidebarGestures>;
  splitActions: ReturnType<typeof useSplitActions>;
  splitReorder: ReturnType<typeof useSplitReorderGesture>;
  timerActions: ReturnType<typeof useTimerActions>;
  timerPersistence: { markTimerChanged: () => void };
  undo: ReturnType<typeof useUndoNotice>;
  workoutDate: ReturnType<typeof useWorkoutDateSync>;
  workoutEditor: ReturnType<typeof useWorkoutEditorController>;
};

export type TrackAppViewProps = {
  active: Checklist | undefined;
  controllers: AppControllers;
  local: AppLocalState;
  nativeApp: boolean;
  state: AppState;
  tasks: Checklist["tasks"];
};

export function TrackAppView({ active: activeResult, controllers, local, nativeApp, state, tasks }: TrackAppViewProps) {
  const active = activeResult ?? null;
  const { identity, navigation, rank, settings, timer, workout } = state;
  const { announcement, announcementOffset, setAnnouncement, setAnnouncementOffset, siteUpdateSeconds, syncLabel } =
    identity;
  const {
    adminUsersOpen,
    completionEnabled,
    dirtySplits,
    exerciseUnitsExpanded,
    notificationPrompt,
    notificationRequestBusy,
    settingsClosing,
    settingsOpen,
    settingsTabsAtEnd,
    settingsView,
    signOutConfirm,
  } = settings;
  const { calendarMonth, rankCategoryOverrides, rankEquipmentOverrides, rankHistoryTasks, workoutDates } = rank;
  const { showCalendar, showRank, showTimer } = navigation;
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
  const { user, updateReady, availableUpdateVersion, personalInfo, exerciseNames, isAdmin } = {
    user: identity.user,
    updateReady: identity.updateReady,
    availableUpdateVersion: identity.availableUpdateVersion,
    personalInfo: identity.personalInfo,
    exerciseNames: identity.exerciseNames,
    isAdmin: identity.adminAuthorized,
  };
  const { announcementDragStart, composerRef, inputRef, settingsTabsRef } = local;
  const {
    accountActions,
    bottomTabs,
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

  const visible = useMemo(
    () => tasks.filter((task) => (filter === "open" ? !task.done : filter === "done" ? task.done : true)),
    [filter, tasks],
  );
  const openCount = tasks.filter((task) => !task.done).length;
  const exerciseSuggestions = searchQuery.trim()
    ? exerciseNames
        .map((name) => ({ name, score: exerciseSearchScore(name, searchQuery) }))
        .filter((result) => Number.isFinite(result.score))
        .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name))
        .slice(0, TRACK_INTERACTION.maxExerciseSuggestions)
        .map((result) => result.name)
    : [];
  const searchQueryActive = searchQuery.trim().length > 0;
  const activeBottomTab: BottomTabId = showRank ? "rank" : showCalendar ? "calendar" : showTimer ? "timer" : "workout";
  const accountUsername = String(user?.user_metadata?.username ?? "").trim() || "username";
  const accountRoleLabel = isAdmin ? "Admin" : "User";
  const accountRoleInitial = isAdmin ? "A" : "U";
  const accountPresenceLabel = identity.cloudReady ? "Online" : "Connecting…";
  const activeSplitId = active?.id ?? "";
  const workoutActionsAvailable =
    identity.cloudReady &&
    tasks.length > 0 &&
    (dirtySplits.has(activeSplitId) || progressFading || workoutActionsExiting);
  const headerStatus = siteUpdateSeconds === null ? syncLabel : `Update in ${siteUpdateSeconds}s`;
  const syncStatusClass = `sync-status ui-status sync-status-${syncStatusTone(headerStatus)}${siteUpdateSeconds === null ? "" : " site-update-status"}`;
  const releaseAvailable = Boolean(availableUpdateVersion || updateReady);
  const updateVersion = availableUpdateVersion ?? updateReady?.remoteVersion ?? "";

  const { savePersonalInfo, savePasswordReset, saveUsername, updateRankCategoryOverride, updateRankEquipmentOverride } =
    accountActions;
  const {
    addExercise,
    addTask,
    closeSettings,
    hideSidebar,
    navigateBottomTab,
    openSettings,
    requestNotifications,
    toggleSidebar,
  } = interactions;
  const { broadcastWorkoutDateEvent, removeWorkoutDate, restoreWorkoutDate } = workoutDate;
  const { beginTimerSwipe, cancelTimerSwipe, chooseTimerMode, finishTimerSwipe, startRestTimer, toggleTimer } =
    timerActions;
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
  const {
    undoDismissDirection,
    undoDragging,
    undoDragX,
    undoNotice,
    beginUndoSwipe,
    cancelUndoSwipe,
    finishUndoSwipe,
    moveUndoSwipe,
    performUndo,
    offerUndo,
  } = undo;
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
    isAdmin,
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

  const accountPromptProps = {
    usernamePromptOpen: identity.usernamePromptOpen,
    usernameInput: identity.usernameInput,
    usernameMessage: identity.usernameMessage,
    usernameSaving: identity.usernameSaving,
    onUsernameInputChange: identity.setUsernameInput,
    onSaveUsername: saveUsername,
    personalInfoPromptOpen: identity.personalInfoPromptOpen,
    personalHeightInput: identity.personalHeightInput,
    personalWeightInput: identity.personalWeightInput,
    personalInfoMessage: identity.personalInfoMessage,
    personalInfoSaving: identity.personalInfoSaving,
    onPersonalHeightChange: identity.setPersonalHeightInput,
    onPersonalWeightChange: identity.setPersonalWeightInput,
    onSavePersonalInfo: savePersonalInfo,
    passwordResetOpen: settings.passwordResetOpen,
    passwordResetBusy: settings.passwordResetBusy,
    passwordResetValue: settings.passwordResetValue,
    passwordResetConfirm: settings.passwordResetConfirm,
    passwordResetMessage: settings.passwordResetMessage,
    onPasswordResetValueChange: settings.setPasswordResetValue,
    onPasswordResetConfirmChange: settings.setPasswordResetConfirm,
    onClosePasswordReset: () => settings.setPasswordResetOpen(false),
    onSavePasswordReset: savePasswordReset,
  };

  const sidebarProps = {
    mobileOpen: mobileSidebarOpen,
    sidebarCollapsed,
    nativeApp,
    activeId,
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
    syncStatusClass,
    headerStatus,
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
    showRank,
    showCalendar,
    showTimer,
    active,
    tasks,
    rankTasks: tasks,
    visible,
    completionEnabled,
    filter,
    openCount,
    exerciseSuggestions,
    value: searchQuery,
    showSuggestions,
    searchQueryActive,
    progressFading,
    workoutActionsAvailable,
    workoutActionsExiting,
    composerRef,
    inputRef,
    rankHistoryTasks,
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
      if (timerRunning) timer.setTimerLaps((laps) => [...laps, timerElapsed]);
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

  const splitMenuProps = splitMenu
    ? {
        menu: splitMenu,
        onEdit: (id: string) => {
          const list = lists.find((item) => item.id === id);
          if (list) {
            workout.setSplitName(list.title);
            workout.setRenamingId(list.id);
          }
          workout.setSplitMenu(null);
        },
        onDuplicate: duplicateSplit,
        onRemove: removeSplit,
      }
    : undefined;

  const actionModalProps = {
    pendingExerciseName: settings.pendingExerciseName,
    onCancelPendingExercise: () => settings.setPendingExerciseName(""),
    onConfirmPendingExercise: (name: string) => {
      settings.setPendingExerciseName("");
      addExercise(name);
    },
    signOutConfirm,
    onCloseSignOut: () => settings.setSignOutConfirm(false),
    onSignOut: () => {
      haptic(18);
      settings.setSignOutConfirm(false);
      void supabase.auth.signOut({ scope: "local" });
    },
    notificationPrompt,
    notificationRequestBusy,
    onDismissNotification: () => {
      safeStorageSet("track-notification-prompt", "dismissed");
      settings.setNotificationPrompt(false);
    },
    onRequestNotifications: requestNotifications,
  };

  const settingsModalProps = {
    exerciseUnitsExpanded,
    isAdmin,
    settingsClosing,
    settingsTabsAtEnd,
    settingsTabsRef,
    settingsView,
    onClose: closeSettings,
    onScrollSettingsTabs: () => {
      const element = settingsTabsRef.current;
      if (!element) return;
      settings.setSettingsTabsAtEnd(element.scrollLeft + element.clientWidth >= element.scrollWidth - 2);
    },
    onSettingsViewChange: settings.setSettingsView,
    onShowMoreSettings: () => {
      const element = settingsTabsRef.current;
      if (!element) return;
      const maxScroll = Math.max(0, element.scrollWidth - element.clientWidth);
      element.scrollTo({
        left: Math.min(maxScroll, element.scrollLeft + TRACK_TIMING.settingsTabsScrollStepPx),
        behavior: "smooth",
      });
      window.setTimeout(() => {
        settings.setSettingsTabsAtEnd(element.scrollLeft + element.clientWidth >= element.scrollWidth - 2);
      }, TRACK_TIMING.settingsTabsScrollMs);
    },
    onToggleExerciseUnits: () => settings.setExerciseUnitsExpanded((expanded) => !expanded),
  };

  return (
    <TrackAppShell
      nativeApp={nativeApp}
      shellClassName={`app-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}${mobileSidebarOpen ? " mobile-sidebar-visible" : ""}`}
      settingsOpen={settingsOpen}
      mobileSidebarOpen={mobileSidebarOpen}
      isAdmin={isAdmin}
      active={Boolean(active)}
      showTimer={showTimer}
      showCalendar={showCalendar}
      showRank={showRank}
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
      accountPromptProps={accountPromptProps}
      announcementProps={
        announcement
          ? {
              announcement,
              offset: announcementOffset,
              dragStart: announcementDragStart,
              onOffsetChange: setAnnouncementOffset,
              onDismiss: () => setAnnouncement(null),
            }
          : undefined
      }
      updateNotificationProps={
        updateReady
          ? {
              nativeApp,
              updateVersion,
              onDismiss: () => identity.setUpdateReady(null),
            }
          : undefined
      }
      adminUsersPanelProps={
        isAdmin
          ? {
              open: adminUsersOpen,
              onClose: () => settings.setAdminUsersOpen(false),
              currentUserId: user?.id,
            }
          : undefined
      }
      sidebarProps={sidebarProps}
      workspaceProps={workspaceProps}
      bottomTabProps={bottomTabProps}
      scrollShortcutsProps={{
        showTop: settings.showScrollTop,
        showBottom: settings.showScrollBottom,
      }}
      splitMenuProps={splitMenuProps}
      actionModalProps={actionModalProps}
      settingsModalProps={settingsModalProps}
      undoToastProps={
        undoNotice
          ? {
              notice: undoNotice,
              sidebarCollapsed,
              mobileSidebarOpen,
              dragX: undoDragX,
              dragging: undoDragging,
              dismissDirection: undoDismissDirection,
              onPointerDown: beginUndoSwipe,
              onPointerMove: moveUndoSwipe,
              onPointerUp: finishUndoSwipe,
              onPointerCancel: cancelUndoSwipe,
              onUndo: performUndo,
            }
          : undefined
      }
    />
  );
}
