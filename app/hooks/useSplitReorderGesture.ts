"use client";

import { useRef, type Dispatch, type SetStateAction, type PointerEvent as ReactPointerEvent } from "react";
import type { Checklist } from "../trackTypes";
import { TRACK_INTERACTION, TRACK_TIMING } from "../trackConstants";

type SplitReorderOptions = {
  setLists: Dispatch<SetStateAction<Checklist[]>>;
  setDraggingSplit: Dispatch<SetStateAction<string | null>>;
  setSplitMenu: Dispatch<SetStateAction<{ id: string; x: number; y: number } | null>>;
};

function splitMenuPosition(rect: DOMRect) {
  return {
    x: Math.max(
      TRACK_INTERACTION.splitMenuOffsetX + 2,
      Math.min(rect.left + TRACK_INTERACTION.splitMenuOffsetX, window.innerWidth - TRACK_INTERACTION.splitMenuWidthPx),
    ),
    y: Math.min(
      rect.bottom + TRACK_INTERACTION.splitMenuOffsetY,
      window.innerHeight - TRACK_INTERACTION.splitMenuBottomInsetPx,
    ),
  };
}

export function useSplitReorderGesture({ setLists, setDraggingSplit, setSplitMenu }: SplitReorderOptions) {
  const splitHoldTimer = useRef<number | null>(null);
  const splitHoldStart = useRef<{ x: number; y: number } | null>(null);
  const splitHoldTriggered = useRef(false);
  const splitDragArmed = useRef(false);
  const splitDragActive = useRef(false);
  const splitDragMoved = useRef(false);
  const splitDragId = useRef<string | null>(null);
  const splitHoldTarget = useRef<HTMLButtonElement | null>(null);
  const splitHoldMenuOpened = useRef(false);

  function cancelSplitHold() {
    if (splitHoldTimer.current !== null) window.clearTimeout(splitHoldTimer.current);
    splitHoldTimer.current = null;
    splitHoldStart.current = null;
    splitDragArmed.current = false;
    splitHoldTarget.current = null;
    splitHoldMenuOpened.current = false;
  }

  function beginSplitHold(event: ReactPointerEvent<HTMLButtonElement>, id: string) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    cancelSplitHold();
    splitHoldTriggered.current = false;
    splitDragActive.current = false;
    splitDragMoved.current = false;
    splitDragId.current = id;
    splitHoldTarget.current = event.currentTarget;
    splitHoldMenuOpened.current = false;
    splitHoldStart.current = { x: event.clientX, y: event.clientY };
    setSplitMenu(null);
    splitHoldTimer.current = window.setTimeout(() => {
      splitDragArmed.current = true;
      splitHoldTimer.current = null;
      splitHoldMenuOpened.current = true;
      splitHoldTriggered.current = true;
      setDraggingSplit(id);
      const rect = splitHoldTarget.current?.getBoundingClientRect();
      if (rect) {
        setSplitMenu({ id, ...splitMenuPosition(rect) });
      }
      if (event.pointerType !== "mouse") navigator.vibrate?.(TRACK_INTERACTION.splitHoldHapticMs);
    }, TRACK_TIMING.splitHoldMenuMs);
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
    if (!splitDragActive.current && splitDragArmed.current && distance > TRACK_INTERACTION.splitHoldMoveThreshold) {
      splitDragActive.current = true;
      splitDragMoved.current = true;
      splitHoldTriggered.current = true;
      splitHoldMenuOpened.current = false;
      setSplitMenu(null);
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
    const menuOpened = splitHoldMenuOpened.current;
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
    if (armed && !menuOpened) {
      splitHoldTriggered.current = true;
      setSplitMenu({ id, ...splitMenuPosition(rect) });
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
