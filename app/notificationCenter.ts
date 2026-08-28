import { TRACK_LIMITS } from "./trackConstants";
import { accountStorageKey, safeStorageGet, safeStorageSet } from "./trackUtils";
import { isJsonObject } from "./trackUtils";
import type { JsonValue } from "./trackTypes";

export type TrackNotificationKind = "rest" | "sync" | "draft" | "announcement";

export type TrackCenterNotification = {
  id: string;
  kind: TrackNotificationKind;
  title: string;
  message: string;
  createdAt: number;
  unread: boolean;
};

export type TrackNotificationEventDetail = TrackCenterNotification & { userId?: string };

export const TRACK_NOTIFICATION_EVENT = "track-notification-created";

const NOTIFICATION_KINDS: readonly string[] = ["rest", "sync", "draft", "announcement"];

function isNotificationKind(value: JsonValue | undefined): value is TrackNotificationKind {
  return typeof value === "string" && NOTIFICATION_KINDS.includes(value);
}

function isStoredNotification(value: JsonValue): value is TrackCenterNotification {
  if (!isJsonObject(value)) return false;
  const candidate = value;
  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    candidate.id.length <= 160 &&
    isNotificationKind(candidate.kind) &&
    typeof candidate.title === "string" &&
    candidate.title.length > 0 &&
    candidate.title.length <= 100 &&
    typeof candidate.message === "string" &&
    candidate.message.length > 0 &&
    candidate.message.length <= TRACK_LIMITS.maxAnnouncementChars &&
    typeof candidate.createdAt === "number" &&
    Number.isFinite(candidate.createdAt) &&
    typeof candidate.unread === "boolean"
  );
}

function boundedNotifications(items: JsonValue[]) {
  return [...items]
    .filter(isStoredNotification)
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, TRACK_LIMITS.maxNotificationCenterItems);
}

export function readNotificationCenter(userId: string): TrackCenterNotification[] {
  if (!userId) return [];
  const stored = safeStorageGet(accountStorageKey(userId, "notifications"));
  if (!stored) return [];
  try {
    const parsed: JsonValue | undefined = JSON.parse(stored);
    return Array.isArray(parsed) ? boundedNotifications(parsed) : [];
  } catch {
    return [];
  }
}

export function saveNotificationCenter(userId: string, items: TrackCenterNotification[]) {
  if (!userId) return;
  safeStorageSet(accountStorageKey(userId, "notifications"), JSON.stringify(boundedNotifications(items)));
}

export function publishTrackNotification(notification: Omit<TrackCenterNotification, "unread">, userId?: string) {
  if (!globalThis.window) return;
  const detail: TrackNotificationEventDetail = { ...notification, unread: true, userId };
  window.dispatchEvent(new CustomEvent<TrackNotificationEventDetail>(TRACK_NOTIFICATION_EVENT, { detail }));
}
