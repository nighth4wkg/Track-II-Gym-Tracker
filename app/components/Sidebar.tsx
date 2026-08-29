import type { MutableRefObject } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { FILTER_LABELS, TRACK_LIMITS } from "../trackConstants";
import { ACCOUNT_PRESENCE_LABELS } from "../syncHealth";
import type { AccountPresenceStatus } from "../trackTypes";
import type { Checklist, Filter } from "../trackTypes";
import type { NotificationCenterTriggerProps } from "./NotificationCenter";
import { NotificationCenterTrigger } from "./NotificationCenter";
import { SyncStatusIndicator } from "./SyncStatusIndicator";

type SidebarProps = {
  mobileOpen: boolean;
  sidebarCollapsed: boolean;
  nativeApp: boolean;
  activeId: string;
  showDashboard: boolean;
  showTimer: boolean;
  showCalendar: boolean;
  showRank: boolean;
  completionEnabled: boolean;
  filter: Filter;
  tasks: Checklist["tasks"];
  openCount: number;
  recentLists: Checklist[];
  renamingId: string | null;
  splitName: string;
  draggingSplit: string | null;
  splitHoldTriggered: MutableRefObject<boolean>;
  isAdmin: boolean;
  accountRoleLabel: string;
  accountRoleInitial: string;
  accountUsername: string;
  accountPresenceStatus: AccountPresenceStatus;
  headerStatus: string;
  lastSuccessfulSyncAt: number | null;
  onRetrySync: () => void;
  onUseCloudCopy: () => void;
  offlineQueueCount: number;
  offlineQueueStuckCount: number;
  settingsOpen: boolean;
  onGoHome: () => void;
  onHideSidebar: () => void;
  onToggleSidebar: () => void;
  onNewChecklist: () => void;
  onFilterChange: (filter: Filter) => void;
  onSplitNameChange: (value: string) => void;
  onSaveSplitName: (id: string) => void;
  onCancelRename: () => void;
  onSelectChecklist: (id: string) => void;
  onBeginSplitHold: (event: ReactPointerEvent<HTMLButtonElement>, id: string) => void;
  onMoveSplitHold: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onFinishSplitHold: (event: ReactPointerEvent<HTMLButtonElement>, id: string) => void;
  onCancelSplitPointer: () => void;
  onOpenSplitMenu: (event: ReactMouseEvent<HTMLButtonElement>, id: string) => void;
  onCloseMobileSidebar: () => void;
  onOpenSettings: () => void;
  notificationCenterProps: NotificationCenterTriggerProps;
};

