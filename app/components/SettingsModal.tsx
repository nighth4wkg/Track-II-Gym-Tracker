"use client";

import { useEffect, useRef, type RefObject } from "react";
import { SettingsNavigation } from "./SettingsNavigation";
import { ConnectedSettingsViewContent } from "./SettingsViewContent";
import { haptic } from "../haptics";
import { normalizeSettingsView, SETTINGS_LABELS } from "../trackConstants";
import { TRACK_VERSION } from "../trackConfig";
import type { SettingsView } from "../trackTypes";
import { useModalFocus } from "../hooks/useModalFocus";

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
  const safeSettingsView = normalizeSettingsView(settingsView, isAdmin);
  useModalFocus({ open: true, containerRef: modalRef });

  useEffect(() => {
    if (safeSettingsView !== settingsView) onSettingsViewChange(safeSettingsView);
  }, [onSettingsViewChange, safeSettingsView, settingsView]);

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

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      settingsTabsRef.current?.querySelector<HTMLButtonElement>("button.active")?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [safeSettingsView, settingsTabsRef]);

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
          settingsView={safeSettingsView}
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
              <div className="settings-heading" key={safeSettingsView}>
                <h2 id="settings-title">{SETTINGS_LABELS[safeSettingsView]}</h2>
              </div>
            </div>
            <div className="settings-title-actions">
              <span className="settings-version-badge">v{TRACK_VERSION}</span>
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
          </div>
          <div className={`settings-view view-${safeSettingsView}`} key={safeSettingsView}>
            <ConnectedSettingsViewContent />
          </div>
        </div>
      </section>
    </div>
  );
}
