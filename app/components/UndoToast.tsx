"use client";

import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties, PointerEventHandler } from "react";
import { applyAnimatedStyles } from "../domMotion";
import { TRACK_TIMING } from "../trackConstants";
import type { UndoNotice } from "../trackTypes";

type UndoToastProps = {
  notice: UndoNotice;
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  dragX: number;
  dragging: boolean;
  dismissDirection: -1 | 0 | 1;
  onPointerDown: PointerEventHandler<HTMLDivElement>;
  onPointerMove: PointerEventHandler<HTMLDivElement>;
  onPointerUp: PointerEventHandler<HTMLDivElement>;
  onPointerCancel: PointerEventHandler<HTMLDivElement>;
  onUndo: () => void;
};

export function UndoToast({
  notice,
  sidebarCollapsed,
  mobileSidebarOpen,
  dragX,
  dragging,
  dismissDirection,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onUndo,
}: UndoToastProps) {
  const positionerRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    applyAnimatedStyles(positionerRef.current, { "--undo-drag-x": `${dragX}px` }, dragging ? 0 : 120);
  }, [dragX, dragging]);

  if (!globalThis.document) return null;
  const positionerClassName = [
    "undo-toast-positioner",
    sidebarCollapsed ? "is-sidebar-collapsed" : "",
    mobileSidebarOpen ? "is-mobile-sidebar-open" : "",
    dragging ? "is-dragging" : "",
    dismissDirection < 0 ? "dismiss-left" : dismissDirection > 0 ? "dismiss-right" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const undoStyle: CSSProperties & { "--undo-duration": string } = {
    "--undo-duration": `${TRACK_TIMING.undoNoticeDurationMs}ms`,
  };
  const positionerStyle: CSSProperties & { "--undo-dismiss-duration": string } = {
    "--undo-dismiss-duration": `${TRACK_TIMING.undoDismissMs}ms`,
  };
  return createPortal(
    <div ref={positionerRef} className={positionerClassName} style={positionerStyle}>
      <div
        className="undo-toast"
        style={undoStyle}
        role="status"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <span className="undo-toast-icon" aria-hidden="true">
          <i />
        </span>
        <span className="undo-toast-message">{notice.message}</span>
        <button type="button" onClick={onUndo}>
          Undo
        </button>
      </div>
    </div>,
    globalThis.document.body,
  );
}
