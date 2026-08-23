"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { DEFAULT_BOTTOM_TABS, type BottomTabId } from "../components/BottomTabBar";
import { haptic, hapticSelectionChanged, hapticSelectionEnd, hapticSelectionStart } from "../haptics";
import {
  BOTTOM_TAB_CANCEL_DISTANCE,
  BOTTOM_TAB_DRAG_START_DISTANCE,
  BOTTOM_TAB_HOLD_MS,
  BOTTOM_TAB_SWITCH_HYSTERESIS,
} from "../trackConstants";

type BottomTabNavigationOptions = {
  activeTab: BottomTabId;
  onNavigate: (id: BottomTabId) => void;
};

export function useBottomTabNavigation({ activeTab, onNavigate }: BottomTabNavigationOptions) {
  const [draggingTab, setDraggingTab] = useState<BottomTabId | null>(null);
  const [dragTargetTab, setDragTargetTab] = useState<BottomTabId | null>(null);
  const holdTimer = useRef<number | null>(null);
  const holdStart = useRef<{ x: number; y: number } | null>(null);
  const dragId = useRef<BottomTabId | null>(null);
  const pointerId = useRef<number | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragTarget = useRef<BottomTabId | null>(null);
  const dragArmed = useRef(false);
  const dragActive = useRef(false);
  const dragMoved = useRef(false);
  const holdTriggered = useRef(false);
  const pointerMoveRef = useRef<(event: PointerEvent) => void>(() => undefined);
  const pointerUpRef = useRef<(event: PointerEvent) => void>(() => undefined);
  const cancelPointerRef = useRef<() => void>(() => undefined);
  const indicatorFrame = useRef<number | null>(null);
  const indicatorPendingX = useRef<number | null>(null);
  const indicatorPosition = useRef<number | null>(null);

  const clearIndicatorOverride = useCallback(() => {
    const indicator = trackRef.current?.querySelector<HTMLElement>(".bottom-tab-active-indicator");
    if (!indicator) return;
    indicator.style.removeProperty("transform");
    indicator.style.removeProperty("transition");
  }, []);

  const cancelHold = useCallback(() => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
    holdStart.current = null;
    dragArmed.current = false;
  }, []);

  const updateIndicatorPosition = useCallback(
    (clientX: number | null) => {
      const track = trackRef.current;
      if (clientX === null) {
        indicatorPendingX.current = null;
        if (indicatorFrame.current !== null) window.cancelAnimationFrame(indicatorFrame.current);
        indicatorFrame.current = null;
        indicatorPosition.current = null;
        clearIndicatorOverride();
        return;
      }
      if (!track) return;
      const indicator = track.querySelector<HTMLElement>(".bottom-tab-active-indicator");
      if (!indicator) return;
      indicator.style.transition = "none";
      const getIndicatorLeft = (currentTrack: HTMLDivElement, nextX: number) => {
        const rect = currentTrack.getBoundingClientRect();
        const indicatorWidth = Math.max(0, (rect.width - 12) / 4);
        const maxLeft = Math.max(0, rect.width - indicatorWidth);
        return {
          indicatorWidth,
          maxLeft,
          left: Math.min(maxLeft, Math.max(0, nextX - rect.left - indicatorWidth / 2)),
        };
      };
      indicatorPendingX.current = clientX;
      if (indicatorFrame.current !== null) return;
      const animateIndicator = () => {
        indicatorFrame.current = null;
        const nextX = indicatorPendingX.current;
        const currentTrack = trackRef.current;
        const currentIndicator = currentTrack?.querySelector<HTMLElement>(".bottom-tab-active-indicator");
        if (nextX === null || !currentTrack || !currentIndicator) return;
        const { indicatorWidth, maxLeft, left: targetLeft } = getIndicatorLeft(currentTrack, nextX);
        const currentLeft =
          indicatorPosition.current ??
          Math.min(maxLeft, Math.max(0, DEFAULT_BOTTOM_TABS.indexOf(activeTab) * (indicatorWidth + 4)));
        const distance = targetLeft - currentLeft;
        const nextLeft = Math.abs(distance) < 0.5 ? targetLeft : currentLeft + distance * 0.32;
        indicatorPosition.current = nextLeft;
        currentIndicator.style.transform = `translate3d(${nextLeft}px,0,0)`;
        if (Math.abs(targetLeft - nextLeft) >= 0.5)
          indicatorFrame.current = window.requestAnimationFrame(animateIndicator);
      };
      indicatorFrame.current = window.requestAnimationFrame(animateIndicator);
    },
    [activeTab, clearIndicatorOverride],
  );

  function beginHold(event: ReactPointerEvent<HTMLButtonElement>, id: BottomTabId) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const pointerType = event.pointerType;
    const startX = event.clientX;
    const startY = event.clientY;
    cancelHold();
    updateIndicatorPosition(null);
    holdTriggered.current = false;
    dragActive.current = false;
    dragMoved.current = false;
    dragId.current = id;
    pointerId.current = event.pointerId;
    holdStart.current = { x: startX, y: startY };
    holdTimer.current = window.setTimeout(() => {
      dragArmed.current = true;
      holdTimer.current = null;
      dragTarget.current = id;
      updateIndicatorPosition(startX);
      setDragTargetTab(id);
      setDraggingTab(id);
      if (pointerType !== "mouse") hapticSelectionStart();
    }, BOTTOM_TAB_HOLD_MS);
  }

  const getTabCenter = useCallback((id: BottomTabId): number | null => {
    const button = trackRef.current?.querySelector<HTMLElement>(`[data-bottom-tab-id="${id}"]`);
    if (!button) return null;
    const rect = button.getBoundingClientRect();
    return rect.left + rect.width / 2;
  }, []);

  const getNearestTab = useCallback(
    (x: number): BottomTabId | null => {
      let nearest: BottomTabId | null = null;
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (const id of DEFAULT_BOTTOM_TABS) {
        const center = getTabCenter(id);
        if (center === null) continue;
        const distance = Math.abs(x - center);
        if (distance < nearestDistance) {
          nearest = id;
          nearestDistance = distance;
        }
      }
      return nearest;
    },
    [getTabCenter],
  );

  const updateDragTarget = useCallback(
    (x: number) => {
      const targetId = getNearestTab(x);
      const currentId = dragTarget.current;
      if (!targetId || currentId === targetId) return;
      if (currentId) {
        const currentCenter = getTabCenter(currentId);
        const targetCenter = getTabCenter(targetId);
        if (
          currentCenter !== null &&
          targetCenter !== null &&
          Math.abs(x - targetCenter) + BOTTOM_TAB_SWITCH_HYSTERESIS >= Math.abs(x - currentCenter)
        )
          return;
      }
      dragTarget.current = targetId;
      setDragTargetTab(targetId);
      hapticSelectionChanged();
    },
    [getNearestTab, getTabCenter],
  );

  const movePointer = useCallback(
    (event: PointerEvent) => {
      const start = holdStart.current;
      const id = dragId.current;
      if (!start || !id || pointerId.current !== event.pointerId) return;
      const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      if (!dragActive.current && !dragArmed.current) {
        if (distance > BOTTOM_TAB_CANCEL_DISTANCE) cancelHold();
        return;
      }
      if (!dragActive.current && dragArmed.current && distance > BOTTOM_TAB_DRAG_START_DISTANCE) {
        dragActive.current = true;
        dragMoved.current = true;
        holdTriggered.current = true;
        setDraggingTab(id);
      }
      if (dragActive.current) {
        event.preventDefault();
        updateIndicatorPosition(event.clientX);
        updateDragTarget(event.clientX);
      }
    },
    [cancelHold, updateDragTarget, updateIndicatorPosition],
  );

  const finishGesture = useCallback(
    (x: number) => {
      const activeDrag = dragActive.current;
      const moved = dragMoved.current;
      const pressedId = dragId.current;
      const targetId = activeDrag ? (getNearestTab(x) ?? dragTarget.current) : null;
      cancelHold();
      dragActive.current = false;
      dragMoved.current = false;
      dragId.current = null;
      pointerId.current = null;
      dragTarget.current = null;
      hapticSelectionEnd();
      setDraggingTab(null);
      setDragTargetTab(null);
      updateIndicatorPosition(null);
      if (activeDrag || moved) {
        holdTriggered.current = true;
        if (targetId) onNavigate(targetId);
        else haptic(6);
      } else if (pressedId) {
        // Resolve a normal tap on pointer-up so rapid tab changes do not wait
        // for a delayed synthetic click or get swallowed by touch heuristics.
        holdTriggered.current = true;
        onNavigate(pressedId);
      }
    },
    [cancelHold, getNearestTab, onNavigate, updateIndicatorPosition],
  );

  const finishPointer = useCallback(
    (event: PointerEvent) => {
      if (pointerId.current !== event.pointerId) return;
      finishGesture(event.clientX);
    },
    [finishGesture],
  );

  const cancelPointer = useCallback(() => {
    const wasDragging = dragActive.current || dragMoved.current;
    cancelHold();
    dragActive.current = false;
    dragMoved.current = false;
    dragId.current = null;
    pointerId.current = null;
    dragTarget.current = null;
    setDraggingTab(null);
    setDragTargetTab(null);
    updateIndicatorPosition(null);
    if (wasDragging) holdTriggered.current = true;
  }, [cancelHold, updateIndicatorPosition]);

  useEffect(() => {
    pointerMoveRef.current = movePointer;
    pointerUpRef.current = finishPointer;
  }, [finishPointer, movePointer]);
  useEffect(() => {
    cancelPointerRef.current = cancelPointer;
  }, [cancelPointer]);

  useEffect(() => {
    const move = (event: PointerEvent) => pointerMoveRef.current(event);
    const finish = (event: PointerEvent) => pointerUpRef.current(event);
    const cancel = () => {
      if (dragId.current) cancelPointerRef.current();
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", cancel);
      cancelHold();
      if (indicatorFrame.current !== null) window.cancelAnimationFrame(indicatorFrame.current);
      indicatorPendingX.current = null;
      indicatorPosition.current = null;
      clearIndicatorOverride();
    };
  }, [cancelHold, clearIndicatorOverride]);

  return {
    draggingTab,
    highlightedTab: dragTargetTab ?? activeTab,
    indicatorIndex: DEFAULT_BOTTOM_TABS.indexOf(activeTab),
    trackRef,
    holdTriggered,
    beginHold,
    cancelPointer,
  };
}
