import { useEffect } from "react";
import { TRACK_TIMING } from "../trackConstants";
import type { UseTrackAppLifecycleOptions } from "./trackLifecycleTypes";

export function useTrackUiLifecycle({ announcement, identity, workout, settings, refs }: UseTrackAppLifecycleOptions) {
  const { setAnnouncement } = identity;
  const { setSplitMenu } = workout;
  const { setShowScrollTop, setShowScrollBottom } = settings;
  const { announcementTimer: announcementTimerRef } = refs;

  useEffect(() => {
    if (!announcement) return;
    if (announcementTimerRef.current !== null) window.clearTimeout(announcementTimerRef.current);
    announcementTimerRef.current = window.setTimeout(() => setAnnouncement(null), TRACK_TIMING.announcementDismissMs);
    return () => {
      if (announcementTimerRef.current !== null) window.clearTimeout(announcementTimerRef.current);
    };
  }, [announcement, announcementTimerRef, setAnnouncement]);

  useEffect(() => {
    const updateScrollShortcut = () => {
      const remaining = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
      setShowScrollTop(window.scrollY > 420);
      setShowScrollBottom(remaining > 420);
    };
    updateScrollShortcut();
    window.addEventListener("scroll", updateScrollShortcut, { passive: true });
    window.addEventListener("resize", updateScrollShortcut, { passive: true });
    const observer = new ResizeObserver(updateScrollShortcut);
    observer.observe(document.body);
    return () => {
      window.removeEventListener("scroll", updateScrollShortcut);
      window.removeEventListener("resize", updateScrollShortcut);
      observer.disconnect();
    };
  }, [setShowScrollBottom, setShowScrollTop]);

  useEffect(() => {
    const closeMenu = () => setSplitMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    window.addEventListener("click", closeMenu);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [setSplitMenu]);

  useEffect(() => {
    // Keep the carefully fitted mobile layout at a stable 1:1 scale in Safari.
    let lastTouchEnd = 0;
    const stopGesture = (event: Event) => event.preventDefault();
    const stopPinch = (event: globalThis.TouchEvent) => {
      if (event.touches.length > 1) event.preventDefault();
    };
    const stopDoubleTap = (event: globalThis.TouchEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("button, a, input, textarea, select, [role='button'], .bottom-tab-bar")) {
        lastTouchEnd = 0;
        return;
      }
      const now = Date.now();
      if (now - lastTouchEnd < TRACK_TIMING.touchDoubleTapGuardMs) event.preventDefault();
      lastTouchEnd = now;
    };
    const stopDoubleClick = (event: MouseEvent) => event.preventDefault();

    document.addEventListener("gesturestart", stopGesture, { passive: false });
    document.addEventListener("gesturechange", stopGesture, { passive: false });
    document.addEventListener("gestureend", stopGesture, { passive: false });
    document.addEventListener("touchmove", stopPinch, { passive: false });
    document.addEventListener("touchend", stopDoubleTap, { passive: false });
    document.addEventListener("dblclick", stopDoubleClick, { passive: false });
    return () => {
      document.removeEventListener("gesturestart", stopGesture);
      document.removeEventListener("gesturechange", stopGesture);
      document.removeEventListener("gestureend", stopGesture);
      document.removeEventListener("touchmove", stopPinch);
      document.removeEventListener("touchend", stopDoubleTap);
      document.removeEventListener("dblclick", stopDoubleClick);
    };
  }, []);
}
