"use client";

import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { syncStatusTone } from "../trackUtils";
import { SYNC_PHASE_LABELS, syncPhaseForLabel } from "../syncHealth";

type SyncStatusIndicatorProps = {
  label: string;
  lastSuccessfulSyncAt: number | null;
  onRetry: () => void;
  queuedCount?: number;
  stuckCount?: number;
  compact?: boolean;
};

function formatSyncTime(timestamp: number | null) {
  if (!timestamp) return "Not synced yet";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(timestamp);
}

type SyncPopoverPosition = { top: number; left: number };

export function SyncStatusIndicator({
  label,
  lastSuccessfulSyncAt,
  onRetry,
  queuedCount = 0,
  stuckCount = 0,
  compact = false,
}: SyncStatusIndicatorProps) {
  const [open, setOpen] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<SyncPopoverPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const phase = syncPhaseForLabel(label);
  const tone = syncStatusTone(label);
  const phaseLabel = SYNC_PHASE_LABELS[phase];
  const conflictVisible = /conflict|review changes/i.test(label);
  const storageVisible = /storage|full/i.test(label);

  useEffect(() => {
    if (!open) return undefined;
    const dismiss = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (rootRef.current?.contains(event.target) || popoverRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", dismiss, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !globalThis.window || !globalThis.document) return undefined;

    const positionPopover = () => {
      const trigger = triggerRef.current;
      const popover = popoverRef.current;
      if (!trigger || !popover) return;

      const triggerRect = trigger.getBoundingClientRect();
      const visualViewport = window.visualViewport;
      const viewportWidth = visualViewport?.width ?? window.innerWidth;
      const viewportHeight = visualViewport?.height ?? window.innerHeight;
      const viewportPadding = 12;
      const gap = 8;
      const popoverRect = popover.getBoundingClientRect();
      const popoverWidth = Math.min(popoverRect.width || 288, Math.max(0, viewportWidth - viewportPadding * 2));
      const popoverHeight = Math.min(popoverRect.height || 280, Math.max(0, viewportHeight - viewportPadding * 2));
      const maxTop = Math.max(viewportPadding, viewportHeight - popoverHeight - viewportPadding);
      const aboveTop = triggerRect.top - popoverHeight - gap;
      const belowTop = triggerRect.bottom + gap;
      const top =
        aboveTop >= viewportPadding || belowTop > maxTop
          ? Math.max(viewportPadding, Math.min(aboveTop, maxTop))
          : belowTop;
      const maxLeft = Math.max(viewportPadding, viewportWidth - popoverWidth - viewportPadding);
      const left = Math.max(viewportPadding, Math.min(triggerRect.right - popoverWidth, maxLeft));

      setPopoverPosition((current) => (current?.top === top && current.left === left ? current : { top, left }));
    };

    const frame = window.requestAnimationFrame(positionPopover);
    window.addEventListener("resize", positionPopover);
    window.addEventListener("scroll", positionPopover, true);
    window.visualViewport?.addEventListener("resize", positionPopover);
    window.visualViewport?.addEventListener("scroll", positionPopover);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", positionPopover);
      window.removeEventListener("scroll", positionPopover, true);
      window.visualViewport?.removeEventListener("resize", positionPopover);
      window.visualViewport?.removeEventListener("scroll", positionPopover);
    };
  }, [conflictVisible, label, open, phase, storageVisible, queuedCount, stuckCount]);

  const popover =
    open && globalThis.document ? (
      <div
        ref={popoverRef}
        className="sync-health-popover"
        data-positioned={popoverPosition ? "true" : "false"}
        style={popoverPosition ? { top: popoverPosition.top, left: popoverPosition.left } : undefined}
        role="dialog"
        aria-label="Sync status details"
      >
        <div>
          <strong>{phaseLabel}</strong>
          <span>
            {phase === "offline"
              ? "Your changes are saved on this device and will retry when you are back online."
              : phase === "attention"
                ? storageVisible
                  ? "Offline storage is full or unavailable. Existing data was kept; clear device space, then retry the pending upload."
                  : stuckCount > 0
                    ? "A queued workout has reached the automatic retry limit. Review the error, then retry when ready."
                    : conflictVisible
                      ? "Changes from another device were merged safely. Review the split before retrying."
                      : "Your latest changes are still safe locally. Retry when your connection is ready."
                : phase === "syncing"
                  ? "Track II is saving the latest workout changes."
                  : "Your latest workout changes are saved to the cloud."}
          </span>
        </div>
        <div className="sync-health-meta">
          <span>Last successful sync</span>
          <time>{formatSyncTime(lastSuccessfulSyncAt)}</time>
        </div>
        {queuedCount > 0 && (
          <div className="sync-health-meta sync-health-queue">
            <span>Waiting to upload</span>
            <strong>
              {queuedCount} workout{queuedCount === 1 ? "" : "s"}
            </strong>
          </div>
        )}
        {stuckCount > 0 && (
          <div className="sync-health-meta sync-health-queue sync-health-stuck">
            <span>Paused items</span>
            <strong>
              {stuckCount} workout{stuckCount === 1 ? "" : "s"}
            </strong>
          </div>
        )}
        {(phase === "offline" || phase === "attention") && (
          <button
            type="button"
            className="sync-health-retry"
            onClick={() => {
              setOpen(false);
              onRetry();
            }}
          >
            Retry sync
          </button>
        )}
      </div>
    ) : null;

  return (
    <div
      ref={rootRef}
      className={`sync-health sync-health-${tone}${compact ? " is-compact" : ""}`}
      data-sync-phase={phase}
      data-sync-tone={tone}
    >
      <button
        type="button"
        ref={triggerRef}
        className="sync-health-trigger"
        onClick={() => {
          setPopoverPosition(null);
          setOpen((current) => !current);
        }}
        aria-expanded={open}
        aria-label={`${phaseLabel}. Last successful sync ${formatSyncTime(lastSuccessfulSyncAt)}.`}
        title={`${phaseLabel} · Last successful sync ${formatSyncTime(lastSuccessfulSyncAt)}`}
      >
        <i aria-hidden="true" />
        <span>{phaseLabel}</span>
      </button>
      {popover && createPortal(popover, document.body)}
    </div>
  );
}
