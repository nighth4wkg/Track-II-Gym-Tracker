import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { Dispatch, FormEvent, MutableRefObject, RefObject, SetStateAction } from "react";
import { supabase } from "../supabase";
import { haptic } from "../haptics";
import { compactSearchText } from "../exerciseSearch";
import { TRACK_LIMITS, TRACK_TIMING } from "../trackConstants";
import type { Checklist, Filter, SettingsView, ThemeMode, TrackAnnouncement, WeightUnit } from "../trackTypes";
import {
  nativeLocalNotificationsAvailable,
  promiseWithTimeout,
  safeStorageSet,
  showSystemNotification,
} from "../trackUtils";

type StateSetter<Value> = Dispatch<SetStateAction<Value>>;
type TaskList = Checklist["tasks"];
type SiteUpdateResult = "update" | "current" | "error";

export type TrackAppInteractionsOptions = {
  active: Checklist | undefined;
  activeId: string;
  defaultUnit: WeightUnit;
  exerciseNames: string[];
  inputRef: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  setAnnouncement: StateSetter<TrackAnnouncement | null>;
  setAnnouncementSendBusy: StateSetter<boolean>;
  setAnnouncementSendMessage: StateSetter<string>;
  setAnnouncementText: StateSetter<string>;
  setEditing: StateSetter<string | null>;
  setFilter: StateSetter<Filter>;
  setLists: StateSetter<Checklist[]>;
  setMobileSidebarOpen: StateSetter<boolean>;
  setNotificationMessage: StateSetter<string>;
  setNotificationPermission: StateSetter<NotificationPermission | "unsupported">;
  setNotificationPrompt: StateSetter<boolean>;
  setNotificationRequestBusy: StateSetter<boolean>;
  setPendingExerciseName: StateSetter<string>;
  setSearchQuery: StateSetter<string>;
  setSettingsClosing: StateSetter<boolean>;
  setSettingsOpen: StateSetter<boolean>;
  setSettingsView: StateSetter<SettingsView>;
  setShowCalendar: StateSetter<boolean>;
  setShowRank: StateSetter<boolean>;
  setShowSuggestions: StateSetter<boolean>;
  setShowTimer: StateSetter<boolean>;
  setSidebarCollapsed: StateSetter<boolean>;
  setThemeMode: StateSetter<ThemeMode>;
  setUpdatesViewBusy: StateSetter<boolean>;
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
  setEditing,
  setFilter,
  setLists,
  setMobileSidebarOpen,
  setNotificationMessage,
  setNotificationPermission,
  setNotificationPrompt,
  setNotificationRequestBusy,
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
  isAdmin,
  settingsClosing,
  notificationRequestBusy,
  announcementText,
  announcementSendBusy,
}: TrackAppInteractionsOptions) {
  function navigateBottomTab(id: "workout" | "timer" | "calendar" | "rank") {
    haptic(8);
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
      if (nativeApp) {
        setNotificationPrompt(false);
        if (!nativeLocalNotificationsAvailable()) {
          setNotificationPermission("unsupported");
          setNotificationMessage("Notifications aren’t available in this Track II build.");
          return;
        }
        let permission = await promiseWithTimeout(LocalNotifications.checkPermissions(), 4000);
        if (permission.display !== "granted" && permission.display !== "denied")
          permission = await promiseWithTimeout(LocalNotifications.requestPermissions(), 8000);
        const normalizedPermission: NotificationPermission =
          permission.display === "granted" ? "granted" : permission.display === "denied" ? "denied" : "default";
        setNotificationPermission(normalizedPermission);
        safeStorageSet(
          "track-notification-prompt",
          normalizedPermission === "default" ? "dismissed" : normalizedPermission,
        );
        if (normalizedPermission === "granted") {
          setNotificationMessage("Notifications are enabled on this device.");
          void showSystemNotification("Announcements are now enabled on this device.", "permission-enabled");
        } else if (normalizedPermission === "denied")
          setNotificationMessage("Notifications are blocked. You can enable them in your device settings.");
        return;
      }
      if (!("Notification" in window)) {
        setNotificationPermission("unsupported");
        setNotificationMessage("Notifications aren’t available in this browser.");
        setNotificationPrompt(false);
        return;
      }
      const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        ("standalone" in navigator && navigator.standalone === true);
      if (isiOS && !standalone) {
        setNotificationMessage(
          "On iPhone, add Track II to your Home Screen first, then open it there and enable notifications.",
        );
        setNotificationPrompt(false);
        return;
      }
      setNotificationPrompt(false);
      const permission = await promiseWithTimeout(Notification.requestPermission(), 10000);
      setNotificationPermission(permission);
      setNotificationPrompt(false);
      safeStorageSet("track-notification-prompt", permission === "default" ? "dismissed" : permission);
      if (permission === "granted") {
        setNotificationMessage("Notifications are enabled on this device.");
        void showSystemNotification("Announcements are now enabled on this device.", "permission-enabled");
      } else if (permission === "denied")
        setNotificationMessage("Notifications are blocked. You can enable them in your browser or device settings.");
    } catch {
      setNotificationPermission("default");
      setNotificationPrompt(false);
      setNotificationMessage(
        Capacitor.isNativePlatform()
          ? "Track II couldn’t open notification permissions. Check your device settings for Track II."
          : "Track II couldn’t open notification permissions. Try again from Privacy & Notifications.",
      );
    } finally {
      setNotificationRequestBusy(false);
    }
  }

  async function checkForUpdatesFromSettings() {
    haptic(10);
    setUpdatesViewBusy(true);
    setUpdatesViewMessage("");
    try {
      const result = await siteUpdateCheckRef.current?.(true);
      if (result === "update") {
        setUpdatesViewMessage("Update ready.");
        return;
      }
      if (result === "current") {
        setUpdatesViewMessage("No updates yet.");
        return;
      }
      setUpdatesViewMessage("Couldn’t check for updates. Try again in a moment.");
    } finally {
      setUpdatesViewBusy(false);
    }
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

  function openSettings() {
    if (settingsCloseTimer.current !== null) window.clearTimeout(settingsCloseTimer.current);
    settingsCloseTimer.current = null;
    setSettingsClosing(false);
    setSettingsView("appearance");
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
    toggleSidebar,
  };
}
