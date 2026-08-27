"use client";

import { useState } from "react";
import { DEFAULT_SETTINGS_VIEW } from "../trackConstants";
import type { SettingsView, ThemeMode, WeightUnit } from "../trackTypes";
import { safeStorageGet } from "../trackUtils";

export function useSettingsState() {
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsClosing, setSettingsClosing] = useState(false);
  const [settingsView, setSettingsView] = useState<SettingsView>(DEFAULT_SETTINGS_VIEW);
  const [completionEnabled, setCompletionEnabled] = useState(false);
  const [rememberExercisesAcrossSplits, setRememberExercisesAcrossSplits] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [signOutConfirm, setSignOutConfirm] = useState(false);
  const [deleteAccountConfirm, setDeleteAccountConfirm] = useState(false);
  const [deleteAccountBusy, setDeleteAccountBusy] = useState(false);
  const [deleteAccountMessage, setDeleteAccountMessage] = useState("");
  const [passwordResetOpen, setPasswordResetOpen] = useState(false);
  const [passwordResetValue, setPasswordResetValue] = useState("");
  const [passwordResetConfirm, setPasswordResetConfirm] = useState("");
  const [passwordResetMessage, setPasswordResetMessage] = useState("");
  const [passwordResetBusy, setPasswordResetBusy] = useState(false);
  const [notificationPrompt, setNotificationPrompt] = useState(false);
  const [notificationRequestBusy, setNotificationRequestBusy] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">(
    "default",
  );
  const [notificationSettingsAvailable, setNotificationSettingsAvailable] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [adminUsersOpen, setAdminUsersOpen] = useState(false);
  const [announcementComposerOpen, setAnnouncementComposerOpen] = useState(false);
  const [announcementText, setAnnouncementText] = useState("");
  const [announcementSendBusy, setAnnouncementSendBusy] = useState(false);
  const [announcementSendMessage, setAnnouncementSendMessage] = useState("");
  const [exerciseUnitsExpanded, setExerciseUnitsExpanded] = useState(false);
  const [settingsTabsAtEnd, setSettingsTabsAtEnd] = useState(true);
  const [pendingExerciseName, setPendingExerciseName] = useState("");
  const [defaultUnit, setDefaultUnit] = useState<WeightUnit>(() =>
    safeStorageGet("track-weight-unit") === "lb" ? "lb" : "kg",
  );
  const [savedSplits, setSavedSplits] = useState<Set<string>>(new Set());
  const [dirtySplits, setDirtySplits] = useState<Set<string>>(new Set());
  const [finishedSignatures, setFinishedSignatures] = useState<Record<string, string>>({});
  const [finishedDates, setFinishedDates] = useState<Record<string, string>>({});
  const [accountLocalReadyFor, setAccountLocalReadyFor] = useState<string | null>(null);

  return {
    themeMode,
    setThemeMode,
    settingsOpen,
    setSettingsOpen,
    settingsClosing,
    setSettingsClosing,
    settingsView,
    setSettingsView,
    completionEnabled,
    setCompletionEnabled,
    rememberExercisesAcrossSplits,
    setRememberExercisesAcrossSplits,
    showScrollTop,
    setShowScrollTop,
    showScrollBottom,
    setShowScrollBottom,
    signOutConfirm,
    setSignOutConfirm,
    deleteAccountConfirm,
    setDeleteAccountConfirm,
    deleteAccountBusy,
    setDeleteAccountBusy,
    deleteAccountMessage,
    setDeleteAccountMessage,
    passwordResetOpen,
    setPasswordResetOpen,
    passwordResetValue,
    setPasswordResetValue,
    passwordResetConfirm,
    setPasswordResetConfirm,
    passwordResetMessage,
    setPasswordResetMessage,
    passwordResetBusy,
    setPasswordResetBusy,
    notificationPrompt,
    setNotificationPrompt,
    notificationRequestBusy,
    setNotificationRequestBusy,
    notificationPermission,
    setNotificationPermission,
    notificationSettingsAvailable,
    setNotificationSettingsAvailable,
    notificationMessage,
    setNotificationMessage,
    adminUsersOpen,
    setAdminUsersOpen,
    announcementComposerOpen,
    setAnnouncementComposerOpen,
    announcementText,
    setAnnouncementText,
    announcementSendBusy,
    setAnnouncementSendBusy,
    announcementSendMessage,
    setAnnouncementSendMessage,
    exerciseUnitsExpanded,
    setExerciseUnitsExpanded,
    settingsTabsAtEnd,
    setSettingsTabsAtEnd,
    pendingExerciseName,
    setPendingExerciseName,
    defaultUnit,
    setDefaultUnit,
    savedSplits,
    setSavedSplits,
    dirtySplits,
    setDirtySplits,
    finishedSignatures,
    setFinishedSignatures,
    finishedDates,
    setFinishedDates,
    accountLocalReadyFor,
    setAccountLocalReadyFor,
  };
}

export type SettingsState = ReturnType<typeof useSettingsState>;