export function Sidebar({
  mobileOpen,
  sidebarCollapsed,
  nativeApp,
  activeId,
  showDashboard,
  showTimer,
  showCalendar,
  showRank,
  completionEnabled,
  filter,
  tasks,
  openCount,
  recentLists,
  renamingId,
  splitName,
  draggingSplit,
  splitHoldTriggered,
  isAdmin,
  accountRoleLabel,
  accountRoleInitial,
  accountUsername,
  accountPresenceStatus,
  headerStatus,
  lastSuccessfulSyncAt,
  onRetrySync,
  offlineQueueCount,
  offlineQueueStuckCount,
  settingsOpen,
  onGoHome,
  onHideSidebar,
  onToggleSidebar,
  onNewChecklist,
  onFilterChange,
  onSplitNameChange,
  onSaveSplitName,
  onCancelRename,
  onSelectChecklist,
  onBeginSplitHold,
  onMoveSplitHold,
  onFinishSplitHold,
  onCancelSplitPointer,
  onOpenSplitMenu,
  onCloseMobileSidebar,
  onOpenSettings,
  notificationCenterProps,
}: SidebarProps) {
  return (
    <>
      <aside className={mobileOpen ? "sidebar mobile-open" : "sidebar"}>
        <div>
          <div className="brand-row">
            <button className="brand home-brand" onClick={onGoHome} aria-label="Go to Track II home">
              <span className="brand-mark">
                <span className="dumbbell-icon" />
              </span>
              <span>Track II</span>
              {!nativeApp && <small className="brand-beta">BETA</small>}
            </button>
            <div className="brand-actions">
              <button
                className="sidebar-inline-toggle"
                onTouchStart={(event) => event.stopPropagation()}
                onTouchEnd={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onHideSidebar();
                }}
                aria-label="Hide sidebar"
                title="Hide sidebar"
              >
                <span className="sidebar-chevron left" />
              </button>
            </div>
          </div>
          <button className="new-button" onClick={onNewChecklist}>
            <span className="sidebar-action-icon">＋</span>
            <span>New split</span>
          </button>
          {completionEnabled && (
            <nav className="desktop-filters" aria-label="Exercise filters">
              <button
                className={filter === "all" ? "nav-item active" : "nav-item"}
                onClick={() => onFilterChange("all")}
              >
                <span>☷</span> {FILTER_LABELS.all} <b>{tasks.length}</b>
              </button>
              <button
                className={filter === "open" ? "nav-item active" : "nav-item"}
                onClick={() => onFilterChange("open")}
              >
                <span>○</span> {FILTER_LABELS.open} <b>{openCount}</b>
              </button>
              <button
                className={filter === "done" ? "nav-item active" : "nav-item"}
                onClick={() => onFilterChange("done")}
              >
                <span>✓</span> {FILTER_LABELS.done} <b>{tasks.length - openCount}</b>
              </button>
            </nav>
          )}
          <div className="recents-label">SPLITS</div>
          <div className="recents">
            {recentLists.map((list) =>
              renamingId === list.id ? (
                <div className="recent rename-row" key={list.id}>
                  <input
                    value={splitName}
                    onChange={(event) => onSplitNameChange(event.target.value)}
                    onBlur={() => onSaveSplitName(list.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") onSaveSplitName(list.id);
                      if (event.key === "Escape") onCancelRename();
                    }}
                    maxLength={TRACK_LIMITS.maxSplitNameChars}
                    autoFocus
                  />
                </div>
              ) : (
                <button
                  key={list.id}
                  data-split-id={list.id}
                  className={
                    (!showDashboard && !showTimer && !showCalendar && !showRank && list.id === activeId
                      ? "recent active"
                      : "recent") + (draggingSplit === list.id ? " split-dragging" : "")
                  }
                  onClick={(event) => {
                    if (splitHoldTriggered.current) {
                      event.preventDefault();
                      event.stopPropagation();
                      splitHoldTriggered.current = false;
                      return;
                    }
                    onSelectChecklist(list.id);
                  }}
                  onPointerDown={(event) => onBeginSplitHold(event, list.id)}
                  onPointerMove={onMoveSplitHold}
                  onPointerUp={(event) => onFinishSplitHold(event, list.id)}
                  onPointerCancel={onCancelSplitPointer}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    onOpenSplitMenu(event, list.id);
                  }}
                  title={list.title + " — hold and move to reorder, or right-click for options"}
                >
                  <span>{list.title}</span>
                  <b>{list.tasks.length}</b>
                </button>
              ),
            )}
          </div>
        </div>
        <div className="account-panel">
          <div className="account-panel-heading">
            <span className="account-kicker">ACCOUNT</span>
            <div className="account-panel-tools">
              <NotificationCenterTrigger {...notificationCenterProps} />
              <SyncStatusIndicator
                label={headerStatus}
                lastSuccessfulSyncAt={lastSuccessfulSyncAt}
                onRetry={onRetrySync}
                queuedCount={offlineQueueCount}
                stuckCount={offlineQueueStuckCount}
                compact
              />
            </div>
          </div>
          <div className="account-row">
            <span
              className={isAdmin ? "account-role-badge admin" : "account-role-badge user"}
              aria-label={accountRoleLabel}
            >
              {accountRoleInitial}
            </span>
            <div className="account-identity">
              <strong title={`@${accountUsername}`}>@{accountUsername}</strong>
              <small>
                <span>{accountRoleLabel}</span>
                <span aria-hidden="true"> · </span>
                <span className={`account-online is-${accountPresenceStatus}`}>
                  <i aria-hidden="true" />
                  {ACCOUNT_PRESENCE_LABELS[accountPresenceStatus]}
                </span>
              </small>
            </div>
            <button
              className="settings-button"
              onClick={() => onOpenSettings()}
              aria-expanded={settingsOpen}
              aria-label="Open settings"
              title="Settings"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
        </div>
      </aside>
      {mobileOpen && (
        <button className="mobile-sidebar-backdrop" onClick={onCloseMobileSidebar} aria-label="Close sidebar" />
      )}
      {sidebarCollapsed && (
        <button className="sidebar-toggle" onClick={onToggleSidebar} aria-label="Show sidebar" title="Show sidebar">
          <span className="sidebar-chevron right" />
        </button>
      )}
    </>
  );
}
