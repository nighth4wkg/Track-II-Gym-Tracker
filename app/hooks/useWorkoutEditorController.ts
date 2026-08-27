"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type RefObject,
  type SetStateAction,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { haptic } from "../haptics";
import { hasTouchList, convertSetUnit, normalizeWeightInputOnBlur, sanitizeDecimalInput } from "../trackUtils";
import { TRACK_INTERACTION } from "../trackConstants";
import type { Checklist, SetEntry, Task, WeightUnit } from "../trackTypes";
import { buildLatestExerciseProgressPlan } from "../exerciseProgress";

type WorkoutEditorControllerOptions = {
  activeId: string;
  lists: Checklist[];
  tasks: Task[];
  dragging: string | null;
  savedSplitsRef: RefObject<Set<string>>;
  setLists: Dispatch<SetStateAction<Checklist[]>>;
  setDirtySplits: Dispatch<SetStateAction<Set<string>>>;
  setSavedSplits: Dispatch<SetStateAction<Set<string>>>;
  setWorkoutActionsExiting: Dispatch<SetStateAction<boolean>>;
  setDragging: Dispatch<SetStateAction<string | null>>;
  setEditing: Dispatch<SetStateAction<string | null>>;
  setMobileExerciseMenu: Dispatch<SetStateAction<string | null>>;
  setDefaultUnit: Dispatch<SetStateAction<WeightUnit>>;
  offerUndo: (message: string, undo: () => void) => void;
};

