"use client";

import type { NotificationCenterProps } from "../components/NotificationCenter";
import type { IdentityState } from "./useIdentityState";
import { useNotificationCenter } from "./useNotificationCenter";
import type { TimerState } from "./useTimerState";
import type { useWorkoutDraftRecovery } from "./useWorkoutDraftRecovery";

export function useTrackAppNotifications(
  identity: IdentityState,
  timer: TimerState,
  workoutDraftRecovery: ReturnType<typeof useWorkoutDraftRecovery>,
): NotificationCenterProps {
  const center = useNotificationCenter({
    userId: identity.user?.id ?? null,
    syncLabel: identity.syncLabel,
    announcement: identity.announcement,
    draft: workoutDraftRecovery.notice?.draft ?? null,
    timerMode: timer.timerMode,
    timerRunning: timer.timerRunning,
    restRemaining: timer.restRemaining,
    timerRuntime: timer.timerRuntime,
  });

  return {
    items: center.items,
    unreadCount: center.unreadCount,
    open: center.open,
    onToggle: center.toggle,
    onClose: center.close,
    onMarkRead: center.markRead,
    onMarkAllRead: center.markAllRead,
    onDismiss: center.dismiss,
  };
}
