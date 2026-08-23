"use client";

import { lazy, Suspense, useEffect, useRef, type RefObject } from "react";
import { AdminToolsSkeleton, SettingsScreenSkeleton } from "./LoadingSkeletons";
import { SettingsNavigation } from "./SettingsNavigation";
import { haptic } from "../haptics";
import { SETTINGS_LABELS } from "../trackConstants";
import { TRACK_VERSION } from "../trackConfig";
import type { SettingsView } from "../trackTypes";
import { useModalFocus } from "../hooks/useModalFocus";

const SettingsViewContent = lazy(async () => ({
  default: (await import("./SettingsViewContent")).ConnectedSettingsViewContent,
}));
const AdminMemberViewer = lazy(async () => ({ default: (await import("./AdminMemberViewer")).AdminMemberViewer }));

type SettingsModalProps = {
  exerciseUnitsExpanded: boolean;
  isAdmin: boolean;
  settingsClosing: boolean;
  settingsTabsAtEnd: boolean;
  settingsTabsRef: RefObject<HTMLDivElement | null>;
  settingsView: SettingsView;
  onClose: () => void;
  onScrollSettingsTabs: () => void;
  onSettingsViewChange: (view: SettingsView) => void;
  onShowMoreSettings: () => void;
  onToggleExerciseUnits: () => void;
};

export function SettingsModal({
  exerciseUnitsExpanded,
  isAdmin,
  settingsClosing,
  settingsTabsAtEnd,
  settingsTabsRef,
  settingsView,
  onClose,
  onScrollSettingsTabs,
  onSettingsViewChange,
  onShowMoreSettings,
  onToggleExerciseUnits,
}: SettingsModalProps) {
  const modalRef = useRef<HTMLElement>(null);
  useModalFocus({ open: true, containerRef: modalRef });

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const previous = {
      rootOverflow: root.style.overflow,
      rootOverscroll: root.style.overscrollBehavior,
      bodyOverflow: body.style.overflow,
      bodyOverscroll: body.style.overscrollBehavior,
    };
    root.style.overflow = "hidden";
    root.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    return () => {
      root.style.overflow = previous.rootOverflow;
      root.style.overscrollBehavior = previous.rootOverscroll;
      body.style.overflow = previous.bodyOverflow;
      body.style.overscrollBehavior = previous.bodyOverscroll;
    };
  }, []);

  return (
    <div
      className={settingsClosing ? "settings-backdrop closing" : "settings-backdrop"}
      onMouseDown={onClose}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={modalRef}
        className={`${exerciseUnitsExpanded ? "settings-modal units-expanded" : "settings-modal"} ui-panel`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          if (!(event.target instanceof Element)) return;
          if (event.target.closest(".setting-subhead")) onToggleExerciseUnits();
          if (event.target.closest(".settings-nav button, .settings-mobile-tabs button")) haptic(6);
        }}
      >
        <SettingsNavigation
          isAdmin={isAdmin}
          settingsTabsAtEnd={settingsTabsAtEnd}
          settingsTabsRef={settingsTabsRef}
          settingsView={settingsView}
          onScrollSettingsTabs={onScrollSettingsTabs}
          onSettingsViewChange={onSettingsViewChange}
          onShowMoreSettings={() => {
            haptic(6);
            onShowMoreSettings();
          }}
        />
        <div className="settings-content">
          <div className="settings-title-row">
            <div className="settings-title-copy">
              <span className="settings-kicker">TRACK II</span>
              <div className="settings-heading" key={settingsView}>
                <h2 id="settings-title">{SETTINGS_LABELS[settingsView]}</h2>
                <span>v{TRACK_VERSION}</span>
              </div>
            </div>
            <button
              type="button"
              className="settings-close ui-button ui-button-quiet"
              onPointerDown={(event) => {
                event.stopPropagation();
                onClose();
              }}
              onClick={onClose}
              aria-label="Close settings"
            >
              ×
            </button>
          </div>
          <div className={`settings-view view-${settingsView}`} key={settingsView}>
            <Suspense fallback={<SettingsScreenSkeleton />}>
              <SettingsViewContent />
            </Suspense>
            {settingsView === "admin" && isAdmin && (
              <Suspense fallback={<AdminToolsSkeleton />}>
                <AdminMemberViewer />
              </Suspense>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
