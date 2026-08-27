"use client";

import { useState } from "react";

type SyncConflictBannerProps = {
  onRetry: () => void;
  onUseCloudCopy: () => void;
};

export function SyncConflictBanner({ onRetry, onUseCloudCopy }: SyncConflictBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <aside className="sync-conflict-banner" role="status" aria-live="polite">
      <div>
        <strong>Changes merged safely</strong>
        <span>Another device changed this split. Review the merged copy before syncing again.</span>
      </div>
      <div className="sync-conflict-actions">
        <button type="button" className="sync-conflict-keep" onClick={onUseCloudCopy}>
          Use cloud copy
        </button>
        <button type="button" className="sync-conflict-keep" onClick={() => setDismissed(true)}>
          Keep merged copy
        </button>
        <button type="button" className="sync-conflict-retry" onClick={onRetry}>
          Retry sync
        </button>
      </div>
    </aside>
  );
}
