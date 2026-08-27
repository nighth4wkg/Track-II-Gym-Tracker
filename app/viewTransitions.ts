import { flushSync } from "react-dom";

type NativeViewTransition = {
  finished: Promise<void>;
  skipTransition?: () => void;
};

type TransitionDocument = Document & {
  startViewTransition?: (update: () => void) => NativeViewTransition;
};

let fallbackTimer: number | null = null;
let activeNativeTransition: NativeViewTransition | null = null;

/**
 * Keep state changes that replace a primary surface in one visual transaction.
 * Browsers with View Transitions get a shared-layout snapshot; other browsers
 * receive the same short compositor-friendly arrival animation.
 */
export function runViewTransition(update: () => void) {
  if (!globalThis.document) {
    update();
    return;
  }

  // SAFETY: the browser boundary above guarantees a real Document; the
  // extended type only adds the optional View Transitions API method.
  const transitionDocument = document as TransitionDocument;
  if (transitionDocument.startViewTransition) {
    if (activeNativeTransition) {
      activeNativeTransition.skipTransition?.();
      activeNativeTransition = null;
      flushSync(update);
      return;
    }
    try {
      const transition = transitionDocument.startViewTransition(() => {
        flushSync(update);
      });
      activeNativeTransition = transition;
      transition.finished.then(
        () => {
          if (activeNativeTransition === transition) activeNativeTransition = null;
        },
        () => {
          if (activeNativeTransition === transition) activeNativeTransition = null;
        },
      );
      return;
    } catch {
      // A rapid second interaction can overlap an active native transition;
      // the fallback below keeps the state change reliable in that case.
    }
  }

  const root = document.documentElement;
  if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
  root.classList.remove("track-view-transitioning");
  void root.offsetWidth;
  root.classList.add("track-view-transitioning");
  flushSync(update);
  fallbackTimer = window.setTimeout(() => {
    root.classList.remove("track-view-transitioning");
    fallbackTimer = null;
  }, 320);
}
