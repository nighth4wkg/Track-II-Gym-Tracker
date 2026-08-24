import type { RefObject } from "react";
import type { SettingsView } from "../trackTypes";

type SettingsNavigationProps = {
  isAdmin: boolean;
  settingsTabsAtEnd: boolean;
  settingsTabsRef: RefObject<HTMLDivElement | null>;
  settingsView: SettingsView;
  onScrollSettingsTabs: () => void;
  onSettingsViewChange: (view: SettingsView) => void;
  onShowMoreSettings: () => void;
};

type SettingsIconName =
  | "appearance"
  | "personal"
  | "privacy"
  | "updates"
  | "workout"
  | "data"
  | "ai"
  | "account"
  | "about"
  | "admin";

type DesktopSettingsItem = { view: SettingsView; icon: SettingsIconName; label: string };

const desktopSettingsItems: DesktopSettingsItem[] = [
  { view: "appearance", icon: "appearance", label: "Appearance" },
  { view: "personal", icon: "personal", label: "Personal Info" },
  { view: "workout", icon: "workout", label: "Workout" },
  { view: "account", icon: "account", label: "Account & Security" },
  { view: "ai", icon: "ai", label: "AI Import" },
  { view: "updates", icon: "updates", label: "Updates" },
  { view: "about", icon: "about", label: "About Track II" },
];
const adminSettingsItem: DesktopSettingsItem = { view: "admin", icon: "admin", label: "Admin Panel" };
const adminDesktopSettingsItems: DesktopSettingsItem[] = [...desktopSettingsItems, adminSettingsItem];

function SettingsIcon({ name }: { name: SettingsIconName }) {
  const content = {
    appearance: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3a9 9 0 0 1 0 18" />
      </>
    ),
    personal: (
      <>
        <circle cx="12" cy="8" r="3" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </>
    ),
    privacy: (
      <>
        <path d="M12 3 19 6v5c0 4.6-2.8 8.2-7 10-4.2-1.8-7-5.4-7-10V6l7-3Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    updates: (
      <>
        <path d="M20 11a8 8 0 0 0-14.6-4.6L4 8" />
        <path d="M4 4v4h4" />
        <path d="M4 13a8 8 0 0 0 14.6 4.6L20 16" />
        <path d="M20 20v-4h-4" />
      </>
    ),
    workout: <path d="M6 8v8M18 8v8M3.5 10v4M20.5 10v4M6 12h12M3.5 10H6M18 10h2.5M3.5 14H6M18 14h2.5" />,
    data: (
      <>
        <path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 8.5 4 4 0 0 0 7 18Z" />
        <path d="M12 11v6m0 0 2.5-2.5M12 17l-2.5-2.5" />
      </>
    ),
    ai: (
      <>
        <path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z" />
        <path d="m19 16 .6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6L19 16Z" />
      </>
    ),
    account: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="8" cy="10" r="2" />
        <path d="M5.5 15a3 3 0 0 1 5 0M14 10h4M14 14h4" />
      </>
    ),
    about: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 8h.01" />
      </>
    ),
    admin: (
      <>
        <path d="M12 3 19 6v5c0 4.6-2.8 8.2-7 10-4.2-1.8-7-5.4-7-10V6l7-3Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
  }[name];

  return (
    <svg
      className={`settings-nav-icon settings-nav-icon-${name}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {content}
    </svg>
  );
}

export function SettingsNavigation({
  isAdmin,
  settingsTabsAtEnd,
  settingsTabsRef,
  settingsView,
  onScrollSettingsTabs,
  onSettingsViewChange,
  onShowMoreSettings,
}: SettingsNavigationProps) {
  const desktopItems = isAdmin ? adminDesktopSettingsItems : desktopSettingsItems;
  const mobileItems = desktopItems;

  return (
    <>
      <aside className="settings-nav">
        <span className="settings-kicker">USER SETTINGS</span>
        {desktopItems.map((item) => (
          <button
            type="button"
            key={item.view}
            className={
              item.view === "admin"
                ? settingsView === item.view
                  ? "active admin-nav-button"
                  : "admin-nav-button"
                : settingsView === item.view
                  ? "active"
                  : ""
            }
            aria-current={settingsView === item.view ? "page" : undefined}
            onClick={() => onSettingsViewChange(item.view)}
          >
            <span aria-hidden="true">
              <SettingsIcon name={item.icon} />
            </span>
            {item.label}
          </button>
        ))}
      </aside>
      <div className="settings-mobile-tabs-wrap">
        <div ref={settingsTabsRef} onScroll={onScrollSettingsTabs} className="settings-mobile-tabs">
          {mobileItems.map((item) => (
            <button
              type="button"
              key={item.view}
              className={settingsView === item.view ? "active" : ""}
              onClick={() => onSettingsViewChange(item.view)}
            >
              <span>{item.label}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className={settingsTabsAtEnd ? "settings-tabs-more is-hidden" : "settings-tabs-more"}
          onClick={onShowMoreSettings}
          aria-label="Show more settings categories"
          title="More settings"
          aria-hidden={settingsTabsAtEnd}
          tabIndex={settingsTabsAtEnd ? -1 : 0}
          disabled={settingsTabsAtEnd}
        >
          <span />
        </button>
      </div>
    </>
  );
}
