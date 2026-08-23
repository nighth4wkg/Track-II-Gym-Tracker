"use client";

import { TRACK_LIMITS } from "../trackConstants";
import { TRACK_ISSUES_URL, TRACK_RELEASES_URL } from "../trackConfig";
import type { SettingsViewContentProps } from "./SettingsViewContent";

export function SettingsUpdatesView({
  releaseAvailable,
  updateVersion,
  updatesViewBusy,
  updatesViewMessage,
  onCheckForUpdates,
}: SettingsViewContentProps) {
  return (
    <section className="updates-page">
      <div className="updates-page-intro">
        <strong>Keep Track II current</strong>
        <p>Check the latest app release. Releases include the newest IPA, APK, and release notes.</p>
      </div>
      <div className="updates-page-card">
        <div className="updates-page-card-heading">
          <span className="updates-page-card-label">Release status</span>
          <span className={releaseAvailable ? "updates-page-status ready" : "updates-page-status"}>
            {releaseAvailable ? "Update ready" : "Up to date"}
          </span>
        </div>
        <p>
          {releaseAvailable
            ? `v${updateVersion} is ready to download from the configured release page.`
            : "No updates yet."}
        </p>
        <div className="updates-page-actions">
          <button
            className="ui-button ui-button-primary"
            onClick={() => void onCheckForUpdates()}
            disabled={updatesViewBusy}
          >
            {updatesViewBusy ? "Checking…" : "Check for updates"}
          </button>
          {releaseAvailable && TRACK_RELEASES_URL && (
            <a
              className="ui-button ui-button-secondary updates-release-link"
              href={TRACK_RELEASES_URL}
              target="_blank"
              rel="noreferrer"
            >
              Download update
            </a>
          )}
        </div>
        {updatesViewMessage && (
          <div className="updates-page-message" role="status">
            {updatesViewMessage}
          </div>
        )}
      </div>
    </section>
  );
}

export function SettingsAboutView() {
  return (
    <section className="about-page">
      <span className="brand-mark about-brand-mark">
        <span className="dumbbell-icon" />
      </span>
      <h3>Made for personal use and sharing with friends.</h3>
      <p>This project is fully vibe-coded, completely free, and non-commercial.</p>
      <p>
        For issues, please use{" "}
        {TRACK_ISSUES_URL ? (
          <a href={TRACK_ISSUES_URL} target="_blank" rel="noreferrer">
            the Track II issue tracker
          </a>
        ) : (
          "the issue tracker"
        )}
        .
      </p>
    </section>
  );
}

export function SettingsAdminView({
  announcementComposerOpen,
  announcementSendBusy,
  announcementSendMessage,
  announcementText,
  updateCheckBusy,
  updateCheckMessage,
  onForceUpdateCheck,
  onOpenAdminUsers,
  onSendAnnouncement,
  onSetAdminAnnouncementOpen,
  onSetAnnouncementText,
}: SettingsViewContentProps) {
  return (
    <section className="admin-page">
      <div className="admin-intro">
        <strong>Track II administration</strong>
        <p>Live diagnostics, release checks, and announcements for signed-in Track II users.</p>
      </div>
      <div className="admin-card">
        <div className="setting-row">
          <div>
            <strong>Force update check</strong>
            <p>Ask Cloudflare for the latest deployed Track II build and refresh when one is available.</p>
          </div>
          <button className="admin-action-button" onClick={onForceUpdateCheck} disabled={updateCheckBusy}>
            {updateCheckBusy ? "Checking…" : "Check now"}
          </button>
        </div>
        {updateCheckMessage && (
          <div className="update-check-message" role="status">
            {updateCheckMessage}
          </div>
        )}
      </div>
      <div className="admin-card">
        <div className="setting-row">
          <div>
            <strong>Manage members</strong>
            <p>View activity, inspect read-only splits, and manage administrator roles.</p>
          </div>
          <button className="admin-action-button" onClick={onOpenAdminUsers}>
            Open directory
          </button>
        </div>
      </div>
      <div className="admin-card">
        <div className="setting-row">
          <div>
            <strong>Send notification to all users</strong>
            <p>Save a signed announcement that users receive on their next app check.</p>
          </div>
          <button
            className={announcementComposerOpen ? "theme-toggle on" : "theme-toggle"}
            onClick={() => onSetAdminAnnouncementOpen(!announcementComposerOpen)}
            role="switch"
            aria-checked={announcementComposerOpen}
          >
            <span />
          </button>
        </div>
        {announcementComposerOpen && (
          <div className="announcement-composer">
            <input
              value={announcementText}
              onChange={(event) =>
                onSetAnnouncementText(event.target.value.slice(0, TRACK_LIMITS.maxAnnouncementChars))
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") void onSendAnnouncement();
              }}
              placeholder="Write an announcement…"
              aria-label="Announcement message"
            />
            <button
              onClick={() => void onSendAnnouncement()}
              disabled={!announcementText.trim() || announcementSendBusy}
              aria-label="Send announcement"
            >
              <span />
            </button>
            {announcementSendMessage && (
              <div className="update-check-message" role="status">
                {announcementSendMessage}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
