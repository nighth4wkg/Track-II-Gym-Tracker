"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";
import type { TimerMode } from "../components/TimerScreen";
import { haptic } from "../haptics";
import {
  DESKTOP_SIDEBAR_SWIPE_DIRECTION_RATIO,
  DESKTOP_SIDEBAR_SWIPE_DISTANCE,
  MOBILE_SIDEBAR_GESTURE_EDGE,
  MOBILE_SIDEBAR_SWIPE_DISTANCE,
  MOBILE_SIDEBAR_SWIPE_DISTANCE_AWAY_FROM_EDGE,
  MOBILE_SIDEBAR_SWIPE_DIRECTION_RATIO,
  MOBILE_SIDEBAR_SWIPE_DIRECTION_RATIO_AWAY_FROM_EDGE,
} from "../trackConstants";
import { safeStorageSet } from "../trackUtils";

type SidebarGestureOptions = {
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: Dispatch<SetStateAction<boolean>>;
  timerMode: TimerMode;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: Dispatch<SetStateAction<boolean>>;
};

type MobilePointerSwipeStart = {
  x: number;
  y: number;
  pointerId: number;
};

export function useSidebarGestures({
  mobileSidebarOpen,
  setMobileSidebarOpen,
  timerMode,
  sidebarCollapsed,
  setSidebarCollapsed,
}: SidebarGestureOptions) {
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const mobilePointerSwipeStart = useRef<MobilePointerSwipeStart | null>(null);
  const desktopSwipeStart = useRef<{ x: number; y: number; pointerId: number; sidebarCollapsed: boolean } | null>(null);
  const desktopSwipeMoveRef = useRef<(event: PointerEvent) => void>(() => undefined);
  const desktopSwipeEndRef = useRef<(event: PointerEvent) => void>(() => undefined);
  const mobileSwipeMoveRef = useRef<(event: PointerEvent) => void>(() => undefined);
  const mobileSwipeEndRef = useRef<(event: PointerEvent) => void>(() => undefined);

  const finishMobileSwipe = useCallback(
    ({
      startX,
      startY,
      endX,
      endY,
      target,
    }: {
      startX: number;
      startY: number;
      endX: number;
      endY: number;
      target: EventTarget | null;
    }) => {
      const dx = endX - startX;
      const dy = Math.abs(endY - startY);
      const insideTimer = target instanceof Element && Boolean(target.closest(".timer-screen"));
      const isTimerSidebarGesture =
        insideTimer &&
        !mobileSidebarOpen &&
        dx > 0 &&
        (timerMode === "stopwatch" || startX <= MOBILE_SIDEBAR_GESTURE_EDGE);
      if (insideTimer && !isTimerSidebarGesture && !mobileSidebarOpen) return;
      const minimumDistance =
        startX <= MOBILE_SIDEBAR_GESTURE_EDGE
          ? MOBILE_SIDEBAR_SWIPE_DISTANCE
          : MOBILE_SIDEBAR_SWIPE_DISTANCE_AWAY_FROM_EDGE;
      const directionRatio =
        startX <= MOBILE_SIDEBAR_GESTURE_EDGE
          ? MOBILE_SIDEBAR_SWIPE_DIRECTION_RATIO
          : MOBILE_SIDEBAR_SWIPE_DIRECTION_RATIO_AWAY_FROM_EDGE;
      if (Math.abs(dx) < minimumDistance || Math.abs(dx) < dy * directionRatio) return;
      if (!mobileSidebarOpen && dx > 0) setMobileSidebarOpen(true);
      if (mobileSidebarOpen && dx < 0) setMobileSidebarOpen(false);
    },
    [mobileSidebarOpen, setMobileSidebarOpen, timerMode],
  );

  function handleSwipeStart(event: ReactTouchEvent) {
    if (!window.matchMedia("(max-width:1200px)").matches) {
      swipeStart.current = null;
      return;
    }
    if (mobilePointerSwipeStart.current) return;
    if (event.touches.length !== 1) {
      swipeStart.current = null;
      return;
    }
    if (!(event.target instanceof Element)) {
      swipeStart.current = null;
      return;
    }
    const target = event.target;
    if (target.closest(".bottom-tab-bar")) {
      swipeStart.current = null;
      return;
    }
    const touch = event.touches[0];
    const insideTimer = Boolean(target.closest(".timer-screen"));
    // In Stopwatch mode, a right swipe is unused by the timer, so it may open
    // the sidebar from anywhere. In Rest mode, the familiar left-edge gesture
    // remains available without stealing the swipe that returns to Stopwatch.
    if (insideTimer && !mobileSidebarOpen && timerMode !== "stopwatch" && touch.clientX > MOBILE_SIDEBAR_GESTURE_EDGE) {
      swipeStart.current = null;
      return;
    }
    // A deliberate horizontal swipe should open the sidebar even when it starts
    // over an exercise card. Only editable controls keep the gesture for input.
    if (!mobileSidebarOpen && target.closest("input, textarea, select, [contenteditable='true']")) {
      swipeStart.current = null;
      return;
    }
    swipeStart.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleSwipeEnd(event: ReactTouchEvent) {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || event.changedTouches.length !== 1) return;
    const touch = event.changedTouches[0];
    const target = event.target;
    finishMobileSwipe({
      startX: start.x,
      startY: start.y,
      endX: touch.clientX,
      endY: touch.clientY,
      target,
    });
  }

  const beginMobilePointerSwipe = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!event.isPrimary || event.button !== 0 || swipeStart.current || mobilePointerSwipeStart.current) return;
      if (!(event.target instanceof Element)) return;
      const target = event.target;
      if (target.closest(".bottom-tab-bar")) return;
      const insideTimer = Boolean(target.closest(".timer-screen"));
      if (insideTimer && !mobileSidebarOpen && timerMode !== "stopwatch" && event.clientX > MOBILE_SIDEBAR_GESTURE_EDGE)
        return;
      if (!mobileSidebarOpen && target.closest("input, textarea, select, [contenteditable='true']")) return;
      mobilePointerSwipeStart.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    },
    [mobileSidebarOpen, timerMode],
  );

  const moveMobilePointerSwipe = useCallback((event: PointerEvent) => {
    const start = mobilePointerSwipeStart.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy) * MOBILE_SIDEBAR_SWIPE_DIRECTION_RATIO) event.preventDefault();
  }, []);

  const finishMobilePointerSwipe = useCallback(
    (event: PointerEvent) => {
      const start = mobilePointerSwipeStart.current;
      mobilePointerSwipeStart.current = null;
      if (!start || start.pointerId !== event.pointerId) return;
      finishMobileSwipe({
        startX: start.x,
        startY: start.y,
        endX: event.clientX,
        endY: event.clientY,
        target: event.target,
      });
    },
    [finishMobileSwipe],
  );

  function beginDesktopSidebarSwipe(event: ReactPointerEvent<HTMLElement>) {
    desktopSwipeStart.current = null;
    if (!event.isPrimary || event.button !== 0) return;
    if (window.matchMedia("(max-width:1200px)").matches) {
      beginMobilePointerSwipe(event);
      return;
    }
    if (!(event.target instanceof Element)) return;
    const target = event.target;
    if (
      target.closest(
        "button, input, textarea, select, a, [contenteditable='true'], .bottom-tab-bar, .sidebar-toggle, .sidebar-inline-toggle",
      )
    )
      return;
    desktopSwipeStart.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId, sidebarCollapsed };
  }

  const moveDesktopSidebarSwipe = useCallback((event: PointerEvent) => {
    const start = desktopSwipeStart.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy) * DESKTOP_SIDEBAR_SWIPE_DIRECTION_RATIO) event.preventDefault();
  }, []);

  const finishDesktopSidebarSwipe = useCallback(
    (event: PointerEvent) => {
      const start = desktopSwipeStart.current;
      desktopSwipeStart.current = null;
      if (!start || start.pointerId !== event.pointerId) return;
      if (window.matchMedia("(max-width:1200px)").matches) return;
      const dx = event.clientX - start.x;
      const dy = Math.abs(event.clientY - start.y);
      if (Math.abs(dx) < DESKTOP_SIDEBAR_SWIPE_DISTANCE || Math.abs(dx) < dy * DESKTOP_SIDEBAR_SWIPE_DIRECTION_RATIO)
        return;
      const shouldOpen = start.sidebarCollapsed && dx > 0;
      const shouldClose = !start.sidebarCollapsed && dx < 0;
      if (!shouldOpen && !shouldClose) return;
      haptic(10);
      setSidebarCollapsed(shouldOpen ? false : true);
      safeStorageSet("ironlog-sidebar", shouldOpen ? "open" : "collapsed");
    },
    [setSidebarCollapsed],
  );

  const cancelDesktopSidebarSwipe = useCallback(() => {
    desktopSwipeStart.current = null;
    mobilePointerSwipeStart.current = null;
    swipeStart.current = null;
  }, []);

  useEffect(() => {
    desktopSwipeMoveRef.current = moveDesktopSidebarSwipe;
    desktopSwipeEndRef.current = finishDesktopSidebarSwipe;
    mobileSwipeMoveRef.current = moveMobilePointerSwipe;
    mobileSwipeEndRef.current = finishMobilePointerSwipe;
  }, [finishDesktopSidebarSwipe, finishMobilePointerSwipe, moveDesktopSidebarSwipe, moveMobilePointerSwipe]);

  useEffect(() => {
    const moveSidebar = (event: PointerEvent) => {
      desktopSwipeMoveRef.current(event);
      mobileSwipeMoveRef.current(event);
    };
    const finishSidebar = (event: PointerEvent) => {
      desktopSwipeEndRef.current(event);
      mobileSwipeEndRef.current(event);
    };
    const cancelDesktopSidebar = () => cancelDesktopSidebarSwipe();
    window.addEventListener("pointermove", moveSidebar, { passive: false });
    window.addEventListener("pointerup", finishSidebar);
    window.addEventListener("pointercancel", cancelDesktopSidebar);
    window.addEventListener("blur", cancelDesktopSidebar);
    return () => {
      window.removeEventListener("pointermove", moveSidebar);
      window.removeEventListener("pointerup", finishSidebar);
      window.removeEventListener("pointercancel", cancelDesktopSidebar);
      window.removeEventListener("blur", cancelDesktopSidebar);
    };
  }, [cancelDesktopSidebarSwipe]);

  return {
    handleSwipeStart,
    handleSwipeEnd,
    beginDesktopSidebarSwipe,
    cancelDesktopSidebarSwipe,
  };
}
