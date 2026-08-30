"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Task } from "../trackTypes";
import { ConnectedTaskCard } from "./TaskCard";

const VIRTUALIZE_AFTER = 40;
const ESTIMATED_CARD_HEIGHT = 240;
const OVERSCAN_CARDS = 5;

type VirtualizedTaskListProps = {
  tasks: Task[];
  progressFading: boolean;
  draggingTaskId: string | null;
  showDeleteGestureHint: boolean;
  onDeleteGestureRevealed: () => void;
};

type Range = { start: number; end: number };

function taskMarginBottom(element: HTMLElement) {
  const margin = Number.parseFloat(window.getComputedStyle(element).marginBottom);
  return Number.isFinite(margin) ? margin : 0;
}

export function VirtualizedTaskList({
  tasks,
  progressFading,
  draggingTaskId,
  showDeleteGestureHint,
  onDeleteGestureRevealed,
}: VirtualizedTaskListProps) {
  const virtualized = tasks.length > VIRTUALIZE_AFTER && !draggingTaskId;
  const listRef = useRef<HTMLDivElement>(null);
  const [measuredHeights, setMeasuredHeights] = useState<Record<string, number>>({});
  const [range, setRange] = useState<Range>({ start: 0, end: Math.min(tasks.length, OVERSCAN_CARDS * 2 + 1) });

  const offsets = useMemo(() => {
    const next: number[] = [];
    let offset = 0;
    for (const task of tasks) {
      next.push(offset);
      offset += measuredHeights[task.id] ?? ESTIMATED_CARD_HEIGHT;
    }
    return { values: next, total: offset };
  }, [measuredHeights, tasks]);

  useLayoutEffect(() => {
    if (!virtualized) return undefined;
    const updateRange = () => {
      const list = listRef.current;
      if (!list) return;
      const listTop = list.getBoundingClientRect().top + window.scrollY;
      const viewportTop = Math.max(0, window.scrollY - listTop - OVERSCAN_CARDS * ESTIMATED_CARD_HEIGHT);
      const viewportBottom = window.scrollY - listTop + window.innerHeight + OVERSCAN_CARDS * ESTIMATED_CARD_HEIGHT;
      let start = 0;
      while (start < offsets.values.length - 1 && offsets.values[start + 1] < viewportTop) start += 1;
      let end = start;
      while (end < offsets.values.length && offsets.values[end] < viewportBottom) end += 1;
      const next = { start, end: Math.max(start + 1, end) };
      setRange((current) => (current.start === next.start && current.end === next.end ? current : next));
    };
    updateRange();
    let frame = 0;
    const onScrollOrResize = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        updateRange();
      });
    };
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [offsets.values, virtualized]);

  useLayoutEffect(() => {
    if (!virtualized || !globalThis.ResizeObserver) return undefined;
    const list = listRef.current;
    if (!list) return undefined;
    const observer = new ResizeObserver((entries) => {
      setMeasuredHeights((current) => {
        let changed = false;
        const next = { ...current };
        for (const entry of entries) {
          const element = entry.target;
          if (!(element instanceof HTMLElement)) continue;
          const taskId = element.dataset.virtualTaskId;
          if (!taskId) continue;
          const height = Math.ceil(entry.contentRect.height + taskMarginBottom(element));
          if (height > 0 && next[taskId] !== height) {
            next[taskId] = height;
            changed = true;
          }
        }
        return changed ? next : current;
      });
    });
    list.querySelectorAll<HTMLElement>("[data-virtual-task-id]").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [range, tasks, virtualized]);

  if (!virtualized) {
    return (
      <div className={progressFading ? "task-list progress-fading" : "task-list"} aria-live="polite">
        {tasks.map((task, index) => (
          <ConnectedTaskCard
            key={task.id}
            task={task}
            showDeleteGestureHint={showDeleteGestureHint && index === 0}
            onDeleteGestureRevealed={onDeleteGestureRevealed}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      className={progressFading ? "task-list task-list-virtualized progress-fading" : "task-list task-list-virtualized"}
      style={{ height: offsets.total }}
      aria-live="polite"
      aria-label={`${tasks.length} exercises`}
    >
      {tasks.slice(range.start, range.end).map((task, visibleIndex) => {
        const index = range.start + visibleIndex;
        return (
          <div
            key={task.id}
            className="task-list-virtualized-item"
            data-virtual-task-id={task.id}
            style={{ top: offsets.values[index] ?? 0 }}
          >
            <ConnectedTaskCard
              task={task}
              showDeleteGestureHint={showDeleteGestureHint && index === 0}
              onDeleteGestureRevealed={onDeleteGestureRevealed}
            />
          </div>
        );
      })}
    </div>
  );
}
