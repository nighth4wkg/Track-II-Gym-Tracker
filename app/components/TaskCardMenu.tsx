import type { RefObject } from "react";
import { createPortal } from "react-dom";
import type { ProgressionCoach } from "../taskCardUtils";

type MenuPosition = { top: number; left: number };

type TaskCardMenuProps = {
  menuOpen: boolean;
  menuPosition: MenuPosition | null;
  menuRef: RefObject<HTMLDivElement | null>;
  completionEnabled: boolean;
  taskDone: boolean;
  coachOpen: boolean;
  progressionCoach: ProgressionCoach | null;
  onStartEdit: () => void;
  onToggleCoach: () => void;
  onToggleDone: () => void;
  onDelete: () => void;
};

export function TaskCardMenu({
  menuOpen,
  menuPosition,
  menuRef,
  completionEnabled,
  taskDone,
  coachOpen,
  progressionCoach,
  onStartEdit,
  onToggleCoach,
  onToggleDone,
  onDelete,
}: TaskCardMenuProps) {
  if (!menuOpen || !menuPosition || !globalThis.document) return null;
  return createPortal(
    <div
      ref={menuRef}
      className="mobile-exercise-menu exercise-menu-portal"
      style={{ top: menuPosition.top, left: menuPosition.left }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button type="button" onClick={onStartEdit}>
        Edit name
      </button>
      <button
        type="button"
        className="coach-menu-item"
        onClick={onToggleCoach}
        disabled={!progressionCoach}
        title={progressionCoach ? undefined : "Log a completed set first"}
      >
        {coachOpen ? "Hide smart coach" : "Smart coach"}
      </button>
      {completionEnabled && (
        <button type="button" onClick={onToggleDone}>
          {taskDone ? "Mark not done" : "Mark complete"}
        </button>
      )}
      <button type="button" className="danger" onClick={onDelete}>
        Delete exercise
      </button>
    </div>,
    document.body,
  );
}
