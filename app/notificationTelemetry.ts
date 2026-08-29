import type { JsonValue } from "./trackTypes";
import { isJsonObject, isStringValue, safeStorageGet, safeStorageSet } from "./trackUtils";

const NOTIFICATION_TELEMETRY_KEY = "track:notification-delivery";
const MAX_NOTIFICATION_TELEMETRY_EVENTS = 120;
const DEDUPE_WINDOW_MS = 5_000;

export type NotificationDeliveryStatus = "scheduled" | "displayed" | "dismissed" | "opened" | "failed";
export type NotificationDeliverySurface = "web" | "native" | "in-app";

export type NotificationDeliveryEvent = {
  notificationId: string;
  status: NotificationDeliveryStatus;
  surface: NotificationDeliverySurface;
  at: number;
  reason?: string;
};

const DELIVERY_STATUSES: ReadonlySet<string> = new Set(["scheduled", "displayed", "dismissed", "opened", "failed"]);
const DELIVERY_SURFACES: ReadonlySet<string> = new Set(["web", "native", "in-app"]);

function isFiniteNumber(value: JsonValue | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isDeliveryEvent(value: JsonValue | undefined): value is NotificationDeliveryEvent {
  return (
    isJsonObject(value) &&
    isStringValue(value.notificationId) &&
    value.notificationId.length > 0 &&
    value.notificationId.length <= 160 &&
    isStringValue(value.status) &&
    DELIVERY_STATUSES.has(value.status) &&
    isStringValue(value.surface) &&
    DELIVERY_SURFACES.has(value.surface) &&
    isFiniteNumber(value.at)
  );
}

export function readNotificationTelemetry() {
  const stored = safeStorageGet(NOTIFICATION_TELEMETRY_KEY);
  if (!stored) return [];
  try {
    const parsed: JsonValue = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(isDeliveryEvent).slice(-MAX_NOTIFICATION_TELEMETRY_EVENTS) : [];
  } catch {
    return [];
  }
}

export function recordNotificationDelivery(event: Omit<NotificationDeliveryEvent, "at"> & { at?: number }) {
  const at = event.at ?? Date.now();
  const current = readNotificationTelemetry();
  const duplicate = current.some(
    (item) =>
      item.notificationId === event.notificationId &&
      item.status === event.status &&
      item.surface === event.surface &&
      at - item.at < DEDUPE_WINDOW_MS,
  );
  if (duplicate) return;
  const next = [...current, { ...event, at }].slice(-MAX_NOTIFICATION_TELEMETRY_EVENTS);
  safeStorageSet(NOTIFICATION_TELEMETRY_KEY, JSON.stringify(next));
  if (globalThis.window) window.dispatchEvent(new CustomEvent("track-notification-delivery", { detail: next.at(-1) }));
}
