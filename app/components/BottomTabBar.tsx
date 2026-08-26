import { type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

export type BottomTabId = "dashboard" | "workout" | "timer" | "calendar" | "rank";

// Keep Timer at the right edge. Keeping this order in one component makes the
// web, tablet, and native shells use the same map for rendering and dragging.
export const DEFAULT_BOTTOM_TABS: BottomTabId[] = ["dashboard", "workout", "calendar", "rank", "timer"];

const BOTTOM_TAB_LABELS = {
  dashboard: "Dashboard",
  workout: "Workout",
  timer: "Timer",
  calendar: "Calendar",
  rank: "Rank",
} satisfies Record<BottomTabId, string>;

function BottomTabIcon({ id, active = false }: { id: BottomTabId; active?: boolean }) {
  const className = active ? "is-filled" : undefined;
  if (id === "dashboard")
    return (
      <svg className={className} viewBox="0 0 24 24" focusable="false">
        <rect x="4" y="4" width="6" height="7" rx="1.5" />
        <rect x="14" y="4" width="6" height="4" rx="1.5" />
        <rect x="4" y="15" width="6" height="5" rx="1.5" />
        <rect x="14" y="12" width="6" height="8" rx="1.5" />
      </svg>
    );
  if (id === "workout")
    return (
      <svg className={className} viewBox="0 0 24 24" focusable="false">
        <path d="m4 11 8-7 8 7" />
        <path d="M6.5 10.5V20h11v-9.5M9.5 20v-5h5v5" />
      </svg>
    );
  if (id === "timer")
    return (
      <svg className={className} viewBox="0 0 24 24" focusable="false">
        <circle cx="12" cy="13" r="7.5" />
        <path d="M12 9v4l2.5 1.5M9.5 3h5M12 3v2" />
      </svg>
    );
  if (id === "calendar")
    return (
      <svg className={className} viewBox="0 0 24 24" focusable="false">
        <rect x="4" y="5.5" width="16" height="14" rx="2" />
        <path d="M8 3.5v4M16 3.5v4M4 9.5h16M8 13h.01M12 13h.01M16 13h.01M8 16.5h.01M12 16.5h.01" />
      </svg>
    );
  return (
    <svg className={className} viewBox="0 0 24 24" focusable="false">
      <path d="M8 4h8v3.2a4 4 0 0 1-8 0V4Z" />
      <path d="M8 6H5v1.2A4.8 4.8 0 0 0 9.2 12M16 6h3v1.2a4.8 4.8 0 0 1-4.2 4.8M12 11.2V16M8.5 20h7M10 16h4v4h-4z" />
    </svg>
  );
}

type BottomTabBarProps = {
  activeTab: BottomTabId;
  highlightedTab: BottomTabId;
  draggingTab: BottomTabId | null;
  trackRef: RefObject<HTMLDivElement | null>;
  indicatorIndex: number;
  timerRunning: boolean;
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  hidden?: boolean;
  onClick: (event: ReactMouseEvent<HTMLButtonElement>, id: BottomTabId) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>, id: BottomTabId) => void;
};

export function BottomTabBar({
  activeTab,
  highlightedTab,
  draggingTab,
  trackRef,
  indicatorIndex,
  timerRunning,
  sidebarCollapsed,
  mobileSidebarOpen,
  hidden = false,
  onClick,
  onPointerDown,
}: BottomTabBarProps) {
  const barClassName = `bottom-tab-bar${hidden ? " is-settings-hidden" : ""}${sidebarCollapsed ? " is-sidebar-collapsed" : ""}${mobileSidebarOpen ? " is-mobile-sidebar-open" : ""}`;

  return (
    <nav
      className={barClassName}
      aria-hidden={hidden || mobileSidebarOpen}
      aria-label="Primary pages. Tap to open. Hold and slide to choose a page."
    >
      <div ref={trackRef} className="bottom-tab-track" data-indicator-index={indicatorIndex}>
        <span className={`bottom-tab-active-indicator${draggingTab ? " is-dragging" : ""}`} aria-hidden="true" />
        {DEFAULT_BOTTOM_TABS.map((id) => (
          <button
            type="button"
            key={id}
            data-bottom-tab-id={id}
            className={`bottom-tab${!draggingTab && activeTab === id ? " active" : ""}${draggingTab && highlightedTab === id ? " bottom-tab-drop-target" : ""}`}
            onClick={(event) => onClick(event, id)}
            onPointerDown={(event) => onPointerDown(event, id)}
            aria-current={activeTab === id ? "page" : undefined}
            title={`${BOTTOM_TAB_LABELS[id]} — tap to open, hold and slide to choose a page`}
          >
            <span className="bottom-tab-icon-wrap">
              <span className="bottom-tab-icon" aria-hidden="true">
                <BottomTabIcon id={id} active={highlightedTab === id} />
              </span>
              {id === "timer" && timerRunning && <i className="timer-running-indicator" aria-label="Timer running" />}
            </span>
            <span className="bottom-tab-label">{BOTTOM_TAB_LABELS[id]}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
