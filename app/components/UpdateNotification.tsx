"use client";

import { haptic } from "../haptics";
import { TRACK_RELEASES_URL } from "../trackConfig";

type UpdateNotificationProps = {
  nativeApp: boolean;
  updateVersion: string;
  onDismiss: () => void;
};

export function UpdateNotification({ nativeApp, updateVersion, onDismiss }: UpdateNotificationProps) {
  const refreshPage = () => {
    haptic(12);
    const refreshUrl = new URL(window.location.href);
    refreshUrl.searchParams.delete("track_version_check");
    refreshUrl.searchParams.set("track_updated", String(Date.now()));
    window.location.replace(refreshUrl.toString());
  };

  return (
    <aside className="track-notification track-update-notification" aria-live="assertive">
      <span className="notification-logo update-notification-logo">
        <span className="update-notification-mark">↻</span>
      </span>
      <div className="track-update-copy">
        <span className="update-notification-kicker">NEW RELEASE</span>
        <strong>Update ready{updateVersion ? ` · v${updateVersion}` : ""}</strong>
        <p>
          {nativeApp
            ? "Download the latest IPA or APK from the configured release page."
            : "Refresh Track II to load the latest version."}
        </p>
        <div className="update-notification-actions">
          {TRACK_RELEASES_URL && (
            <a className="update-ready-release" href={TRACK_RELEASES_URL} target="_blank" rel="noreferrer">
              View release
            </a>
          )}
          {!nativeApp && (
            <button className="update-ready-refresh" onClick={refreshPage}>
              Refresh
            </button>
          )}
        </div>
      </div>
      <button onClick={onDismiss} aria-label="Dismiss update notice">
        ×
      </button>
    </aside>
  );
}
