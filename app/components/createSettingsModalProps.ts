import type { RefObject } from "react";
import type { useSettingsState } from "../hooks/useSettingsState";
import { TRACK_TIMING } from "../trackConstants";

type SettingsModalPropOptions = {
  closeSettings: () => void;
  isAdmin: boolean;
  settings: ReturnType<typeof useSettingsState>;
  settingsTabsRef: RefObject<HTMLDivElement | null>;
};

export function createSettingsModalProps({
  closeSettings,
  isAdmin,
  settings,
  settingsTabsRef,
}: SettingsModalPropOptions) {
  const updateTabsEndState = () => {
    const element = settingsTabsRef.current;
    if (!element) return;
    settings.setSettingsTabsAtEnd(element.scrollLeft + element.clientWidth >= element.scrollWidth - 2);
  };

  return {
    exerciseUnitsExpanded: settings.exerciseUnitsExpanded,
    isAdmin,
    settingsClosing: settings.settingsClosing,
    settingsTabsAtEnd: settings.settingsTabsAtEnd,
    settingsTabsRef,
    settingsView: settings.settingsView,
    onClose: closeSettings,
    onScrollSettingsTabs: updateTabsEndState,
    onSettingsViewChange: settings.setSettingsView,
    onShowMoreSettings: () => {
      const element = settingsTabsRef.current;
      if (!element) return;
      const maxScroll = Math.max(0, element.scrollWidth - element.clientWidth);
      element.scrollTo({
        left: Math.min(maxScroll, element.scrollLeft + TRACK_TIMING.settingsTabsScrollStepPx),
        behavior: "smooth",
      });
      window.setTimeout(updateTabsEndState, TRACK_TIMING.settingsTabsScrollMs);
    },
    onToggleExerciseUnits: () => settings.setExerciseUnitsExpanded((expanded) => !expanded),
  };
}
