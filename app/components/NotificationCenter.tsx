"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, type MouseEvent } from "react";
import type { TrackCenterNotification, TrackNotificationKind } from "../notificationCenter";

export type NotificationCenterProps = {
  items: TrackCenterNotification[];
  unreadCount: number;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDismiss: (id: string) => void;
};

export type NotificationCenterTriggerProps = Pick<NotificationCenterProps, "unreadCount" | "open" | "onToggle"> & {
  className?: string;
};

function kindGlyph(kind: TrackNotificationKind) {
  if (kind === "rest") return "◷";
  if (kind === "sync") return "↻";
  if (kind === "draft") return "▣";
  return "•";
}

function relativeTime(timestamp: number) {
  const elapsed = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationCenterTrigger({
  unreadCount,
  open,
  onToggle,
  className = "",
}: NotificationCenterTriggerProps) {
  const countLabel = unreadCount > 9 ? "9+" : String(unreadCount);
  return (
    <button
      type="button"
      className={`notification-center-trigger${className ? ` ${className}` : ""}`}
      data-notification-center-trigger="true"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
      title={unreadCount ? `${unreadCount} unread notifications` : "Notifications"}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
      </svg>
      {unreadCount > 0 && <span className="notification-center-badge">{countLabel}</span>}
    </button>
  );
}

type NotificationCenterPanelProps = Omit<NotificationCenterProps, "onToggle">;

export function NotificationCenterPanel({
  items,
  unreadCount,
  open,
  onClose,
  onMarkRead,
  onMarkAllRead,
  onDismiss,
}: NotificationCenterPanelProps) {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const dismiss = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-notification-center-trigger='true']")) return;
      onClose();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", dismiss, true);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", dismiss, true);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose, open]);

  if (!open || !globalThis.document) return null;

  const onNotificationClick = (event: MouseEvent<HTMLButtonElement>, item: TrackCenterNotification) => {
    event.currentTarget.blur();
    onMarkRead(item.id);
  };

  return createPortal(
    <section ref={panelRef} className="notification-center-panel" role="dialog" aria-label="Notification center">
      <header className="notification-center-header">
        <div>
          <span className="notification-center-kicker">INBOX</span>
          <h2>Notifications</h2>
        </div>
        <div className="notification-center-actions">
          <button type="button" onClick={onMarkAllRead} disabled={!unreadCount}>
            Mark all read
          </button>
          <button
            type="button"
            className="notification-center-close"
            onClick={onClose}
            aria-label="Close notifications"
          >
            ×
          </button>
        </div>
      </header>
      {items.length > 0 ? (
        <ul className="notification-center-list">
          {items.map((item) => (
            <li key={item.id} className={`notification-center-item${item.unread ? " is-unread" : ""}`}>
              <button
                type="button"
                className="notification-center-item-main"
                onClick={(event) => onNotificationClick(event, item)}
              >
                <span className={`notification-center-item-icon is-${item.kind}`} aria-hidden="true">
                  {kindGlyph(item.kind)}
                </span>
                <span className="notification-center-item-copy">
                  <strong>{item.title}</strong>
                  <span>{item.message}</span>
                  <time dateTime={new Date(item.createdAt).toISOString()}>{relativeTime(item.createdAt)}</time>
                </span>
                {item.unread && <i className="notification-center-unread-dot" aria-label="Unread" />}
              </button>
              <button
                type="button"
                className="notification-center-dismiss"
                onClick={() => onDismiss(item.id)}
                aria-label={`Dismiss ${item.title}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="notification-center-empty">
          <span className="notification-center-empty-icon" aria-hidden="true">
            ✓
          </span>
          <strong>You’re all caught up</strong>
          <span>Rest alerts, sync issues, drafts, and announcements will appear here.</span>
        </div>
      )}
    </section>,
    document.body,
  );
}
