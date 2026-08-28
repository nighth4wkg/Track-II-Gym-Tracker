"use client";

import { createPortal } from "react-dom";
import type { ComponentProps } from "react";
import { SettingsProvider } from "../contexts/SettingsContext";
import { AccountPromptModals } from "./AccountPromptModals";
import { ActionModalOverlays } from "./ActionModalOverlays";
import { AdminUsersPanel } from "./AdminUsersPanel";
import { AdminUsersButton } from "./AdminUsersDirectoryModels";
import { AnnouncementBanner } from "./AnnouncementBanner";
import { BottomTabBar } from "./BottomTabBar";
import { FinishWorkoutButton } from "./FinishWorkoutButton";
import { NotificationCenterPanel, NotificationCenterTrigger, type NotificationCenterProps } from "./NotificationCenter";
import { ScrollShortcuts } from "./ScrollShortcuts";
import { SyncConflictBanner } from "./SyncConflictBanner";
import { SettingsModal } from "./SettingsModal";
import { Sidebar } from "./Sidebar";
import { SplitMenu } from "./SplitMenu";
import { UndoToast } from "./UndoToast";
import { UpdateNotification } from "./UpdateNotification";
import { WorkspaceContent } from "./WorkspaceContent";
import { WorkoutDraftRecoveryModal } from "./WorkoutDraftRecoveryModal";
import type { ActivePage } from "../navigationPage";

type MainHandlers = Pick<
  ComponentProps<"main">,
  "onTouchStartCapture" | "onTouchEndCapture" | "onPointerDownCapture" | "onPointerCancelCapture" | "onClickCapture"
>;

export type TrackAppShellProps = {
  nativeApp: boolean;
  shellClassName: string;
  settingsOpen: boolean;
  mobileSidebarOpen: boolean;
  isAdmin: boolean;
  activePage: ActivePage;
  settingsContextValue: ComponentProps<typeof SettingsProvider>["value"];
  mainHandlers: MainHandlers;
  onOpenAdminUsers: () => void;
  onOpenMobileSidebar: () => void;
  accountPromptProps: ComponentProps<typeof AccountPromptModals>;
  announcementProps?: ComponentProps<typeof AnnouncementBanner>;
  updateNotificationProps?: ComponentProps<typeof UpdateNotification>;
  adminUsersPanelProps?: ComponentProps<typeof AdminUsersPanel>;
  sidebarProps: ComponentProps<typeof Sidebar>;
  workspaceProps: ComponentProps<typeof WorkspaceContent>;
  bottomTabProps: ComponentProps<typeof BottomTabBar>;
  scrollShortcutsProps: ComponentProps<typeof ScrollShortcuts>;
  splitMenuProps?: ComponentProps<typeof SplitMenu>;
  actionModalProps: ComponentProps<typeof ActionModalOverlays>;
  settingsModalProps: ComponentProps<typeof SettingsModal>;
  undoToastProps?: ComponentProps<typeof UndoToast>;
  workoutDraftRecoveryProps?: ComponentProps<typeof WorkoutDraftRecoveryModal>;
  notificationCenterProps: NotificationCenterProps;
};

