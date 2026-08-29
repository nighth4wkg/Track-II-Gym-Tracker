import { AppLauncher } from "@capacitor/app-launcher";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { JsonValue } from "./trackTypes";
import { TRACK_ASSET_QUERY } from "./trackConfig";
import { isJsonObject, isStringValue, promiseWithTimeout } from "./trackUtils";
import { recordNotificationDelivery } from "./notificationTelemetry";

export function nativeLocalNotificationsAvailable() {
  return (
    Boolean(globalThis.window) && Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("LocalNotifications")
  );
}

const NATIVE_NOTIFICATION_SETTINGS_URLS = ["app-settings:", "app-settings://"] as const;

export async function openNativeNotificationSettings() {
  if (!globalThis.window || !Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("AppLauncher")) return false;
  for (const url of NATIVE_NOTIFICATION_SETTINGS_URLS) {
    try {
      const result = await promiseWithTimeout(AppLauncher.openUrl({ url }), 8000);
      if (result.completed) return true;
    } catch {
      // Some iOS builds accept only one of the equivalent Settings URL forms.
    }
  }
  return false;
}

export async function readNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!globalThis.window) return "unsupported";
  if (nativeLocalNotificationsAvailable()) {
    try {
      const permission = await promiseWithTimeout(LocalNotifications.checkPermissions(), 4000);
      if (permission.display === "granted") return "granted";
      if (permission.display === "denied") return "denied";
      return "default";
    } catch {
      return "unsupported";
    }
  }
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export function notificationIdFromKey(key: string) {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) hash = Math.imul(hash ^ key.charCodeAt(index), 16777619);
  return (hash >>> 0) % 2147483647 || 1;
}

export function notificationIdForNativeDelivery(notification: { id?: number; extra?: JsonValue | undefined }) {
  const extra = isJsonObject(notification.extra) ? notification.extra : null;
  for (const value of [extra?.notificationId, extra?.id]) {
    if (isStringValue(value) && value.trim()) return value;
  }
  const id = notification.id;
  return id !== undefined && Number.isFinite(id) ? `native:${id}` : null;
}

const notificationDeliveries = new Map<string, Promise<boolean>>();
const LEGACY_REST_COMPLETION_NOTIFICATION_ID = notificationIdFromKey("track-rest-complete");
let scheduledRestCompletionNotificationId: number | null = null;
let restNotificationGeneration = 0;

async function cancelNativeRestCompletionNotification() {
  const ids = new Set([LEGACY_REST_COMPLETION_NOTIFICATION_ID]);
  if (scheduledRestCompletionNotificationId !== null) ids.add(scheduledRestCompletionNotificationId);
  await promiseWithTimeout(LocalNotifications.cancel({ notifications: [...ids].map((id) => ({ id })) }), 4000);
}

export async function cancelRestCompletionNotification() {
  if (!nativeLocalNotificationsAvailable()) return false;
  restNotificationGeneration += 1;
  try {
    await cancelNativeRestCompletionNotification();
    scheduledRestCompletionNotificationId = null;
    return true;
  } catch {
    return false;
  }
}

export async function scheduleRestCompletionNotification(endAtMs: number) {
  if (!nativeLocalNotificationsAvailable() || !Number.isFinite(endAtMs) || endAtMs <= Date.now()) return false;
  const generation = ++restNotificationGeneration;
  const notificationKey = `rest:${Math.round(endAtMs)}`;
  const nativeNotificationId = notificationIdFromKey(notificationKey);
  try {
    const permission = await promiseWithTimeout(LocalNotifications.checkPermissions(), 4000);
    if (permission.display !== "granted") {
      recordNotificationDelivery({
        notificationId: notificationKey,
        status: "failed",
        surface: "native",
        reason: `permission-${permission.display}`,
      });
      return false;
    }
    // Only one rest alert may exist. This also replaces an alert left behind
    // when a user stops a rest timer and starts another one.
    if (generation !== restNotificationGeneration) return false;
    try {
      await cancelNativeRestCompletionNotification();
    } catch {
      // A missing or already-delivered notification should not block the new one.
    }
    if (generation !== restNotificationGeneration) return false;
    await promiseWithTimeout(
      LocalNotifications.schedule({
        notifications: [
          {
            id: nativeNotificationId,
            title: "Track II",
            body: "Rest complete. Time for your next set.",
            foreground: true,
            sound: "default",
            smallIcon: "ic_stat_track",
            iconColor: "#F7F7F4",
            interruptionLevel: "active",
            isExactNotification: false,
            schedule: { at: new Date(endAtMs), allowWhileIdle: true },
            extra: { kind: "rest-complete", notificationId: notificationKey },
          },
        ],
      }),
      8000,
    );
    scheduledRestCompletionNotificationId = nativeNotificationId;
    recordNotificationDelivery({ notificationId: notificationKey, status: "scheduled", surface: "native" });
    return true;
  } catch {
    recordNotificationDelivery({
      notificationId: notificationKey,
      status: "failed",
      surface: "native",
      reason: "schedule-error",
    });
    return false;
  }
}

async function deliverSystemNotification(message: string, id: string) {
  if (!globalThis.window) return false;
  const surface = nativeLocalNotificationsAvailable() ? "native" : "web";
  try {
    if (nativeLocalNotificationsAvailable()) {
      const permission = await LocalNotifications.checkPermissions();
      if (permission.display !== "granted") {
        recordNotificationDelivery({
          notificationId: id,
          status: "failed",
          surface,
          reason: `permission-${permission.display}`,
        });
        return false;
      }
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notificationIdFromKey(`track-${id}`),
            title: "Track II",
            body: message,
            foreground: true,
            sound: "default",
            smallIcon: "ic_stat_track",
            iconColor: "#F7F7F4",
            interruptionLevel: "active",
            extra: { id },
          },
        ],
      });
      recordNotificationDelivery({ notificationId: id, status: "displayed", surface });
      return true;
    }
    if (!("Notification" in window) || Notification.permission !== "granted") {
      recordNotificationDelivery({ notificationId: id, status: "failed", surface, reason: "permission-denied" });
      return false;
    }
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.showNotification("Track II", {
          body: message,
          icon: `/icon-192.png${TRACK_ASSET_QUERY}`,
          badge: `/notification-badge.png${TRACK_ASSET_QUERY}`,
          tag: `track-${id}`,
        });
        recordNotificationDelivery({ notificationId: id, status: "displayed", surface });
        return true;
      }
    }
    new Notification("Track II", { body: message, icon: `/icon-192.png${TRACK_ASSET_QUERY}`, tag: `track-${id}` });
    recordNotificationDelivery({ notificationId: id, status: "displayed", surface });
    return true;
  } catch {
    recordNotificationDelivery({ notificationId: id, status: "failed", surface, reason: "delivery-error" });
    /* keep the in-app announcement when system notifications are unavailable */ return false;
  }
}

export function showSystemNotification(message: string, id: string) {
  const existing = notificationDeliveries.get(id);
  if (existing) return existing;
  const delivery = deliverSystemNotification(message, id).then((delivered) => {
    if (!delivered) notificationDeliveries.delete(id);
    return delivered;
  });
  notificationDeliveries.set(id, delivery);
  return delivery;
}
