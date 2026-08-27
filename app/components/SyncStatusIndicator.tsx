"use client";

import { useEffect, useRef, useState } from "react";
import { syncStatusTone } from "../trackUtils";

type SyncPhase = "synced" | "syncing" | "offline" | "attention";

type SyncStatusIndicatorProps = {
  label: string;
  lastSuccessfulSyncAt: number | null;
  onRetry: () => void;
  queuedCount?: number;
  compact?: boolean;
};

function phaseFor(label: string): SyncPhase {
  const normalized = label.toLowerCase();
  if (normalized.includes("offline")) return "offline";
  if (/(retry|failed|couldn|needs attention|not saved|conflict|review changes)/.test(normalized)) return "attention";
  if (/(saving|syncing|loading|updating|merging|update in)/.test(normalized)) return "syncing";
  return "synced";
}

const PHASE_LABELS = {
  synced: "Synced",
  syncing: "Syncing",
  offline: "Offline",
  attention: "Needs attention",
} satisfies Record<SyncPhase, string>;

function formatSyncTime(timestamp: number | null) {
  if (!timestamp) return "Not synced yet";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(timestamp);
}

export function SyncStatusIndicator({
  label,
  lastSuccessfulSyncAt,
  onRetry,
  queuedCount = 0,
  compact = false,
}: SyncStatusIndicatorProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const phase = phaseFor(label);
  const tone = syncStatusTone(label);
  const phaseLabel = PHASE_LABELS[phase];
  const conflictVisible = /conflict|review changes/i.test(label);

  useEffect(() => {
    if (!open) return undefined;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
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

  return (
    <div
      ref={rootRef}
      className={`sync-health sync-health-${tone}${compact ? " is-compact" : ""}`}
      data-sync-phase={phase}
      data-sync-tone={tone}
    >
      <button
        type="button"
        className="sync-health-trigger"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label={`${phaseLabel}. Last successful sync ${formatSyncTime(lastSuccessfulSyncAt)}.`}
        title={`${phaseLabel} · Last successful sync ${formatSyncTime(lastSuccessfulSyncAt)}`}
      >
        <i aria-hidden="true" />
        <span>{phaseLabel}</span>
      </button>
      {open && (
        <div className="sync-health-popover" role="dialog" aria-label="Sync status details">
          <div>
            <strong>{phaseLabel}</strong>
            <span>
              {phase === "offline"
                ? "Your changes are saved on this device and will retry when you are back online."
                : phase === "attention"
                  ? conflictVisible
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
      )}
    </div>
  );
}
