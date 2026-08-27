import type { SettingsViewContentProps } from "./SettingsViewContent";
import type { useIdentityState } from "../hooks/useIdentityState";
import type { useSettingsState } from "../hooks/useSettingsState";
import type { useTrackAccountActions } from "../hooks/useTrackAccountActions";
import type { useTrackAppInteractions } from "../hooks/useTrackAppInteractions";
import type { useTrackExportActions } from "../hooks/useTrackExportActions";
import type { useWorkoutEditorController } from "../hooks/useWorkoutEditorController";
import type { useWorkoutImportActions } from "../hooks/useWorkoutImportActions";
import type { Checklist } from "../trackTypes";
import type { AppLocalState } from "../trackAppViewTypes";
import { haptic } from "../haptics";
import type { ExerciseProgressSyncPreview } from "../exerciseProgress";

type CreateSettingsContextOptions = {
  active: Checklist | null;
  tasks: Checklist["tasks"];
  syncProgressPreview: ExerciseProgressSyncPreview;
  isAdmin: boolean;
  nativeApp: boolean;
  releaseAvailable: boolean;
  updateVersion: string;
  identity: ReturnType<typeof useIdentityState>;
  settings: ReturnType<typeof useSettingsState>;
  local: AppLocalState;
  accountActions: ReturnType<typeof useTrackAccountActions>;
  exportActions: ReturnType<typeof useTrackExportActions>;
  importActions: ReturnType<typeof useWorkoutImportActions>;
  interactions: ReturnType<typeof useTrackAppInteractions>;
  workoutEditor: ReturnType<typeof useWorkoutEditorController>;
};

export function createSettingsContextValue({
  active,
  tasks,
  syncProgressPreview,
  isAdmin,
  nativeApp,
  releaseAvailable,
  updateVersion,
  identity,
  settings,
  local,
  accountActions,
  exportActions,
  importActions,
  interactions,
  workoutEditor,
}: CreateSettingsContextOptions): SettingsViewContentProps {
  return {
    active,
    aiBusy: local.aiBusy,
    aiError: local.aiError,
    aiExercises: local.aiExercises,
    aiKey: local.aiKey,
    announcementComposerOpen: settings.announcementComposerOpen,
    announcementSendBusy: settings.announcementSendBusy,
    announcementSendMessage: settings.announcementSendMessage,
    announcementText: settings.announcementText,
    completionEnabled: settings.completionEnabled,
    defaultUnit: settings.defaultUnit,
    deleteAccountBusy: settings.deleteAccountBusy,
    deleteAccountMessage: settings.deleteAccountMessage,
    exportBusy: local.exportBusy,
    exportMessage: local.exportMessage,
    isAdmin,
    nativeApp,
    notificationMessage: settings.notificationMessage,
    notificationPermission: settings.notificationPermission,
    notificationRequestBusy: settings.notificationRequestBusy,
    notificationSettingsAvailable: settings.notificationSettingsAvailable,
    personalHeightInput: identity.personalHeightInput,
    personalInfoMessage: identity.personalInfoMessage,
    personalInfoSaving: identity.personalInfoSaving,
    personalWeightInput: identity.personalWeightInput,
    releaseAvailable,
    rememberExercisesAcrossSplits: settings.rememberExercisesAcrossSplits,
    settingsView: settings.settingsView,
    syncProgressPreview,
    tasks,
    themeMode: settings.themeMode,
    updateCheckBusy: identity.updateCheckBusy,
    updateCheckMessage: identity.updateCheckMessage,
    updateVersion,
    updatesViewBusy: identity.updatesViewBusy,
    updatesViewStatus: identity.updatesViewStatus,
    updatesViewMessage: identity.updatesViewMessage,
    onAddAiExercises: importActions.addAiExercises,
    onAiExercisesChange: local.setAiExercises,
    onAiKeyChange: local.setAiKey,
    onApplyExerciseUnit: workoutEditor.applyExerciseUnit,
    onApplyGlobalUnit: workoutEditor.applyGlobalUnit,
    onApplyTheme: interactions.applyTheme,
    onCheckForUpdates: interactions.checkForUpdatesFromSettings,
    onCompletionEnabledChange: settings.setCompletionEnabled,
    onSetDeleteAccountConfirm: () => {
      haptic(10);
      settings.setDeleteAccountMessage("");
      settings.setDeleteAccountConfirm(true);
    },
    onExportWorkoutData: exportActions.exportWorkoutData,
    onFakeUpdateNotification: interactions.showFakeUpdateNotification,
    onForceUpdateCheck: () => {
      haptic(10);
      void local.siteUpdateCheckRef.current?.(true);
    },
    onImportWorkoutImage: importActions.importWorkoutImage,
    onNotificationRequest: interactions.requestNotifications,
    onPersonalHeightChange: identity.setPersonalHeightInput,
    onPersonalWeightChange: identity.setPersonalWeightInput,
    onRememberExercisesChange: settings.setRememberExercisesAcrossSplits,
    onSendAnnouncement: interactions.sendAnnouncement,
    onSetAdminAnnouncementOpen: settings.setAnnouncementComposerOpen,
    onSetAnnouncementText: settings.setAnnouncementText,
    onSetSignOutConfirm: () => {
      haptic(10);
      settings.setSignOutConfirm(true);
    },
    onSavePersonalInfo: accountActions.savePersonalInfo,
    onSyncExerciseProgress: workoutEditor.syncLatestProgressAcrossSplits,
  };
}
