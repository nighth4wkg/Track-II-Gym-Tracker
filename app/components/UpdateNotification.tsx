"use client";

import { TRACK_RELEASES_URL } from "../trackConfig";
import { createPortal } from "react-dom";

type UpdateNotificationProps = {
  debug?: boolean;
  isAdmin: boolean;
  nativeApp: boolean;
  updateVersion: string;
  onDismiss: () => void;
};

export function UpdateNotification({
  debug = false,
  isAdmin,
  nativeApp,
  updateVersion,
  onDismiss,
}: UpdateNotificationProps) {
  if (!nativeApp || !globalThis.document || (debug && !isAdmin)) return null;
  return createPortal(
    <aside
      className={
        debug
          ? "track-notification track-update-notification debug-update-notification"
          : "track-notification track-update-notification"
      }
      aria-live="assertive"
    >
      <span className="notification-logo update-notification-logo">
        <span className="update-notification-mark">↻</span>
      </span>
      <div className="track-update-copy">
        <span className="update-notification-kicker">{debug ? "ADMIN DEBUG PREVIEW" : "NEW RELEASE"}</span>
        <strong>
          {debug ? "[debug] Fake update notification" : `Update ready${updateVersion ? ` · v${updateVersion}` : ""}`}
        </strong>
        <p>
          {debug
            ? "Admin-only preview. No release was published."
            : "Download the latest IPA or APK from the configured release page."}
        </p>
        {!debug && TRACK_RELEASES_URL && (
          <div className="update-notification-actions">
            <a className="update-ready-release" href={TRACK_RELEASES_URL} target="_blank" rel="noreferrer">
              View release
            </a>
          </div>
        )}
      </div>
      <button onClick={onDismiss} aria-label="Dismiss update notice">
        ×
      </button>
    </aside>,
    document.body,
  );
}
