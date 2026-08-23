"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { haptic } from "../haptics";
import { TRACK_LIMITS, TRACK_TIMING } from "../trackConstants";
import type { UndoNotice } from "../trackTypes";

type UndoCallback = () => void | Promise<void>;

export function useUndoNotice() {
  const [undoNotice, setUndoNotice] = useState<UndoNotice | null>(null);
  const [undoDragX, setUndoDragX] = useState(0);
  const [undoDragging, setUndoDragging] = useState(false);
  const [undoDismissDirection, setUndoDismissDirection] = useState<-1 | 0 | 1>(0);
  const undoTimerRef = useRef<number | null>(null);
  const undoCommitRef = useRef<UndoCallback | null>(null);
  const undoDragStartRef = useRef<{ x: number; pointerId: number } | null>(null);

  const dismissUndoNotice = useCallback(() => {
    if (undoTimerRef.current !== null) window.clearTimeout(undoTimerRef.current);
    const pendingCommit = undoCommitRef.current;
    undoTimerRef.current = null;
    undoCommitRef.current = null;
    undoDragStartRef.current = null;
    setUndoNotice(null);
    setUndoDragX(0);
    setUndoDragging(false);
    setUndoDismissDirection(0);
    if (pendingCommit) void pendingCommit();
  }, []);

  const offerUndo = useCallback((message: string, undo: () => void, commit?: UndoCallback) => {
    if (undoTimerRef.current !== null) window.clearTimeout(undoTimerRef.current);
    const previousCommit = undoCommitRef.current;
    undoCommitRef.current = null;
    if (previousCommit) void previousCommit();
    setUndoDragX(0);
    setUndoDragging(false);
    setUndoDismissDirection(0);
    setUndoNotice({ message, undo });
    undoCommitRef.current = commit ?? null;
    undoTimerRef.current = window.setTimeout(() => {
      const pendingCommit = undoCommitRef.current;
      undoCommitRef.current = null;
      undoTimerRef.current = null;
      setUndoNotice(null);
      if (pendingCommit) void pendingCommit();
    }, TRACK_TIMING.undoNoticeDurationMs);
  }, []);

  const performUndo = useCallback(() => {
    if (!undoNotice) return;
    if (undoTimerRef.current !== null) window.clearTimeout(undoTimerRef.current);
    undoTimerRef.current = null;
    undoCommitRef.current = null;
    undoNotice.undo();
    setUndoDragX(0);
    setUndoDragging(false);
    setUndoDismissDirection(0);
    setUndoNotice(null);
    haptic(8);
  }, [undoNotice]);

  const beginUndoSwipe = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("button")) return;
    undoDragStartRef.current = { x: event.clientX, pointerId: event.pointerId };
    setUndoDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const moveUndoSwipe = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const start = undoDragStartRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    setUndoDragX(Math.max(-TRACK_LIMITS.undoDragRange, Math.min(TRACK_LIMITS.undoDragRange, event.clientX - start.x)));
  }, []);

  const finishUndoSwipe = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const start = undoDragStartRef.current;
      if (!start || start.pointerId !== event.pointerId) return;
      const distance = event.clientX - start.x;
      undoDragStartRef.current = null;
      setUndoDragging(false);
      if (Math.abs(distance) >= TRACK_LIMITS.undoSwipeDistance) {
        setUndoDismissDirection(distance < 0 ? -1 : 1);
        window.setTimeout(dismissUndoNotice, TRACK_TIMING.undoDismissMs);
        return;
      }
      setUndoDragX(0);
    },
    [dismissUndoNotice],
  );

  const cancelUndoSwipe = useCallback(() => {
    undoDragStartRef.current = null;
    setUndoDragging(false);
    setUndoDragX(0);
  }, []);

  useEffect(
    () => () => {
      if (undoTimerRef.current !== null) window.clearTimeout(undoTimerRef.current);
      const pendingCommit = undoCommitRef.current;
      undoCommitRef.current = null;
      if (pendingCommit) void pendingCommit();
    },
    [],
  );

  return {
    undoNotice,
    undoDragX,
    undoDragging,
    undoDismissDirection,
    offerUndo,
    performUndo,
    beginUndoSwipe,
    moveUndoSwipe,
    finishUndoSwipe,
    cancelUndoSwipe,
  };
}
