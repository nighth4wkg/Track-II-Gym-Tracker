import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { Dispatch, FormEvent, MutableRefObject, RefObject, SetStateAction } from "react";
import { supabase } from "../supabase";
import { haptic } from "../haptics";
import { compactSearchText } from "../exerciseSearch";
import { TRACK_LIMITS, TRACK_TIMING, TRACK_UI_COPY } from "../trackConstants";
import type {
  Checklist,
  Filter,
  SettingsView,
  ThemeMode,
  TrackAnnouncement,
  UpdatesViewStatus,
  WeightUnit,
} from "../trackTypes";
import {
  nativeLocalNotificationsAvailable,
  openNativeNotificationSettings,
  showSystemNotification,
} from "../notifications";
import { promiseWithTimeout, safeStorageSet } from "../trackUtils";

type StateSetter<Value> = Dispatch<SetStateAction<Value>>;
type TaskList = Checklist["tasks"];
type SiteUpdateResult = "update" | "current" | "error";

export type TrackAppInteractionsOptions = {
  active: Checklist | undefined;
  activeId: string;
  defaultUnit: WeightUnit;
  exerciseNames: readonly string[];
  inputRef: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  setAnnouncement: StateSetter<TrackAnnouncement | null>;
  setAnnouncementSendBusy: StateSetter<boolean>;
  setAnnouncementSendMessage: StateSetter<string>;
  setAnnouncementText: StateSetter<string>;
  setDebugUpdateNotification: StateSetter<boolean>;
  setEditing: StateSetter<string | null>;
  setFilter: StateSetter<Filter>;
  setLists: StateSetter<Checklist[]>;
  setMobileSidebarOpen: StateSetter<boolean>;
  setNotificationMessage: StateSetter<string>;
  setNotificationPermission: StateSetter<NotificationPermission | "unsupported">;
  setNotificationPrompt: StateSetter<boolean>;
  setNotificationRequestBusy: StateSetter<boolean>;
  setNotificationSettingsAvailable: StateSetter<boolean>;
  setPendingExerciseName: StateSetter<string>;
  setSearchQuery: StateSetter<string>;
  setSettingsClosing: StateSetter<boolean>;
  setSettingsOpen: StateSetter<boolean>;
  setSettingsView: StateSetter<SettingsView>;
  setShowDashboard: StateSetter<boolean>;
  setShowCalendar: StateSetter<boolean>;
  setShowRank: StateSetter<boolean>;
  setShowSuggestions: StateSetter<boolean>;
  setShowTimer: StateSetter<boolean>;
  setSidebarCollapsed: StateSetter<boolean>;
  setThemeMode: StateSetter<ThemeMode>;
  setUpdatesViewBusy: StateSetter<boolean>;
  setUpdatesViewStatus: StateSetter<UpdatesViewStatus>;
  setUpdatesViewMessage: StateSetter<string>;
  siteUpdateCheckRef: MutableRefObject<((manual?: boolean) => Promise<SiteUpdateResult>) | null>;
  settingsCloseTimer: MutableRefObject<number | null>;
  updateTasks: (updater: (current: TaskList) => TaskList, markDirty?: boolean) => void;
  isAdmin: boolean;
  settingsClosing: boolean;
  notificationRequestBusy: boolean;
  announcementText: string;
  announcementSendBusy: boolean;
};

