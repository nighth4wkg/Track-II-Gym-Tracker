import { useEffect } from "react";
import { loadLatestTrackAnnouncement } from "../data/announcementApi";
import { supabase } from "../supabase";
import { CALENDAR_SYNC_POLL_MS, TRACK_LIMITS } from "../trackConstants";
import { showSystemNotification } from "../notifications";
import type { UseTrackAppLifecycleOptions } from "./trackLifecycleTypes";

const ANNOUNCEMENT_FALLBACK_POLL_MS = 5 * 60 * 1000;

type AnnouncementRow = { id?: unknown; message?: unknown };

export function useTrackCloudLifecycle({
  user,
  showCalendar,
  cloudReady,
  announcement,
  identity,
  rank,
  refs,
  readWorkoutDates,
  applyWorkoutDates,
}: UseTrackAppLifecycleOptions) {
  const { setAnnouncement, setAnnouncementOffset } = identity;
  const { setCalendarMonth } = rank;
  const { calendarInitializedFor: calendarInitializedForRef, latestAnnouncementId: latestAnnouncementIdRef } = refs;

  useEffect(() => {
    if (!user?.id || !cloudReady) return;
    let cancelled = false;
    const refresh = async () => {
      const dates = await readWorkoutDates(user.id);
      if (cancelled || !dates) return;
      applyWorkoutDates(dates);
      if (calendarInitializedForRef.current !== user.id && dates.size > 0) {
        const latestKey = [...dates].sort().at(-1);
        if (latestKey) {
          const latestDate = new Date(`${latestKey}T00:00:00`);
          setCalendarMonth(new Date(latestDate.getFullYear(), latestDate.getMonth(), 1));
        }
        calendarInitializedForRef.current = user.id;
      }
    };
    void refresh();
    const interval = showCalendar
      ? window.setInterval(() => {
          if (!document.hidden) void refresh();
        }, CALENDAR_SYNC_POLL_MS)
      : null;
    return () => {
      cancelled = true;
      if (interval !== null) window.clearInterval(interval);
    };
  }, [
    applyWorkoutDates,
    calendarInitializedForRef,
    cloudReady,
    readWorkoutDates,
    setCalendarMonth,
    showCalendar,
    user?.id,
  ]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    let realtimeConnected = false;
    latestAnnouncementIdRef.current = null;

    const applyAnnouncement = (row: AnnouncementRow) => {
      if (cancelled) return;
      const id = String(row.id ?? "");
      const message = String(row.message ?? "")
        .trim()
        .slice(0, TRACK_LIMITS.maxAnnouncementChars);
      if (!id || !message || latestAnnouncementIdRef.current === id) return;
      latestAnnouncementIdRef.current = id;
      setAnnouncement({ id, message });
      void showSystemNotification(message, id);
    };

    const loadLatestAnnouncement = async () => {
      const latest = await loadLatestTrackAnnouncement(user.id);
      if (latest) applyAnnouncement(latest);
    };

    void loadLatestAnnouncement();
    const channel = supabase
      .channel("track-announcements")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "track_announcements" }, (payload) =>
        // SAFETY: Realtime payloads are object-shaped records; applyAnnouncement only reads id/message and bounds both values.
        applyAnnouncement(payload.new as AnnouncementRow),
      )
      .subscribe((status) => {
        realtimeConnected = status === "SUBSCRIBED";
        if (realtimeConnected) void loadLatestAnnouncement();
      });
    const fallbackInterval = window.setInterval(() => {
      if (!realtimeConnected && !document.hidden) void loadLatestAnnouncement();
    }, ANNOUNCEMENT_FALLBACK_POLL_MS);
    const resume = () => {
      if (!document.hidden) void loadLatestAnnouncement();
    };
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      cancelled = true;
      window.clearInterval(fallbackInterval);
      void supabase.removeChannel(channel);
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [latestAnnouncementIdRef, setAnnouncement, user?.id]);

  useEffect(() => {
    if (!announcement) return;
    setAnnouncementOffset(0);
  }, [announcement, setAnnouncementOffset]);
}
