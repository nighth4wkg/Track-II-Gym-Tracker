"use client";

import { useRef, type Dispatch, type SetStateAction, type PointerEvent as ReactPointerEvent } from "react";
import type { Checklist } from "../trackTypes";
import { TRACK_INTERACTION } from "../trackConstants";

type SplitReorderOptions = {
  setLists: Dispatch<SetStateAction<Checklist[]>>;
  setDraggingSplit: Dispatch<SetStateAction<string | null>>;
  setSplitMenu: Dispatch<SetStateAction<{ id: string; x: number; y: number } | null>>;
};

export function useSplitReorderGesture({ setLists, setDraggingSplit, setSplitMenu }: SplitReorderOptions) {
  const splitHoldTimer = useRef<number | null>(null);
  const splitHoldStart = useRef<{ x: number; y: number } | null>(null);
  const splitHoldTriggered = useRef(false);
  const splitDragArmed = useRef(false);
  const splitDragActive = useRef(false);
  const splitDragMoved = useRef(false);
  const splitDragId = useRef<string | null>(null);

  function cancelSplitHold() {
    if (splitHoldTimer.current !== null) window.clearTimeout(splitHoldTimer.current);
    splitHoldTimer.current = null;
    splitHoldStart.current = null;
    splitDragArmed.current = false;
  }

  function beginSplitHold(event: ReactPointerEvent<HTMLButtonElement>, id: string) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    cancelSplitHold();
    splitHoldTriggered.current = false;
    splitDragActive.current = false;
    splitDragMoved.current = false;
    splitDragId.current = id;
    splitHoldStart.current = { x: event.clientX, y: event.clientY };
    splitHoldTimer.current = window.setTimeout(() => {
      splitDragArmed.current = true;
      splitHoldTimer.current = null;
      if (event.pointerType !== "mouse") navigator.vibrate?.(20);
    }, 420);
  }

  function reorderSplitAtPoint(id: string, x: number, y: number) {
    const target = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-split-id]");
    const targetId = target?.dataset.splitId;
    if (!targetId || targetId === id) return;
    setLists((current) => {
      const from = current.findIndex((list) => list.id === id);
      const to = current.findIndex((list) => list.id === targetId);
      if (from < 0 || to < 0 || from === to) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function moveSplitHold(event: ReactPointerEvent<HTMLButtonElement>) {
    const start = splitHoldStart.current;
    if (!start) return;
    const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    if (!splitDragActive.current && !splitDragArmed.current) {
      if (distance > TRACK_INTERACTION.dragMovementThreshold) cancelSplitHold();
      return;
    }
    if (!splitDragActive.current && splitDragArmed.current && distance > 8) {
      splitDragActive.current = true;
      splitDragMoved.current = true;
      splitHoldTriggered.current = true;
      setDraggingSplit(splitDragId.current);
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* pointer capture is optional */
      }
    }
    if (splitDragActive.current && splitDragId.current)
      reorderSplitAtPoint(splitDragId.current, event.clientX, event.clientY);
  }

  function finishSplitHold(event: ReactPointerEvent<HTMLButtonElement>, id: string) {
    const armed = splitDragArmed.current;
    const activeDrag = splitDragActive.current;
    const moved = splitDragMoved.current;
    const rect = event.currentTarget.getBoundingClientRect();
    cancelSplitHold();
    splitDragActive.current = false;
    splitDragMoved.current = false;
    splitDragId.current = null;
    setDraggingSplit(null);
    if (activeDrag || moved) {
      splitHoldTriggered.current = true;
      return;
    }
    if (armed) {
      splitHoldTriggered.current = true;
      setSplitMenu({
        id,
        x: Math.max(12, Math.min(rect.left + 10, window.innerWidth - 180)),
        y: Math.min(rect.bottom + 5, window.innerHeight - 156),
      });
    }
  }

  function cancelSplitPointer() {
    cancelSplitHold();
    splitDragActive.current = false;
    splitDragMoved.current = false;
    splitDragId.current = null;
    setDraggingSplit(null);
  }

  return {
    splitHoldTriggered,
    beginSplitHold,
    moveSplitHold,
    finishSplitHold,
    cancelSplitPointer,
  };
}