export function useTrackAppInteractions({
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
  isAdmin,
  settingsClosing,
  notificationRequestBusy,
  announcementText,
  announcementSendBusy,
}: TrackAppInteractionsOptions) {
  const notificationCopy = TRACK_UI_COPY.notifications;

  function navigateBottomTab(id: "dashboard" | "workout" | "timer" | "calendar" | "rank") {
    haptic(8);
    setShowDashboard(id === "dashboard");
    setShowTimer(id === "timer");
    setShowCalendar(id === "calendar");
    setShowRank(id === "rank");
    if (id === "workout") {
      setFilter("all");
      setEditing(null);
    }
    setMobileSidebarOpen(false);
  }

  function addExercise(exerciseName: string) {
    const text = exerciseName.trim();
    if (!text) return;
    const exerciseId = crypto.randomUUID();
    updateTasks((current) => [
      ...current,
      {
        id: exerciseId,
        text,
        reps: "1",
        rir: "0",
        done: false,
        collapsed: false,
        sets: [{ id: crypto.randomUUID(), weight: "0", unit: defaultUnit, reps: "1", rir: "0" }],
      },
    ]);
    if (active?.title === "Untitled split")
      setLists((current) =>
        current.map((list) =>
          list.id === activeId
            ? { ...list, title: text.slice(0, TRACK_LIMITS.maxSplitNameChars), updatedAt: Date.now() }
            : list,
        ),
      );
    setSearchQuery("");
    inputRef.current?.focus();
  }

  function addTask(event: FormEvent) {
    event.preventDefault();
    const text = searchQuery.trim();
    if (!text) return;
    const libraryMatch = exerciseNames.find((name) => compactSearchText(name) === compactSearchText(text));
    if (libraryMatch) addExercise(libraryMatch);
    else {
      setShowSuggestions(false);
      setPendingExerciseName(text);
    }
  }

  function applyTheme(mode: ThemeMode) {
    setThemeMode(mode);
    document.documentElement.dataset.theme = mode;
    safeStorageSet("quiet-checklist-theme", mode);
  }

  async function requestNotifications() {
    if (notificationRequestBusy) return;
    haptic(12);
    setNotificationRequestBusy(true);
    setNotificationMessage("");
    try {
      const nativeApp = Capacitor.isNativePlatform();
      const appSettingsAvailable = nativeApp && Capacitor.isPluginAvailable("AppLauncher");
      setNotificationSettingsAvailable(appSettingsAvailable);
      if (nativeApp) {
        setNotificationPrompt(false);
        if (!nativeLocalNotificationsAvailable()) {
          setNotificationPermission("unsupported");
          setNotificationMessage(notificationCopy.nativeUnsupported);
          return;
        }
        let permission = await promiseWithTimeout(LocalNotifications.checkPermissions(), 4000);
        if (permission.display === "denied") {
          setNotificationPermission("denied");
          safeStorageSet("track-notification-prompt", "denied");
          if (appSettingsAvailable) {
            const settingsOpened = await openNativeNotificationSettings();
            setNotificationMessage(
              settingsOpened ? notificationCopy.blockedSettings : notificationCopy.blockedIPhoneSettings,
            );
          } else {
            setNotificationMessage(notificationCopy.blockedNative);
          }
          return;
        }
        if (permission.display !== "granted")
          permission = await promiseWithTimeout(LocalNotifications.requestPermissions(), 8000);
        const normalizedPermission: NotificationPermission =
          permission.display === "granted" ? "granted" : permission.display === "denied" ? "denied" : "default";
        setNotificationPermission(normalizedPermission);
        safeStorageSet(
          "track-notification-prompt",
          normalizedPermission === "default" ? "dismissed" : normalizedPermission,
        );
        if (normalizedPermission === "granted") {
          setNotificationMessage(notificationCopy.enabled);
          void showSystemNotification(notificationCopy.permissionEnabledAnnouncement, "permission-enabled");
        } else if (normalizedPermission === "denied") {
          if (appSettingsAvailable) {
            const settingsOpened = await openNativeNotificationSettings();
            setNotificationMessage(
              settingsOpened ? notificationCopy.blockedSettings : notificationCopy.blockedIPhoneSettings,
            );
          } else {
            setNotificationMessage(notificationCopy.blockedNative);
          }
        }
        return;
      }
      if (!("Notification" in window)) {
        setNotificationPermission("unsupported");
        setNotificationMessage(notificationCopy.browserUnsupported);
        setNotificationPrompt(false);
        return;
      }
      const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        ("standalone" in navigator && navigator.standalone === true);
      if (isiOS && !standalone) {
        setNotificationMessage(notificationCopy.iosHomeScreen);
        setNotificationPrompt(false);
        return;
      }
      setNotificationPrompt(false);
      const permission = await promiseWithTimeout(Notification.requestPermission(), 10000);
      setNotificationPermission(permission);
      setNotificationPrompt(false);
      safeStorageSet("track-notification-prompt", permission === "default" ? "dismissed" : permission);
      if (permission === "granted") {
        setNotificationMessage(notificationCopy.enabled);
        void showSystemNotification(notificationCopy.permissionEnabledAnnouncement, "permission-enabled");
      } else if (permission === "denied") setNotificationMessage(notificationCopy.blockedBrowser);
    } catch {
      setNotificationPermission("default");
      setNotificationPrompt(false);
      setNotificationMessage(
        Capacitor.isNativePlatform() ? notificationCopy.nativeError : notificationCopy.browserError,
      );
    } finally {
      setNotificationRequestBusy(false);
    }
  }

  async function checkForUpdatesFromSettings() {
    haptic(10);
    setUpdatesViewBusy(true);
    setUpdatesViewStatus("checking");
    setUpdatesViewMessage("");
    try {
      const result = await siteUpdateCheckRef.current?.(true);
      if (result === "update") {
        setUpdatesViewStatus("available");
        setUpdatesViewMessage("Update ready.");
        return;
      }
      if (result === "current") {
        setUpdatesViewStatus("current");
        setUpdatesViewMessage("No updates yet.");
        return;
      }
      setUpdatesViewStatus("error");
      setUpdatesViewMessage("Couldn’t check for updates. Try again in a moment.");
    } catch {
      setUpdatesViewStatus("error");
      setUpdatesViewMessage("Couldn’t check for updates. Try again in a moment.");
    } finally {
      setUpdatesViewBusy(false);
    }
  }

  function showFakeUpdateNotification() {
    if (!isAdmin) return;
    haptic(12);
    setDebugUpdateNotification(true);
  }

  function toggleSidebar() {
    haptic(10);
    setSidebarCollapsed((current) => {
      const next = !current;
      safeStorageSet("ironlog-sidebar", next ? "collapsed" : "open");
      return next;
    });
  }

  function hideSidebar() {
    if (window.matchMedia("(max-width: 1200px)").matches) {
      haptic(10);
      setMobileSidebarOpen(false);
      return;
    }
    toggleSidebar();
  }

  function openSettings(view: SettingsView = "appearance") {
    if (settingsCloseTimer.current !== null) window.clearTimeout(settingsCloseTimer.current);
    settingsCloseTimer.current = null;
    setSettingsClosing(false);
    setSettingsView(view);
    setSettingsOpen(true);
  }

  function closeSettings() {
    if (settingsClosing || settingsCloseTimer.current !== null) return;
    setSettingsClosing(true);
    settingsCloseTimer.current = window.setTimeout(() => {
      setSettingsOpen(false);
      setSettingsClosing(false);
      settingsCloseTimer.current = null;
    }, TRACK_TIMING.settingsCloseAnimationMs);
  }

  async function sendAnnouncement() {
    if (!isAdmin || announcementSendBusy) return;
    const message = announcementText.trim().slice(0, TRACK_LIMITS.maxAnnouncementChars);
    if (!message) return;
    setAnnouncementSendBusy(true);
    setAnnouncementSendMessage("");
    const { data, error } = await supabase.functions.invoke("admin-announcement", { body: { message } });
    if (error || data?.error) {
      setAnnouncementSendMessage(error?.message || String(data?.error || "Could not send the announcement."));
      setAnnouncementSendBusy(false);
      return;
    }
    const id = String(data?.id ?? crypto.randomUUID());
    setAnnouncement({ id, message });
    void showSystemNotification(message, id);
    setAnnouncementText("");
    setAnnouncementSendMessage("Announcement sent.");
    setAnnouncementSendBusy(false);
  }

  return {
    addExercise,
    addTask,
    applyTheme,
    checkForUpdatesFromSettings,
    closeSettings,
    hideSidebar,
    navigateBottomTab,
    openSettings,
    requestNotifications,
    sendAnnouncement,
    showFakeUpdateNotification,
    toggleSidebar,
  };
}
