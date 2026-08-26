"use client";

import type { Dispatch, SetStateAction } from "react";
import { normalizeSettingsView, SETTINGS_CONTENT_VIEWS } from "../trackConstants";
import type {
  AiExercise,
  Checklist,
  SettingsView,
  Task,
  ThemeMode,
  UpdatesViewStatus,
  WeightUnit,
} from "../trackTypes";
import { useSettingsContext } from "../contexts/SettingsContext";
import { SettingsAiImportView } from "./SettingsAiImportView";
import { SettingsAboutView, SettingsAdminView, SettingsUpdatesView } from "./SettingsSpecialViews";
import { SettingsStandardViews } from "./SettingsStandardViews";

type NotificationState = NotificationPermission | "unsupported";
type ExportFormat = "csv" | "json";

export type SettingsViewContentProps = {
  active: Checklist | null;
  aiBusy: boolean;
  aiError: string;
  aiExercises: AiExercise[];
  aiKey: string;
  announcementComposerOpen: boolean;
  announcementSendBusy: boolean;
  announcementSendMessage: string;
  announcementText: string;
  completionEnabled: boolean;
  defaultUnit: WeightUnit;
  exportBusy: ExportFormat | null;
  exportMessage: string;
  isAdmin: boolean;
  nativeApp: boolean;
  notificationMessage: string;
  notificationPermission: NotificationState;
  notificationRequestBusy: boolean;
  notificationSettingsAvailable: boolean;
  personalHeightInput: string;
  personalInfoMessage: string;
  personalInfoSaving: boolean;
  personalWeightInput: string;
  releaseAvailable: boolean;
  rememberExercisesAcrossSplits: boolean;
  settingsView: SettingsView;
  syncProgressPreview: { exerciseCount: number; splitCount: number };
  tasks: Task[];
  themeMode: ThemeMode;
  updateCheckBusy: boolean;
  updateCheckMessage: string;
  updateVersion: string | null;
  updatesViewBusy: boolean;
  updatesViewStatus: UpdatesViewStatus;
  updatesViewMessage: string;
  onAddAiExercises: () => void;
  onAiExercisesChange: Dispatch<SetStateAction<AiExercise[]>>;
  onAiKeyChange: (value: string) => void;
  onApplyExerciseUnit: (taskId: string, unit: WeightUnit) => void;
  onApplyGlobalUnit: (unit: WeightUnit) => void;
  onApplyTheme: (mode: ThemeMode) => void;
  onCheckForUpdates: () => Promise<void>;
  onCompletionEnabledChange: (enabled: boolean) => void;
  onExportWorkoutData: (format: ExportFormat) => Promise<void>;
  onFakeUpdateNotification: () => void;
  onForceUpdateCheck: () => void;
  onImportWorkoutImage: (file?: File) => Promise<void>;
  onNotificationRequest: () => Promise<void>;
  onPersonalHeightChange: (value: string) => void;
  onPersonalWeightChange: (value: string) => void;
  onRememberExercisesChange: (enabled: boolean) => void;
  onSendAnnouncement: () => Promise<void>;
  onSetAdminAnnouncementOpen: (open: boolean) => void;
  onSetAnnouncementText: (value: string) => void;
  onSetSignOutConfirm: () => void;
  onSavePersonalInfo: () => Promise<void>;
  onSyncExerciseProgress: () => { exerciseCount: number; splitCount: number };
};

export function SettingsViewContent(props: SettingsViewContentProps) {
  const { isAdmin } = props;
  const settingsView = normalizeSettingsView(props.settingsView, isAdmin);
  const safeProps = settingsView === props.settingsView ? props : { ...props, settingsView };

  if (settingsView === "updates") return <SettingsUpdatesView {...safeProps} />;
  if (settingsView === "ai") return <SettingsAiImportView {...safeProps} />;
  if (SETTINGS_CONTENT_VIEWS.includes(settingsView)) return <SettingsStandardViews {...safeProps} />;
  if (settingsView === "about") return <SettingsAboutView />;
  if (settingsView === "admin" && isAdmin) return <SettingsAdminView {...safeProps} />;

  return <SettingsStandardViews {...safeProps} />;
}

export function ConnectedSettingsViewContent() {
  return <SettingsViewContent {...useSettingsContext()} />;
}
