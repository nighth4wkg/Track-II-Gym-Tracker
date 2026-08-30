import { useEffect } from "react";
import { TRACK_INTERACTION, TRACK_TIMING } from "../trackConstants";
import type { UseTrackAppLifecycleOptions } from "./trackLifecycleTypes";

export function useTrackUiLifecycle({ workout, settings }: UseTrackAppLifecycleOptions) {
  const { setSplitMenu } = workout;
  const { setShowScrollTop, setShowScrollBottom } = settings;

  useEffect(() => {
    let frame: number | null = null;
    const updateScrollShortcut = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        const remaining = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
        const threshold = TRACK_INTERACTION.scrollShortcutThresholdPx;
        setShowScrollTop(window.scrollY > threshold);
        setShowScrollBottom(remaining > threshold);
      });
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
      if (frame !== null) window.cancelAnimationFrame(frame);
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
