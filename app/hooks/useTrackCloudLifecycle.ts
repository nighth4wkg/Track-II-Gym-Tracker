import { useEffect } from "react";
import { supabase } from "../supabase";
import { CALENDAR_SYNC_POLL_MS, TRACK_LIMITS, TRACK_TIMING } from "../trackConstants";
import { showSystemNotification } from "../trackUtils";
import type { UseTrackAppLifecycleOptions } from "./trackLifecycleTypes";

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
  const { setAnnouncement, setAnnouncementOffset, setAdminAuthorized } = identity;
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
    latestAnnouncementIdRef.current = null;
    const loadLatestAnnouncement = async () => {
      const cutoff = new Date(Date.now() - TRACK_LIMITS.announcementLookbackDays * 86_400_000).toISOString();
      const { data, error } = await supabase
        .from("track_announcements")
        .select("id,message")
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || error || !data) return;
      const id = String(data.id ?? "");
      const message = String(data.message ?? "")
        .trim()
        .slice(0, TRACK_LIMITS.maxAnnouncementChars);
      if (!id || !message || latestAnnouncementIdRef.current === id) return;
      latestAnnouncementIdRef.current = id;
      setAnnouncement({ id, message });
      void showSystemNotification(message, id);
    };
    void loadLatestAnnouncement();
    const interval = window.setInterval(() => {
      if (!document.hidden) void loadLatestAnnouncement();
    }, TRACK_TIMING.announcementPollMs);
    const resume = () => {
      if (!document.hidden) void loadLatestAnnouncement();
    };
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [latestAnnouncementIdRef, setAnnouncement, user?.id]);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setAdminAuthorized(false);
      return () => {
        cancelled = true;
      };
    }
    setAdminAuthorized(false);
    let lastHeartbeat = 0;
    const sendHeartbeat = async () => {
      if (document.visibilityState !== "visible" || Date.now() - lastHeartbeat < TRACK_TIMING.adminHeartbeatStaleMs)
        return;
      lastHeartbeat = Date.now();
      const { data } = await supabase.functions.invoke("admin-member-data", { body: { action: "heartbeat" } });
      if (!cancelled) setAdminAuthorized(data?.isAdmin === true);
    };
    void sendHeartbeat();
    const interval = window.setInterval(sendHeartbeat, TRACK_TIMING.adminHeartbeatPollMs);
    document.addEventListener("visibilitychange", sendHeartbeat);
    window.addEventListener("focus", sendHeartbeat);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", sendHeartbeat);
      window.removeEventListener("focus", sendHeartbeat);
    };
  }, [setAdminAuthorized, user?.id]);

  useEffect(() => {
    if (!announcement) return;
    setAnnouncementOffset(0);
  }, [announcement, setAnnouncementOffset]);
}
