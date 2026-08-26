import type { ComponentProps } from "react";
import { supabase } from "../supabase";
import { haptic } from "../haptics";
import { safeStorageSet } from "../trackUtils";
import type { TrackAppViewProps } from "../trackAppViewTypes";
import type { AccountPromptModals } from "./AccountPromptModals";
import type { ActionModalOverlays } from "./ActionModalOverlays";
import type { AdminUsersPanel } from "./AdminUsersPanel";
import type { AnnouncementBanner } from "./AnnouncementBanner";
import type { UndoToast } from "./UndoToast";
import type { UpdateNotification } from "./UpdateNotification";

type OverlayOptions = {
  controllers: TrackAppViewProps["controllers"];
  debugUpdateVisible: boolean;
  local: TrackAppViewProps["local"];
  mobileSidebarOpen: boolean;
  nativeApp: boolean;
  sidebarCollapsed: boolean;
  state: TrackAppViewProps["state"];
  updateVersion: string;
};

export function createTrackAppOverlayProps(options: OverlayOptions) {
  const {
    controllers,
    debugUpdateVisible,
    local,
    mobileSidebarOpen,
    nativeApp,
    sidebarCollapsed,
    state,
    updateVersion,
  } = options;
  const { accountActions, interactions, undo } = controllers;
  const { identity, settings } = state;
  const isAdmin = identity.adminAuthorized;

  const accountPromptProps: ComponentProps<typeof AccountPromptModals> = {
    usernamePromptOpen: identity.usernamePromptOpen,
    usernameInput: identity.usernameInput,
    usernameMessage: identity.usernameMessage,
    usernameSaving: identity.usernameSaving,
    onUsernameInputChange: identity.setUsernameInput,
    onSaveUsername: accountActions.saveUsername,
    personalInfoPromptOpen: identity.personalInfoPromptOpen,
    personalHeightInput: identity.personalHeightInput,
    personalWeightInput: identity.personalWeightInput,
    personalInfoMessage: identity.personalInfoMessage,
    personalInfoSaving: identity.personalInfoSaving,
    onPersonalHeightChange: identity.setPersonalHeightInput,
    onPersonalWeightChange: identity.setPersonalWeightInput,
    onSavePersonalInfo: accountActions.savePersonalInfo,
    passwordResetOpen: settings.passwordResetOpen,
    passwordResetBusy: settings.passwordResetBusy,
    passwordResetValue: settings.passwordResetValue,
    passwordResetConfirm: settings.passwordResetConfirm,
    passwordResetMessage: settings.passwordResetMessage,
    onPasswordResetValueChange: settings.setPasswordResetValue,
    onPasswordResetConfirmChange: settings.setPasswordResetConfirm,
    onClosePasswordReset: () => settings.setPasswordResetOpen(false),
    onSavePasswordReset: accountActions.savePasswordReset,
  };
  const actionModalProps: ComponentProps<typeof ActionModalOverlays> = {
    pendingExerciseName: settings.pendingExerciseName,
    onCancelPendingExercise: () => settings.setPendingExerciseName(""),
    onConfirmPendingExercise: (name) => {
      settings.setPendingExerciseName("");
      interactions.addExercise(name);
    },
    signOutConfirm: settings.signOutConfirm,
    onCloseSignOut: () => settings.setSignOutConfirm(false),
    onSignOut: () => {
      haptic(18);
      settings.setSignOutConfirm(false);
      void supabase.auth.signOut({ scope: "local" });
    },
    notificationPrompt: settings.notificationPrompt,
    notificationRequestBusy: settings.notificationRequestBusy,
    onDismissNotification: () => {
      safeStorageSet("track-notification-prompt", "dismissed");
      settings.setNotificationPrompt(false);
    },
    onRequestNotifications: interactions.requestNotifications,
  };
  const announcementProps: ComponentProps<typeof AnnouncementBanner> | undefined = identity.announcement
    ? {
        announcement: identity.announcement,
        offset: identity.announcementOffset,
        dragStart: local.announcementDragStart,
        onOffsetChange: identity.setAnnouncementOffset,
        onDismiss: () => identity.setAnnouncement(null),
      }
    : undefined;
  const updateNotificationProps: ComponentProps<typeof UpdateNotification> | undefined =
    nativeApp && (identity.updateReady || debugUpdateVisible)
      ? {
          debug: debugUpdateVisible,
          isAdmin,
          nativeApp,
          updateVersion: debugUpdateVisible ? "" : updateVersion,
          onDismiss: () => {
            if (debugUpdateVisible) identity.setDebugUpdateNotification(false);
            else identity.setUpdateReady(null);
          },
        }
      : undefined;
  const adminUsersPanelProps: ComponentProps<typeof AdminUsersPanel> | undefined = isAdmin
    ? {
        open: settings.adminUsersOpen,
        onClose: () => settings.setAdminUsersOpen(false),
        currentUserId: identity.user?.id,
      }
    : undefined;
  const undoToastProps: ComponentProps<typeof UndoToast> | undefined = undo.undoNotice
    ? {
        notice: undo.undoNotice,
        sidebarCollapsed,
        mobileSidebarOpen,
        dragX: undo.undoDragX,
        dragging: undo.undoDragging,
        dismissDirection: undo.undoDismissDirection,
        onPointerDown: undo.beginUndoSwipe,
        onPointerMove: undo.moveUndoSwipe,
        onPointerUp: undo.finishUndoSwipe,
        onPointerCancel: undo.cancelUndoSwipe,
        onUndo: undo.performUndo,
      }
    : undefined;

  return {
    accountPromptProps,
    actionModalProps,
    adminUsersPanelProps,
    announcementProps,
    undoToastProps,
    updateNotificationProps,
  };
}
