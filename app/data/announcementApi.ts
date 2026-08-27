import { supabase } from "../supabase";
import { MILLISECONDS_PER_DAY, TRACK_LIMITS } from "../trackConstants";
import type { JsonValue, TrackAnnouncement } from "../trackTypes";
import {
  accountStorageKey,
  isJsonObject,
  isStringValue,
  isMissingTrackFunction,
  parseStringArray,
  safeStorageGet,
  safeStorageSet,
} from "../trackUtils";

const MAX_DISMISSED_ANNOUNCEMENTS = 100;

function announcementFrom(value: JsonValue | JsonValue[] | null | undefined): TrackAnnouncement | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!isJsonObject(row)) return null;
  const id = isStringValue(row.id) ? row.id.trim() : "";
  const message = isStringValue(row.message) ? row.message.trim() : "";
  if (!id || !message) return null;
  return { id, message: message.slice(0, TRACK_LIMITS.maxAnnouncementChars) };
}

function dismissedAnnouncementIds(userId: string) {
  return new Set(parseStringArray(safeStorageGet(accountStorageKey(userId, "dismissed-announcements"))));
}

export function isAnnouncementDismissedLocally(userId: string, announcementId: string) {
  return dismissedAnnouncementIds(userId).has(announcementId);
}

export function markTrackAnnouncementDismissed(userId: string, announcementId: string) {
  const next = [
    announcementId,
    ...parseStringArray(safeStorageGet(accountStorageKey(userId, "dismissed-announcements"))).filter(
      (id) => id !== announcementId,
    ),
  ].slice(0, MAX_DISMISSED_ANNOUNCEMENTS);
  safeStorageSet(accountStorageKey(userId, "dismissed-announcements"), JSON.stringify(next));
}

export async function loadLatestTrackAnnouncement(userId: string): Promise<TrackAnnouncement | null> {
  const rpcResult = await supabase.rpc("get_latest_track_announcement", {
    lookback_days: TRACK_LIMITS.announcementLookbackDays,
  });
  const rpcAnnouncement = !rpcResult.error ? announcementFrom(rpcResult.data) : null;
  if (rpcAnnouncement && !isAnnouncementDismissedLocally(userId, rpcAnnouncement.id)) return rpcAnnouncement;
  if (!rpcResult.error || (rpcAnnouncement && isAnnouncementDismissedLocally(userId, rpcAnnouncement.id))) return null;

  // Keep older deployments working until the receipt migration is applied.
  // The local acknowledgement still prevents a dismissed banner from
  // returning on this device during that rollout window.
  const cutoff = new Date(Date.now() - TRACK_LIMITS.announcementLookbackDays * MILLISECONDS_PER_DAY).toISOString();
  const fallback = await supabase
    .from("track_announcements")
    .select("id,message")
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (fallback.error) return null;
  const announcement = announcementFrom(fallback.data);
  return announcement && !isAnnouncementDismissedLocally(userId, announcement.id) ? announcement : null;
}

export async function acknowledgeTrackAnnouncement(userId: string, announcementId: string) {
  if (!userId || !announcementId) return;
  // Mark synchronously first so a refresh or a failed network request cannot
  // immediately replay a banner the user already dismissed.
  markTrackAnnouncementDismissed(userId, announcementId);
  const { error } = await supabase.rpc("acknowledge_track_announcement", {
    p_announcement_id: announcementId,
  });
  // A missing function is expected while an older Pages build is paired with
  // the new frontend. The local receipt is still a safe fallback.
  if (error && !isMissingTrackFunction(error)) return;
}
