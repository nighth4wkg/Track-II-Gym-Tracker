"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent,
} from "react";
import { supabase } from "../supabase";
import { applyAnimatedStyles } from "../domMotion";
import { haptic } from "../haptics";
import type { WorkoutDateSyncEvent } from "../calendarTypes";
import { useModalFocus } from "../hooks/useModalFocus";
import { fetchWorkoutDayDetail, type WorkoutDayDetail } from "../data/calendarWorkoutData";
import { CalendarDetailModal } from "./CalendarDetailModal";
import { TRACK_TIMING } from "../trackConstants";
import { CalendarMonthOverview } from "./CalendarMonthOverview";

export type CalendarScreenProps = {
  month: Date;
  onMonthChange: (month: Date) => void;
  workoutDates: Set<string>;
  userId: string;
  onWorkoutDateRemoved: (dateKey: string) => void;
  onWorkoutDateRestored: (dateKey: string) => void;
  onOfferUndo: (message: string, undo: () => void, commit?: () => void | Promise<void>) => void;
  onWorkoutDateEvent: (event: WorkoutDateSyncEvent, dateKey: string) => void;
};

export function CalendarScreen({
  month,
  onMonthChange,
  workoutDates,
  userId,
  onWorkoutDateRemoved,
  onWorkoutDateRestored,
  onOfferUndo,
  onWorkoutDateEvent,
}: CalendarScreenProps) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [detail, setDetail] = useState<WorkoutDayDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [noteEditing, setNoteEditing] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState("");
  const [deletingWorkout, setDeletingWorkout] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [expandedExercises, setExpandedExercises] = useState<string[]>([]);
  const [detailScroll, setDetailScroll] = useState({ canScroll: false, thumbSize: 100, thumbOffset: 0, value: 0 });
  const detailScrollRef = useRef<HTMLDivElement | null>(null);
  const detailModalRef = useRef<HTMLElement>(null);
  const detailScrollTrackRef = useRef<HTMLDivElement | null>(null);
  const detailScrollThumbRef = useRef<HTMLDivElement | null>(null);
  const detailScrollDrag = useRef<{ startY: number; startTop: number } | null>(null);
  const [monthDirection, setMonthDirection] = useState<"idle" | "next" | "previous">("idle");
  const calendarSwipeStart = useRef<{ x: number; y: number } | null>(null);

  useModalFocus({ open: Boolean(selectedDate), containerRef: detailModalRef });

  function navigateMonth(delta: number) {
    setMonthDirection(delta > 0 ? "next" : "previous");
    onMonthChange(new Date(year, monthIndex + delta, 1));
  }

  function startCalendarSwipe(event: TouchEvent<HTMLDivElement>) {
    const touch = event.touches[0];
    if (touch) calendarSwipeStart.current = { x: touch.clientX, y: touch.clientY };
  }

  function finishCalendarSwipe(event: TouchEvent<HTMLDivElement>) {
    const start = calendarSwipeStart.current;
    calendarSwipeStart.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.15) return;
    haptic(7);
    navigateMonth(dx < 0 ? 1 : -1);
  }

  useEffect(() => {
    const resetFrame = window.requestAnimationFrame(() => {
      setExpandedExercises([]);
      setDetailScroll({ canScroll: false, thumbSize: 100, thumbOffset: 0, value: 0 });
    });
    if (!selectedDate) return () => window.cancelAnimationFrame(resetFrame);
    let cancelled = false;
    const loadTimer = window.setTimeout(() => {
      setDetail(null);
      setDetailLoading(true);
      void fetchWorkoutDayDetail(userId, selectedDate).then((result) => {
        if (!cancelled) {
          setDetail(result);
          setNoteDraft(result?.notes ?? "");
          setNoteEditing(false);
          setNoteError("");
          setDeleteError("");
          setDetailLoading(false);
        }
      });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(loadTimer);
      window.cancelAnimationFrame(resetFrame);
    };
  }, [selectedDate, userId]);

  useEffect(() => {
    if (!selectedDate) return;
    document.body.classList.add("calendar-detail-open");
    document.documentElement.classList.add("calendar-detail-open");
    return () => {
      document.body.classList.remove("calendar-detail-open");
      document.documentElement.classList.remove("calendar-detail-open");
    };
  }, [selectedDate]);

  useLayoutEffect(() => {
    if (!detailScroll.canScroll) return;
    applyAnimatedStyles(
      detailScrollThumbRef.current,
      {
        "--calendar-thumb-size": `${detailScroll.thumbSize}%`,
        "--calendar-thumb-offset": `${detailScroll.thumbOffset}%`,
      },
      90,
    );
  }, [detailScroll.canScroll, detailScroll.thumbOffset, detailScroll.thumbSize]);

  // Keep an open detail card current when the same workout is edited on
  // another device. The main sync channel refreshes the calendar itself;
  // this lightweight poll refreshes the note/detail currently on screen.
  useEffect(() => {
    if (!selectedDate || noteEditing) return;
    const refreshDetail = async () => {
      const result = await fetchWorkoutDayDetail(userId, selectedDate);
      if (result) {
        setDetail(result);
        setNoteDraft(result.notes);
      }
    };
    const refreshWhenVisible = () => {
      if (!document.hidden) void refreshDetail();
    };
    const timer = window.setInterval(refreshWhenVisible, TRACK_TIMING.calendarDetailRefreshMs);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [selectedDate, userId, noteEditing]);

  async function saveNote() {
    if (!detail || noteSaving) return;
    setNoteSaving(true);
    setNoteError("");
    const note = noteDraft.trim().slice(0, 2000);
    const notesResult = await supabase
      .from("workout_notes")
      .upsert(
        { user_id: userId, date_key: detail.dateKey, note, updated_at: new Date().toISOString() },
        { onConflict: "user_id,date_key" },
      );
    // Keep the note on the session rows too. This makes it readable by older
    // builds and gives both devices a second, durable sync path.
    const sessionResult = detail.sessionIds.length
      ? await supabase
          .from("workout_sessions")
          .update({ notes: note })
          .eq("user_id", userId)
          .in("id", detail.sessionIds)
      : { error: null };
    // A legacy mirror failure is intentionally non-fatal because the
    // canonical upsert above is the durable source of truth.
    void sessionResult;
    if (notesResult.error) {
      setNoteError("Notes need the latest database update. Run the notes migration, then try again.");
    } else {
      setDetail((current) => (current ? { ...current, notes: noteDraft.trim() } : current));
      setNoteEditing(false);
    }
    setNoteSaving(false);
  }

  async function deleteWorkoutPermanently(workoutDate: string, sessionIds: string[]) {
    setDeletingWorkout(true);
    // Delete only the exact sessions shown in the calendar detail. A date
    // filter is unsafe because a user can have multiple sessions around a
    // local/UTC boundary or intentionally log more than one session per day.
    const { error } = await supabase.rpc("delete_workout_day", {
      p_workout_date: workoutDate,
      p_session_ids: sessionIds,
    });
    if (error) {
      onWorkoutDateRestored(workoutDate);
      onWorkoutDateEvent("workout-restored", workoutDate);
      setDeleteError("Couldn’t delete this workout. Check your connection and try again.");
      setSelectedDate(null);
    } else onWorkoutDateEvent("workout-deleted", workoutDate);
    setDeletingWorkout(false);
  }

  async function deleteSelectedWorkout() {
    if (!selectedDate || deletingWorkout) return;
    const workoutDate = selectedDate;
    const workoutDateLabel = new Date(`${workoutDate}T00:00:00`).toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    if (
      !window.confirm(
        `Delete the saved workout from ${workoutDateLabel}? Your current split and exercises will stay unchanged.`,
      )
    )
      return;
    const sessionIds = detail?.sessionIds ?? [];
    setDeleteError("");
    onWorkoutDateRemoved(workoutDate);
    onWorkoutDateEvent("workout-delete-pending", workoutDate);
    setSelectedDate(null);
    onOfferUndo(
      "Workout deleted",
      () => {
        onWorkoutDateRestored(workoutDate);
        onWorkoutDateEvent("workout-restored", workoutDate);
      },
      () => deleteWorkoutPermanently(workoutDate, sessionIds),
    );
  }

  function updateDetailScroll() {
    const element = detailScrollRef.current;
    if (!element) {
      setDetailScroll({ canScroll: false, thumbSize: 100, thumbOffset: 0, value: 0 });
      return;
    }
    const maxScroll = Math.max(0, element.scrollHeight - element.clientHeight);
    if (maxScroll <= 1) {
      setDetailScroll({ canScroll: false, thumbSize: 100, thumbOffset: 0, value: 0 });
      return;
    }
    const thumbSize = Math.max(18, Math.min(100, (element.clientHeight / element.scrollHeight) * 100));
    const value = (element.scrollTop / maxScroll) * 100;
    setDetailScroll({ canScroll: true, thumbSize, thumbOffset: (value / 100) * (100 - thumbSize), value });
  }

  useEffect(() => {
    if (!selectedDate) return;
    const element = detailScrollRef.current;
    if (!element) return;
    const frame = window.requestAnimationFrame(updateDetailScroll);
    window.addEventListener("resize", updateDetailScroll);
    let observer: ResizeObserver | null = null;
    const ResizeObserverConstructor = globalThis.ResizeObserver;
    if (ResizeObserverConstructor) {
      observer = new ResizeObserverConstructor(updateDetailScroll);
      observer.observe(element);
    }
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateDetailScroll);
      observer?.disconnect();
    };
  }, [detail, detailLoading, expandedExercises, noteEditing, noteDraft, selectedDate]);

  function handleDetailScrollbarTrackPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    const element = detailScrollRef.current;
    const track = detailScrollTrackRef.current;
    const thumb = detailScrollThumbRef.current;
    if (!element || !track || !thumb) return;
    const trackRect = track.getBoundingClientRect();
    const thumbRect = thumb.getBoundingClientRect();
    const maxScroll = Math.max(0, element.scrollHeight - element.clientHeight);
    const travel = trackRect.height - thumbRect.height;
    if (maxScroll <= 0 || travel <= 0) return;
    const ratio = Math.max(0, Math.min(1, (event.clientY - trackRect.top - thumbRect.height / 2) / travel));
    element.scrollTop = ratio * maxScroll;
  }

  function startDetailScrollbarDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const element = detailScrollRef.current;
    if (!element) return;
    event.preventDefault();
    event.stopPropagation();
    detailScrollDrag.current = { startY: event.clientY, startTop: element.scrollTop };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDetailScrollbarDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = detailScrollDrag.current;
    const element = detailScrollRef.current;
    const track = detailScrollTrackRef.current;
    const thumb = detailScrollThumbRef.current;
    if (!drag || !element || !track || !thumb) return;
    const travel = track.getBoundingClientRect().height - thumb.getBoundingClientRect().height;
    const maxScroll = Math.max(0, element.scrollHeight - element.clientHeight);
    if (travel <= 0 || maxScroll <= 0) return;
    const nextTop = drag.startTop + (event.clientY - drag.startY) * (maxScroll / travel);
    element.scrollTop = Math.max(0, Math.min(maxScroll, nextTop));
  }

  function endDetailScrollbarDrag(event: ReactPointerEvent<HTMLDivElement>) {
    detailScrollDrag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleDetailScrollbarKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const element = detailScrollRef.current;
    if (!element) return;
    const maxScroll = Math.max(0, element.scrollHeight - element.clientHeight);
    const page = Math.max(48, element.clientHeight * 0.75);
    let nextScroll: number | null = null;
    if (event.key === "ArrowDown") nextScroll = element.scrollTop + 48;
    if (event.key === "ArrowUp") nextScroll = element.scrollTop - 48;
    if (event.key === "PageDown") nextScroll = element.scrollTop + page;
    if (event.key === "PageUp") nextScroll = element.scrollTop - page;
    if (event.key === "Home") nextScroll = 0;
    if (event.key === "End") nextScroll = maxScroll;
    if (nextScroll === null) return;
    event.preventDefault();
    element.scrollTop = Math.max(0, Math.min(maxScroll, nextScroll));
  }

  return (
    <section className="calendar-screen">
      <CalendarMonthOverview
        month={month}
        monthDirection={monthDirection}
        workoutDates={workoutDates}
        onMonthDelta={(delta) => {
          haptic(6);
          navigateMonth(delta);
        }}
        onToday={() => {
          haptic(8);
          onMonthChange(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
        }}
        onSelectDate={setSelectedDate}
        onTouchStart={startCalendarSwipe}
        onTouchEnd={finishCalendarSwipe}
      />
      {selectedDate && (
        <CalendarDetailModal
          selectedDate={selectedDate}
          detail={detail}
          detailLoading={detailLoading}
          expandedExercises={expandedExercises}
          noteEditing={noteEditing}
          noteDraft={noteDraft}
          noteSaving={noteSaving}
          noteError={noteError}
          deletingWorkout={deletingWorkout}
          deleteError={deleteError}
          detailScroll={detailScroll}
          detailModalRef={detailModalRef}
          detailScrollRef={detailScrollRef}
          detailScrollTrackRef={detailScrollTrackRef}
          detailScrollThumbRef={detailScrollThumbRef}
          onClose={() => setSelectedDate(null)}
          onExpandedExercisesChange={setExpandedExercises}
          onNoteEditingChange={setNoteEditing}
          onNoteDraftChange={setNoteDraft}
          onNoteErrorChange={setNoteError}
          onSaveNote={() => void saveNote()}
          onDeleteWorkout={() => void deleteSelectedWorkout()}
          onScroll={updateDetailScroll}
          onTrackPointerDown={handleDetailScrollbarTrackPointerDown}
          onThumbPointerDown={startDetailScrollbarDrag}
          onThumbPointerMove={moveDetailScrollbarDrag}
          onThumbPointerEnd={endDetailScrollbarDrag}
          onThumbKeyDown={handleDetailScrollbarKeyDown}
        />
      )}
    </section>
  );
}
