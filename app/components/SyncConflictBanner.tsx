"use client";

import { useState } from "react";
import type { SyncConflictDetails } from "../hooks/useSyncConflictState";

type SyncConflictBannerProps = {
  statusKey?: string;
  conflict?: SyncConflictDetails | null;
  onRetry: () => void;
  onUseCloudCopy: () => void;
  onKeepMerged: () => void;
};

function snapshotStats(lists: SyncConflictDetails["baseLists"]) {
  return lists.reduce(
    (stats, list) => ({
      splits: stats.splits + 1,
      exercises: stats.exercises + list.tasks.length,
      sets: stats.sets + list.tasks.reduce((count, task) => count + (task.sets?.length ?? 0), 0),
    }),
    { splits: 0, exercises: 0, sets: 0 },
  );
}

function ConflictSnapshot({ label, stats }: { label: string; stats: ReturnType<typeof snapshotStats> }) {
  return (
    <div className="sync-conflict-snapshot">
      <span>{label}</span>
      <strong>{stats.exercises} exercises</strong>
      <small>
        {stats.splits} {stats.splits === 1 ? "split" : "splits"} · {stats.sets} sets
      </small>
    </div>
  );
}

export function SyncConflictBanner({
  statusKey = "conflict",
  conflict,
  onRetry,
  onUseCloudCopy,
  onKeepMerged,
}: SyncConflictBannerProps) {
  const [dismissedStatus, setDismissedStatus] = useState<string | null>(null);
  if (dismissedStatus === statusKey) return null;
  const snapshots = conflict
    ? [
        { label: "Base", lists: conflict.baseLists },
        { label: "Your edits", lists: conflict.localLists },
        { label: "Cloud copy", lists: conflict.remoteLists },
        { label: "Merged result", lists: conflict.mergedLists },
      ].map(({ label, lists }) => ({ label, stats: snapshotStats(lists) }))
    : [];
  return (
    <aside className="sync-conflict-banner" role="status" aria-live="polite">
      <div>
        <strong>Changes merged safely</strong>
        <span>Another device changed this split. Review the three-way result before syncing again.</span>
      </div>
      {snapshots.length > 0 && (
        <details className="sync-conflict-review">
          <summary>Show three-way review</summary>
          <div className="sync-conflict-snapshots">
            {snapshots.map(({ label, stats }) => (
              <ConflictSnapshot key={label} label={label} stats={stats} />
            ))}
          </div>
        </details>
      )}
      <div className="sync-conflict-actions">
        <button type="button" className="sync-conflict-keep" onClick={onUseCloudCopy}>
          Use cloud copy
        </button>
        <button
          type="button"
          className="sync-conflict-keep"
          onClick={() => {
            onKeepMerged();
            setDismissedStatus(statusKey);
          }}
        >
          Keep merged copy
        </button>
        <button type="button" className="sync-conflict-retry" onClick={onRetry}>
          Retry sync
        </button>
      </div>
    </aside>
  );
}