export function useWorkoutEditorController({
  activeId,
  lists,
  tasks,
  dragging,
  savedSplitsRef,
  setLists,
  setDirtySplits,
  setSavedSplits,
  setWorkoutActionsExiting,
  setDragging,
  setEditing,
  setMobileExerciseMenu,
  setDefaultUnit,
  offerUndo,
}: WorkoutEditorControllerOptions) {
  const weightBeforeEdit = useRef<Record<string, string>>({});
  const dragHoldTimer = useRef<number | null>(null);
  const dragAutoScrollFrame = useRef<number | null>(null);
  const updateDraggedTargetRef = useRef<(y: number) => void>(() => undefined);
  const startDraggedAutoScrollRef = useRef<() => void>(() => undefined);
  const autoScrollDraggedExerciseRef = useRef<() => void>(() => undefined);
  const dragPointerTarget = useRef<HTMLElement | null>(null);
  const dragPointerId = useRef<number | null>(null);
  const dragPointerPosition = useRef({ x: 0, y: 0 });
  const pendingDrag = useRef<{ id: string; x: number; y: number } | null>(null);
  const draggingTaskId = useRef<string | null>(null);

  const updateTasks = useCallback(
    (change: (current: Task[]) => Task[], marksWorkoutChanged = true) => {
      setWorkoutActionsExiting(false);
      if (marksWorkoutChanged) {
        setDirtySplits((current) => {
          if (current.has(activeId)) return current;
          const next = new Set(current);
          next.add(activeId);
          return next;
        });
        setSavedSplits((current) => {
          if (!current.has(activeId)) return current;
          const next = new Set(current);
          next.delete(activeId);
          savedSplitsRef.current = next;
          return next;
        });
      }
      setLists((current) =>
        current.map((list) => {
          if (list.id !== activeId) return list;
          return marksWorkoutChanged
            ? { ...list, tasks: change(list.tasks), updatedAt: Date.now() }
            : { ...list, tasks: change(list.tasks) };
        }),
      );
    },
    [activeId, savedSplitsRef, setDirtySplits, setLists, setSavedSplits, setWorkoutActionsExiting],
  );

  const moveTask = useCallback(
    (overId: string, placeAfter = false) => {
      const draggedId = draggingTaskId.current ?? dragging;
      if (!draggedId || draggedId === overId) return;
      updateTasks((current) => {
        const from = current.findIndex((task) => task.id === draggedId);
        const to = current.findIndex((task) => task.id === overId);
        if (from < 0 || to < 0) return current;
        const next = [...current];
        const [moved] = next.splice(from, 1);
        let destination = to + (placeAfter ? 1 : 0);
        if (from < destination) destination -= 1;
        if (destination === from) return current;
        next.splice(destination, 0, moved);
        return next;
      });
    },
    [dragging, updateTasks],
  );

  const updateDraggedTarget = useCallback(
    (y: number) => {
      const draggedId = draggingTaskId.current ?? dragging;
      if (!draggedId) return;
      const cards = [...document.querySelectorAll<HTMLElement>("[data-task-id]")]
        .filter((card) => card.dataset.taskId !== draggedId)
        .map((card) => ({ card, rect: card.getBoundingClientRect() }))
        .sort((left, right) => left.rect.top - right.rect.top);
      if (!cards.length) return;

      // Always resolve against the current DOM order. Choosing the first card
      // whose midpoint is below the pointer lets one uninterrupted hold pass
      // through every card, including the first and last positions, even while
      // React re-renders the list after each move.
      let target = cards[cards.length - 1];
      let placeAfter = true;
      for (const entry of cards) {
        if (y < entry.rect.top + entry.rect.height / 2) {
          target = entry;
          placeAfter = false;
          break;
        }
      }
      if (target.card.dataset.taskId) moveTask(target.card.dataset.taskId, placeAfter);
    },
    [dragging, moveTask],
  );

  const autoScrollDraggedExercise = useCallback(() => {
    if (!draggingTaskId.current) {
      dragAutoScrollFrame.current = null;
      return;
    }
    const { y } = dragPointerPosition.current;
    const visualViewport = window.visualViewport;
    const viewportTop = visualViewport?.offsetTop ?? 0;
    const viewportHeight = visualViewport?.height ?? window.innerHeight;
    const viewportBottom = viewportTop + viewportHeight;
    const edge = Math.min(
      TRACK_INTERACTION.dragAutoScrollMaxEdge,
      Math.max(TRACK_INTERACTION.dragAutoScrollMinEdge, viewportHeight * TRACK_INTERACTION.dragAutoScrollViewportRatio),
    );
    const distanceFromTop = y - viewportTop;
    const distanceFromBottom = viewportBottom - y;
    let delta = 0;
    if (distanceFromTop < edge) {
      const strength = Math.max(0, Math.min(1, (edge - distanceFromTop) / edge));
      delta = -(4 + Math.ceil(30 * strength * strength));
    } else if (distanceFromBottom < edge) {
      const strength = Math.max(0, Math.min(1, (edge - distanceFromBottom) / edge));
      delta = 4 + Math.ceil(30 * strength * strength);
    }
    if (delta !== 0) {
      const scrollingElement = document.scrollingElement ?? document.documentElement;
      const maxScroll = Math.max(0, scrollingElement.scrollHeight - viewportHeight);
      const currentScroll = window.scrollY || scrollingElement.scrollTop || document.body.scrollTop;
      const nextScroll = Math.max(0, Math.min(maxScroll, currentScroll + delta));
      window.scrollTo(0, nextScroll);
      updateDraggedTargetRef.current(y);
    }
    dragAutoScrollFrame.current = window.requestAnimationFrame(() => autoScrollDraggedExerciseRef.current());
  }, []);

  const startDraggedAutoScroll = useCallback(() => {
    if (dragAutoScrollFrame.current === null)
      dragAutoScrollFrame.current = window.requestAnimationFrame(() => autoScrollDraggedExerciseRef.current());
  }, []);

  useEffect(() => {
    updateDraggedTargetRef.current = updateDraggedTarget;
    startDraggedAutoScrollRef.current = startDraggedAutoScroll;
    autoScrollDraggedExerciseRef.current = autoScrollDraggedExercise;
  }, [autoScrollDraggedExercise, startDraggedAutoScroll, updateDraggedTarget]);

  const stopActiveDrag = useCallback(() => {
    if (dragHoldTimer.current !== null) window.clearTimeout(dragHoldTimer.current);
    dragHoldTimer.current = null;
    if (dragAutoScrollFrame.current !== null) window.cancelAnimationFrame(dragAutoScrollFrame.current);
    dragAutoScrollFrame.current = null;
    pendingDrag.current = null;
    draggingTaskId.current = null;
    dragPointerId.current = null;
    dragPointerTarget.current = null;
    document.documentElement.classList.remove("dragging-task-active");
    setDragging(null);
  }, [setDragging]);

  useEffect(() => {
    const stop = (event?: Event) => {
      // Some mobile browsers cancel the pointer stream when a touch gesture
      // changes direction. The touch handlers remain the source of truth for
      // an active long-press drag, so let touchend/touchcancel finish it.
      const pointerType = event && "pointerType" in event ? String(event.pointerType) : "";
      if (pointerType === "touch" && draggingTaskId.current) return;
      stopActiveDrag();
    };
    const visibility = () => {
      if (document.hidden) stop();
    };
    const lockTouchScroll = (rawEvent: Event) => {
      if (!draggingTaskId.current) return;
      if (!hasTouchList(rawEvent)) return;
      const event = rawEvent;
      if (event.touches.length !== 1) return;
      rawEvent.preventDefault();
      const touch = event.touches[0];
      dragPointerPosition.current = { x: touch.clientX, y: touch.clientY };
      updateDraggedTargetRef.current(touch.clientY);
      startDraggedAutoScrollRef.current();
    };
    const lockWheelScroll = (event: WheelEvent) => {
      if (draggingTaskId.current) event.preventDefault();
    };
    const movePointer = (event: PointerEvent) => {
      if (event.pointerType === "touch" || !draggingTaskId.current) return;
      if (dragPointerId.current !== null && event.pointerId !== dragPointerId.current) return;
      event.preventDefault();
      dragPointerPosition.current = { x: event.clientX, y: event.clientY };
      updateDraggedTargetRef.current(event.clientY);
      startDraggedAutoScrollRef.current();
    };
    const endTouch = () => {
      if (draggingTaskId.current || pendingDrag.current) stopActiveDrag();
    };
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    window.addEventListener("pointermove", movePointer, { passive: false });
    window.addEventListener("dragend", stop);
    window.addEventListener("drop", stop);
    window.addEventListener("blur", stop);
    document.addEventListener("touchmove", lockTouchScroll, { passive: false, capture: true });
    document.addEventListener("touchend", endTouch, { capture: true });
    document.addEventListener("touchcancel", endTouch, { capture: true });
    document.addEventListener("wheel", lockWheelScroll, { passive: false, capture: true });
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      window.removeEventListener("pointermove", movePointer);
      window.removeEventListener("dragend", stop);
      window.removeEventListener("drop", stop);
      window.removeEventListener("blur", stop);
      document.removeEventListener("touchmove", lockTouchScroll, true);
      document.removeEventListener("touchend", endTouch, true);
      document.removeEventListener("touchcancel", endTouch, true);
      document.removeEventListener("wheel", lockWheelScroll, true);
      document.removeEventListener("visibilitychange", visibility);
      stopActiveDrag();
    };
  }, [stopActiveDrag]);

  function moveTaskFromPointer(event: ReactPointerEvent) {
    if (event.pointerType === "touch") return;
    const pending = pendingDrag.current;
    if (
      !draggingTaskId.current &&
      pending &&
      Math.hypot(event.clientX - pending.x, event.clientY - pending.y) > TRACK_INTERACTION.dragMovementThreshold
    ) {
      if (dragHoldTimer.current !== null) window.clearTimeout(dragHoldTimer.current);
      dragHoldTimer.current = null;
      pendingDrag.current = null;
    }
    if (!draggingTaskId.current) return;
    dragPointerPosition.current = { x: event.clientX, y: event.clientY };
    event.preventDefault();
    updateDraggedTarget(event.clientY);
    startDraggedAutoScroll();
  }

  function beginPointerDrag(event: ReactPointerEvent<HTMLElement>, id: string) {
    if (event.pointerType === "touch") return;
    dragPointerTarget.current = event.currentTarget;
    dragPointerId.current = event.pointerId;
    dragPointerPosition.current = { x: event.clientX, y: event.clientY };
    pendingDrag.current = { id, x: event.clientX, y: event.clientY };
    if (dragHoldTimer.current !== null) window.clearTimeout(dragHoldTimer.current);
    dragHoldTimer.current = window.setTimeout(() => {
      draggingTaskId.current = id;
      setDragging(id);
      dragHoldTimer.current = null;
      pendingDrag.current = null;
      document.documentElement.classList.add("dragging-task-active");
      startDraggedAutoScroll();
    }, TRACK_INTERACTION.dragPointerHoldMs);
  }

  function beginCardPointerDrag(event: ReactPointerEvent<HTMLElement>, id: string) {
    if (event.pointerType === "touch") return;
    if (!(event.target instanceof Element)) return;
    const target = event.target;
    if (target.closest('button, input, textarea, select, a, [contenteditable="true"], .mobile-exercise-menu')) return;
    beginPointerDrag(event, id);
  }

  function beginTouchDrag(event: ReactTouchEvent<HTMLElement>, id: string) {
    if (event.touches.length !== 1) return;
    if (!(event.target instanceof Element)) return;
    const target = event.target;
    if (target.closest('button, input, textarea, select, a, [contenteditable="true"], .mobile-exercise-menu')) return;
    const touch = event.touches[0];
    const card = event.currentTarget;
    if (dragHoldTimer.current !== null) window.clearTimeout(dragHoldTimer.current);
    pendingDrag.current = { id, x: touch.clientX, y: touch.clientY };
    dragPointerTarget.current = card;
    dragPointerPosition.current = { x: touch.clientX, y: touch.clientY };
    dragHoldTimer.current = window.setTimeout(() => {
      if (!pendingDrag.current || pendingDrag.current.id !== id) return;
      draggingTaskId.current = id;
      pendingDrag.current = null;
      dragHoldTimer.current = null;
      document.documentElement.classList.add("dragging-task-active");
      setDragging(id);
      startDraggedAutoScroll();
    }, TRACK_INTERACTION.dragTouchHoldMs);
  }

  function moveTouchDrag(event: ReactTouchEvent) {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    const pending = pendingDrag.current;
    if (
      !draggingTaskId.current &&
      pending &&
      Math.hypot(touch.clientX - pending.x, touch.clientY - pending.y) > TRACK_INTERACTION.dragMovementThreshold
    ) {
      if (dragHoldTimer.current !== null) window.clearTimeout(dragHoldTimer.current);
      dragHoldTimer.current = null;
      pendingDrag.current = null;
      return;
    }
    if (!draggingTaskId.current) return;
    event.preventDefault();
    dragPointerPosition.current = { x: touch.clientX, y: touch.clientY };
    updateDraggedTarget(touch.clientY);
    startDraggedAutoScroll();
  }

  function endTouchDrag() {
    if (draggingTaskId.current || pendingDrag.current) stopActiveDrag();
  }

  function endPointerDrag() {
    stopActiveDrag();
  }

  function saveEdit(id: string, editValue: string) {
    const text = editValue.trim();
    const previous = tasks.find((task) => task.id === id);
    if (text && previous && previous.text !== text) {
      updateTasks((current) => current.map((task) => (task.id === id ? { ...task, text } : task)));
      offerUndo("Exercise renamed", () =>
        updateTasks((current) => current.map((task) => (task.id === id ? { ...task, text: previous.text } : task))),
      );
    }
    setEditing(null);
  }

  function toggleDone(id: string) {
    haptic(18);
    updateTasks((current) =>
      current.map((task) => (task.id === id ? { ...task, done: !task.done, collapsed: !task.done } : task)),
    );
  }

  function toggleCard(id: string) {
    haptic(8);
    updateTasks(
      (current) => current.map((task) => (task.id === id ? { ...task, collapsed: !task.collapsed } : task)),
      false,
    );
  }

  function updateSet(taskId: string, setId: string, field: "weight" | "reps" | "rir", input: string) {
    const cleaned =
      field === "weight"
        ? sanitizeDecimalInput(input, TRACK_INTERACTION.maxSetWeightChars)
        : input.replace(/\D/g, "").slice(0, TRACK_INTERACTION.maxSetCountChars);
    const nextValue =
      cleaned === ""
        ? ""
        : field === "weight"
          ? cleaned
          : String(Math.min(TRACK_INTERACTION.maxRepsOrRir, Number(cleaned)));
    updateTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? { ...task, sets: (task.sets ?? []).map((set) => (set.id === setId ? { ...set, [field]: nextValue } : set)) }
          : task,
      ),
    );
  }

  function addSet(taskId: string) {
    updateTasks((current) =>
      current.map((task) => {
        if (task.id !== taskId) return task;
        const previous = task.sets?.at(-1);
        const next: SetEntry = {
          id: crypto.randomUUID(),
          weight: previous?.weight ?? "0",
          unit: previous?.unit ?? "kg",
          reps: previous?.reps ?? "1",
          rir: previous?.rir ?? "0",
        };
        return { ...task, sets: [...(task.sets ?? []), next] };
      }),
    );
  }

  function removeSet(taskId: string, setId: string) {
    const task = tasks.find((item) => item.id === taskId);
    const setIndex = task?.sets?.findIndex((set) => set.id === setId) ?? -1;
    const removedSet = setIndex >= 0 ? task?.sets?.[setIndex] : undefined;
    if (!removedSet || (task?.sets?.length ?? 0) <= 1) return;
    updateTasks((current) =>
      current.map((task) =>
        task.id === taskId && (task.sets?.length ?? 0) > 1
          ? { ...task, sets: task.sets?.filter((set) => set.id !== setId) }
          : task,
      ),
    );
    offerUndo("Set deleted", () =>
      updateTasks((current) =>
        current.map((item) => {
          if (item.id !== taskId || item.sets?.some((set) => set.id === setId)) return item;
          const nextSets = [...(item.sets ?? [])];
          nextSets.splice(Math.min(setIndex, nextSets.length), 0, removedSet);
          return { ...item, sets: nextSets };
        }),
      ),
    );
  }

  function removeExercise(taskId: string) {
    const taskIndex = tasks.findIndex((item) => item.id === taskId);
    const removedTask = taskIndex >= 0 ? tasks[taskIndex] : undefined;
    if (!removedTask) return;
    updateTasks((current) => current.filter((item) => item.id !== taskId));
    setMobileExerciseMenu(null);
    offerUndo("Exercise deleted", () =>
      updateTasks((current) => {
        if (current.some((item) => item.id === taskId)) return current;
        const next = [...current];
        next.splice(Math.min(taskIndex, next.length), 0, removedTask);
        return next;
      }),
    );
  }

  function toggleSetUnit(taskId: string, setId: string) {
    updateTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? {
              ...task,
              sets: (task.sets ?? []).map((set) =>
                set.id === setId ? convertSetUnit(set, set.unit === "kg" ? "lb" : "kg") : set,
              ),
            }
          : task,
      ),
    );
  }

  function applyGlobalUnit(unit: WeightUnit) {
    setDefaultUnit(unit);
    savedSplitsRef.current = new Set<string>();
    setSavedSplits(new Set<string>());
    setWorkoutActionsExiting(false);
    const changedSplitIds = lists
      .filter((list) => list.tasks.some((task) => (task.sets ?? []).some((set) => set.unit !== unit)))
      .map((list) => list.id);
    if (changedSplitIds.length) setDirtySplits((current) => new Set([...current, ...changedSplitIds]));
    setLists((current) =>
      current.map((list) => {
        const tasks = list.tasks.map((task) => ({
          ...task,
          sets: (task.sets ?? []).map((set) => convertSetUnit(set, unit)),
        }));
        return changedSplitIds.includes(list.id) ? { ...list, updatedAt: Date.now(), tasks } : list;
      }),
    );
  }

  function applyExerciseUnit(taskId: string, unit: WeightUnit) {
    updateTasks((current) =>
      current.map((task) =>
        task.id === taskId ? { ...task, sets: (task.sets ?? []).map((set) => convertSetUnit(set, unit)) } : task,
      ),
    );
  }

  function syncLatestProgressAcrossSplits() {
    const plan = buildLatestExerciseProgressPlan(lists);
    if (!plan.changedSplitIds.length) return plan;
    const changedIds = new Set(plan.changedSplitIds);
    const previousLists = new Map(lists.filter((list) => changedIds.has(list.id)).map((list) => [list.id, list]));
    savedSplitsRef.current = new Set([...savedSplitsRef.current].filter((id) => !changedIds.has(id)));
    setSavedSplits(new Set(savedSplitsRef.current));
    setDirtySplits((current) => new Set([...current, ...plan.changedSplitIds]));
    setWorkoutActionsExiting(false);
    setLists(plan.nextLists);
    offerUndo(`Synced ${plan.exerciseCount} ${plan.exerciseCount === 1 ? "exercise" : "exercises"}`, () => {
      const restoredAt = Date.now();
      setLists((current) =>
        current.map((list) => {
          const previous = previousLists.get(list.id);
          return previous ? { ...previous, updatedAt: restoredAt } : list;
        }),
      );
      setDirtySplits((current) => new Set([...current, ...plan.changedSplitIds]));
    });
    return plan;
  }

  function beginSetWeightEdit(taskId: string, set: SetEntry, input: HTMLInputElement) {
    const key = `${taskId}:${set.id}`;
    if (Number(set.weight) > 0) weightBeforeEdit.current[key] = set.weight;
    else if (set.lastWeight && set.lastWeight > 0) weightBeforeEdit.current[key] = String(set.lastWeight);
    input.select();
  }

  function finishSetWeightEdit(taskId: string, set: SetEntry) {
    const normalized = normalizeWeightInputOnBlur(set.weight);
    if (normalized === null || Number(normalized) === 0) {
      const previous =
        weightBeforeEdit.current[`${taskId}:${set.id}`] ||
        (set.lastWeight && set.lastWeight > 0 ? String(set.lastWeight) : "");
      updateSet(taskId, set.id, "weight", previous || "0");
      return;
    }
    if (normalized !== set.weight) updateSet(taskId, set.id, "weight", normalized);
  }

  return {
    updateTasks,
    moveTask,
    moveTaskFromPointer,
    beginCardPointerDrag,
    beginTouchDrag,
    moveTouchDrag,
    endTouchDrag,
    endPointerDrag,
    saveEdit,
    toggleDone,
    toggleCard,
    updateSet,
    addSet,
    removeSet,
    removeExercise,
    toggleSetUnit,
    applyGlobalUnit,
    applyExerciseUnit,
    syncLatestProgressAcrossSplits,
    beginSetWeightEdit,
    finishSetWeightEdit,
  };
}
