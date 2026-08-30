"use client";

import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import type { TrackCenterNotification, TrackNotificationKind } from "../notificationCenter";
import { TRACK_TIMING } from "../trackConstants";

export type NotificationCenterProps = {
  items: TrackCenterNotification[];
  unreadCount: number;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClearAll: () => void;
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
      aria-controls="notification-center-panel"
      aria-haspopup="dialog"
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
  onClearAll,
  onDismiss,
}: NotificationCenterPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const [mounted, setMounted] = useState(open);
  const [panelPosition, setPanelPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (open) {
      if (mounted) return undefined;
      const frame = window.requestAnimationFrame(() => setMounted(true));
      return () => window.cancelAnimationFrame(frame);
    }
    if (!mounted) return undefined;
    const timer = window.setTimeout(() => setMounted(false), TRACK_TIMING.dropdownCloseAnimationMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [mounted, open]);

  useLayoutEffect(() => {
    if (!mounted || !open || !globalThis.window) return undefined;
    const positionPanel = () => {
      const triggers = Array.from(document.querySelectorAll<HTMLElement>("[data-notification-center-trigger='true']"));
      const visibleTriggers = triggers.filter((candidate) => {
        const rect = candidate.getBoundingClientRect();
        const styles = window.getComputedStyle(candidate);
        return rect.width > 0 && rect.height > 0 && styles.display !== "none" && styles.visibility !== "hidden";
      });
      const mobileTrigger = visibleTriggers.find((candidate) => candidate.closest(".mobile-header"));
      const trigger = mobileTrigger ?? visibleTriggers[0];
      const triggerRect = trigger?.getBoundingClientRect();
      const compactMobile = window.innerWidth <= 640;
      const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const viewportPadding = 12;
      const panelWidth = Math.min(370, Math.max(240, viewportWidth - viewportPadding * 2));
      const panelHeight = panelRef.current?.getBoundingClientRect().height ?? 420;
      const mobileTop = triggerRect?.bottom ? triggerRect.bottom + 8 : viewportPadding;
      const top = compactMobile
        ? Math.min(
            Math.max(viewportPadding, mobileTop),
            Math.max(viewportPadding, viewportHeight - panelHeight - viewportPadding),
          )
        : viewportPadding;
      const left = compactMobile
        ? viewportPadding
        : Math.max(viewportPadding, viewportWidth - panelWidth - viewportPadding);
      setPanelPosition({ top, left });
    };
    const frame = window.requestAnimationFrame(positionPanel);
    window.addEventListener("resize", positionPanel);
    window.addEventListener("scroll", positionPanel, true);
    window.visualViewport?.addEventListener("resize", positionPanel);
    window.visualViewport?.addEventListener("scroll", positionPanel);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", positionPanel);
      window.removeEventListener("scroll", positionPanel, true);
      window.visualViewport?.removeEventListener("resize", positionPanel);
      window.visualViewport?.removeEventListener("scroll", positionPanel);
    };
  }, [items.length, mounted, open]);

  useEffect(() => {
    if (!open) return undefined;
    const dismiss = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-notification-center-trigger='true']")) return;
      if (target instanceof Element && target.closest(".notification-center-backdrop")) return;
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

  if ((!open && !mounted) || !globalThis.document) return null;

  const onNotificationClick = (event: MouseEvent<HTMLButtonElement>, item: TrackCenterNotification) => {
    event.currentTarget.blur();
    onMarkRead(item.id);
  };

  return createPortal(
    <>
      <button
        type="button"
        className={`notification-center-backdrop${!open ? " is-closing" : ""}`}
        data-positioned={panelPosition ? "true" : "false"}
        aria-label="Close notifications"
        tabIndex={-1}
        onClick={onClose}
      />
      <section
        ref={panelRef}
        className={`notification-center-panel${!open ? " is-closing" : ""}`}
        id="notification-center-panel"
        data-positioned={panelPosition ? "true" : "false"}
        style={panelPosition ? { top: panelPosition.top, left: panelPosition.left, right: "auto" } : undefined}
        role="dialog"
        aria-label="Notification center"
        aria-modal="true"
        aria-hidden={!open}
      >
        <header className="notification-center-header">
          <div>
            <span className="notification-center-kicker">INBOX</span>
            <h2>Notifications</h2>
          </div>
          <div className="notification-center-actions">
            <button type="button" onClick={onMarkAllRead} disabled={!unreadCount}>
              Mark all read
            </button>
            <button type="button" className="notification-center-clear" onClick={onClearAll} disabled={!items.length}>
              Clear all
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
      </section>
    </>,
    document.body,
  );
}