export function TrackAppShell({
  nativeApp,
  shellClassName,
  settingsOpen,
  mobileSidebarOpen,
  isAdmin,
  activePage,
  settingsContextValue,
  mainHandlers,
  onOpenAdminUsers,
  onOpenMobileSidebar,
  accountPromptProps,
  announcementProps,
  updateNotificationProps,
  adminUsersPanelProps,
  sidebarProps,
  workspaceProps,
  bottomTabProps,
  scrollShortcutsProps,
  splitMenuProps,
  actionModalProps,
  settingsModalProps,
  undoToastProps,
  workoutDraftRecoveryProps,
  notificationCenterProps,
}: TrackAppShellProps) {
  const syncConflictVisible = /conflict|review changes/i.test(sidebarProps.headerStatus);
  return (
    <SettingsProvider value={settingsContextValue}>
      <main className={shellClassName} {...mainHandlers}>
        <AccountPromptModals {...accountPromptProps} />
        {workoutDraftRecoveryProps && <WorkoutDraftRecoveryModal {...workoutDraftRecoveryProps} />}
        {announcementProps && <AnnouncementBanner {...announcementProps} />}
        {updateNotificationProps && <UpdateNotification {...updateNotificationProps} />}
        {activePage === "workout" && !settingsOpen && !mobileSidebarOpen && workspaceProps.workoutActionsAvailable && (
          <div className={`desktop-finish-action${isAdmin ? " has-admin" : ""}`}>
            <FinishWorkoutButton
              className="header-finish-button"
              completionEnabled={workspaceProps.completionEnabled}
              openCount={workspaceProps.openCount}
              progressFading={workspaceProps.progressFading}
              workoutActionsExiting={workspaceProps.workoutActionsExiting}
              onFinishWorkout={workspaceProps.onFinishWorkout}
            />
          </div>
        )}
        {isAdmin && (
          <div className="admin-users-desktop-trigger">
            <AdminUsersButton onClick={onOpenAdminUsers} />
          </div>
        )}
        {adminUsersPanelProps?.open && <AdminUsersPanel {...adminUsersPanelProps} />}
        <Sidebar {...sidebarProps} />
        {syncConflictVisible && (
          <SyncConflictBanner onRetry={sidebarProps.onRetrySync} onUseCloudCopy={sidebarProps.onUseCloudCopy} />
        )}

        <section className="workspace">
          <header className="mobile-header">
            <div className="mobile-header-leading">
              <button
                type="button"
                className="mobile-menu-button"
                onClick={onOpenMobileSidebar}
                aria-label="Open sidebar"
                title="Open menu"
              >
                <span className="mobile-menu-glyph" aria-hidden="true">
                  ☰
                </span>
              </button>
              <button className="brand home-brand" onClick={sidebarProps.onGoHome} aria-label="Go to Track II home">
                <span className="brand-mark">
                  <span className="dumbbell-icon" />
                </span>
                <span>Track II</span>
                {!nativeApp && <small className="brand-beta">BETA</small>}
              </button>
            </div>
            <div className="mobile-actions">
              {activePage === "workout" &&
                !settingsOpen &&
                !mobileSidebarOpen &&
                workspaceProps.workoutActionsAvailable && (
                  <FinishWorkoutButton
                    className="header-finish-button"
                    completionEnabled={workspaceProps.completionEnabled}
                    openCount={workspaceProps.openCount}
                    progressFading={workspaceProps.progressFading}
                    workoutActionsExiting={workspaceProps.workoutActionsExiting}
                    onFinishWorkout={workspaceProps.onFinishWorkout}
                  />
                )}
              {isAdmin && <AdminUsersButton onClick={onOpenAdminUsers} />}
              <NotificationCenterTrigger
                unreadCount={notificationCenterProps.unreadCount}
                open={notificationCenterProps.open}
                onToggle={notificationCenterProps.onToggle}
              />
            </div>
          </header>
          <WorkspaceContent {...workspaceProps} />
        </section>

        {globalThis.document && createPortal(<BottomTabBar {...bottomTabProps} />, document.body)}
        {activePage === "workout" && !settingsOpen && !mobileSidebarOpen && (
          <ScrollShortcuts {...scrollShortcutsProps} />
        )}
        {splitMenuProps && <SplitMenu {...splitMenuProps} />}
        <ActionModalOverlays {...actionModalProps} />
        {settingsOpen && <SettingsModal {...settingsModalProps} />}
        {undoToastProps && <UndoToast {...undoToastProps} />}
        <NotificationCenterPanel {...notificationCenterProps} />
      </main>
    </SettingsProvider>
  );
}
