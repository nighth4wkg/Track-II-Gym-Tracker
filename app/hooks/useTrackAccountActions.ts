"use client";

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../supabase";
import { deleteTrackSnapshot } from "../offlineStore";
import type { EquipmentType, MuscleGroup } from "../rankTypes";
import type { RankTask } from "../rankData";
import type { TimerMode } from "../components/TimerScreen";
import { ACCOUNT_LOCAL_KEYS, TRACK_LIMITS, TRACK_TIMING, TRACK_UI_COPY, USERNAME_PATTERN } from "../trackConstants";
import type { Checklist, PersonalInfo, ReleaseSignal, TimerRuntimeState, TrackAnnouncement } from "../trackTypes";
import { accountStorageKey, parsedPersonalInfo, safeStorageRemove } from "../trackUtils";

type Setter<T> = Dispatch<SetStateAction<T>>;
type RankCategoryOverrides = Record<string, MuscleGroup>;
type RankEquipmentOverrides = Record<string, EquipmentType>;

type UseTrackAccountActionsOptions = {
  user: User | null;
  personalHeightInput: string;
  personalWeightInput: string;
  usernameInput: string;
  passwordResetValue: string;
  passwordResetConfirm: string;
  rankCategoryOverrides: RankCategoryOverrides;
  rankEquipmentOverrides: RankEquipmentOverrides;
  timerMode: TimerMode;
  restSeconds: number;
  setPersonalInfo: Setter<PersonalInfo | null>;
  setPersonalInfoSaving: Setter<boolean>;
  setPersonalInfoMessage: Setter<string>;
  setPersonalInfoPromptOpen: Setter<boolean>;
  setUser: Setter<User | null>;
  setUsernameMessage: Setter<string>;
  setUsernameSaving: Setter<boolean>;
  setUsernamePromptOpen: Setter<boolean>;
  setRankCategoryOverrides: Setter<RankCategoryOverrides>;
  setRankEquipmentOverrides: Setter<RankEquipmentOverrides>;
  setSyncLabel: Setter<string>;
  setPasswordResetBusy: Setter<boolean>;
  setPasswordResetMessage: Setter<string>;
  setPasswordResetValue: Setter<string>;
  setPasswordResetConfirm: Setter<string>;
  setPasswordResetOpen: Setter<boolean>;
  setAiKey: Setter<string>;
  timerStartedAtRef: MutableRefObject<number>;
  restEndsAtRef: MutableRefObject<number>;
  resetCloudSyncStateRef: MutableRefObject<() => void>;
  resetWorkoutDateSync: () => void;
  setTimerRunning: Setter<boolean>;
  setTimerElapsed: Setter<number>;
  setRestRemaining: Setter<number>;
  setTimerLaps: Setter<number[]>;
  setTimerRuntime: Setter<TimerRuntimeState>;
  setLists: Setter<Checklist[]>;
  setActiveId: Setter<string>;
  setCloudReady: Setter<boolean>;
  setAccountLocalReadyFor: Setter<string | null>;
  setSavedSplits: Setter<Set<string>>;
  setDirtySplits: Setter<Set<string>>;
  setFinishedSignatures: Setter<Record<string, string>>;
  setFinishedDates: Setter<Record<string, string>>;
  setRankHistoryTasks: Setter<RankTask[]>;
  setWorkoutDates: Setter<Set<string>>;
  setAdminAuthorized: Setter<boolean>;
  setAdminUsersOpen: Setter<boolean>;
  setSettingsOpen: Setter<boolean>;
  setSettingsClosing: Setter<boolean>;
  setNotificationPrompt: Setter<boolean>;
  setAnnouncement: Setter<TrackAnnouncement | null>;
  setUpdateReady: Setter<ReleaseSignal | null>;
  setAvailableUpdateVersion: Setter<string | null>;
  setSiteUpdateSeconds: Setter<number | null>;
  broadcastRankEquipmentOverrides: (overrides: RankEquipmentOverrides) => void;
};

export function useTrackAccountActions({
  user,
  personalHeightInput,
  personalWeightInput,
  usernameInput,
  passwordResetValue,
  passwordResetConfirm,
  rankCategoryOverrides,
  rankEquipmentOverrides,
  timerMode,
  restSeconds,
  setPersonalInfo,
  setPersonalInfoSaving,
  setPersonalInfoMessage,
  setPersonalInfoPromptOpen,
  setUser,
  setUsernameMessage,
  setUsernameSaving,
  setUsernamePromptOpen,
  setRankCategoryOverrides,
  setRankEquipmentOverrides,
  setSyncLabel,
  setPasswordResetBusy,
  setPasswordResetMessage,
  setPasswordResetValue,
  setPasswordResetConfirm,
  setPasswordResetOpen,
  setAiKey,
  timerStartedAtRef,
  restEndsAtRef,
  resetCloudSyncStateRef,
  resetWorkoutDateSync,
  setTimerRunning,
  setTimerElapsed,
  setRestRemaining,
  setTimerLaps,
  setTimerRuntime,
  setLists,
  setActiveId,
  setCloudReady,
  setAccountLocalReadyFor,
  setSavedSplits,
  setDirtySplits,
  setFinishedSignatures,
  setFinishedDates,
  setRankHistoryTasks,
  setWorkoutDates,
  setAdminAuthorized,
  setAdminUsersOpen,
  setSettingsOpen,
  setSettingsClosing,
  setNotificationPrompt,
  setAnnouncement,
  setUpdateReady,
  setAvailableUpdateVersion,
  setSiteUpdateSeconds,
  broadcastRankEquipmentOverrides,
}: UseTrackAccountActionsOptions) {
  async function savePersonalInfo() {
    const next = parsedPersonalInfo(personalHeightInput, personalWeightInput);
    if (!next) {
      setPersonalInfoMessage(
        `Enter a height from ${TRACK_LIMITS.minHeightCm}–${TRACK_LIMITS.maxHeightCm} cm and a bodyweight from ${TRACK_LIMITS.minWeightKg}–${TRACK_LIMITS.maxWeightKg} kg.`,
      );
      return;
    }
    setPersonalInfoSaving(true);
    setPersonalInfoMessage("");
    const { data, error } = await supabase.auth.updateUser({
      data: { height_cm: next.heightCm, weight_kg: next.weightKg },
    });
    if (error) {
      setPersonalInfoSaving(false);
      setPersonalInfoMessage(error.message || "Couldn’t save your personal information.");
      return;
    }
    if (user) {
      // Auth metadata is authoritative and immediately available on every
      // device. The profile copy remains best-effort for reporting.
      await supabase
        .from("profiles")
        .update({ height_cm: next.heightCm, weight_kg: next.weightKg })
        .eq("user_id", user.id);
    }
    setPersonalInfo(next);
    if (data.user) setUser(data.user);
    setPersonalInfoSaving(false);
    setPersonalInfoPromptOpen(false);
    setPersonalInfoMessage(TRACK_UI_COPY.status.saved);
  }

  async function saveUsername() {
    const normalized = usernameInput.trim().replace(/\s+/g, "");
    if (!USERNAME_PATTERN.test(normalized)) {
      setUsernameMessage("Use 2–24 letters, numbers, dots, underscores, or hyphens.");
      return;
    }
    setUsernameSaving(true);
    setUsernameMessage("");
    const { data, error } = await supabase.auth.updateUser({ data: { username: normalized } });
    setUsernameSaving(false);
    if (error) {
      setUsernameMessage(error.message || "Couldn’t save that username.");
      return;
    }
    if (data.user) setUser(data.user);
    setUsernamePromptOpen(false);
  }

  async function updateRankCategoryOverride(exerciseId: string, group: MuscleGroup | null) {
    const previous = rankCategoryOverrides;
    const next = { ...previous };
    if (group) next[exerciseId] = group;
    else delete next[exerciseId];
    setRankCategoryOverrides(next);
    const { data, error } = await supabase.auth.updateUser({ data: { rank_category_overrides: next } });
    if (error) {
      setRankCategoryOverrides(previous);
      setSyncLabel(TRACK_UI_COPY.status.retry);
      return;
    }
    if (data.user) setUser(data.user);
    setSyncLabel(TRACK_UI_COPY.status.saved);
  }

  async function updateRankEquipmentOverride(exerciseId: string, equipment: EquipmentType | null) {
    const previous = rankEquipmentOverrides;
    const next = { ...previous };
    if (equipment) next[exerciseId] = equipment;
    else delete next[exerciseId];
    setRankEquipmentOverrides(next);
    const { data, error } = await supabase.auth.updateUser({ data: { rank_equipment_overrides: next } });
    if (error) {
      setRankEquipmentOverrides(previous);
      setSyncLabel(TRACK_UI_COPY.status.retry);
      return;
    }
    if (data.user) setUser(data.user);
    broadcastRankEquipmentOverrides(next);
    setSyncLabel(TRACK_UI_COPY.status.saved);
  }

  async function savePasswordReset() {
    if (passwordResetValue.length < 6) {
      setPasswordResetMessage("Use at least 6 characters for your new password.");
      return;
    }
    if (passwordResetValue !== passwordResetConfirm) {
      setPasswordResetMessage("The passwords do not match.");
      return;
    }
    setPasswordResetBusy(true);
    setPasswordResetMessage("");
    const { error } = await supabase.auth.updateUser({ password: passwordResetValue });
    setPasswordResetBusy(false);
    if (error) {
      setPasswordResetMessage(error.message || "This reset link has expired. Request a new one and try again.");
      return;
    }
    setPasswordResetMessage("Password updated. You can keep using Track II.");
    setPasswordResetValue("");
    setPasswordResetConfirm("");
    window.setTimeout(() => setPasswordResetOpen(false), TRACK_TIMING.passwordResetCloseMs);
  }

  const openPasswordReset = useCallback(() => {
    setPasswordResetValue("");
    setPasswordResetConfirm("");
    setPasswordResetMessage("");
    setPasswordResetOpen(true);
    if (window.location.hash.includes("type=recovery"))
      window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
  }, [setPasswordResetConfirm, setPasswordResetMessage, setPasswordResetOpen, setPasswordResetValue]);

  const clearAccountClientState = useCallback(
    (userId?: string) => {
      if (userId) {
        for (const key of ACCOUNT_LOCAL_KEYS) safeStorageRemove(accountStorageKey(userId, key));
        void deleteTrackSnapshot(userId);
      }
      resetCloudSyncStateRef.current();
      resetWorkoutDateSync();
      setAiKey("");
      timerStartedAtRef.current = 0;
      restEndsAtRef.current = 0;
      setTimerRunning(false);
      setTimerElapsed(0);
      setRestRemaining(restSeconds * 1000);
      setTimerLaps([]);
      setTimerRuntime({
        mode: timerMode,
        running: false,
        elapsedMs: 0,
        startedAtMs: null,
        restRemainingMs: restSeconds * 1000,
        restEndsAtMs: null,
        laps: [],
        updatedAt: 0,
      });
      safeStorageRemove("track-timer-runtime");
      setLists([]);
      setActiveId("");
      setCloudReady(false);
      setAccountLocalReadyFor(null);
      setSavedSplits(new Set());
      setDirtySplits(new Set());
      setFinishedSignatures({});
      setFinishedDates({});
      setRankHistoryTasks([]);
      setWorkoutDates(new Set());
      setAdminAuthorized(false);
      setAdminUsersOpen(false);
      setSettingsOpen(false);
      setSettingsClosing(false);
      setNotificationPrompt(false);
      setAnnouncement(null);
      setUpdateReady(null);
      setAvailableUpdateVersion(null);
      setSiteUpdateSeconds(null);
    },
    [
      resetWorkoutDateSync,
      restSeconds,
      resetCloudSyncStateRef,
      setAccountLocalReadyFor,
      setActiveId,
      setAdminAuthorized,
      setAdminUsersOpen,
      setAiKey,
      setAnnouncement,
      setAvailableUpdateVersion,
      setCloudReady,
      setDirtySplits,
      setFinishedDates,
      setFinishedSignatures,
      setLists,
      setNotificationPrompt,
      setRankHistoryTasks,
      setRestRemaining,
      setSavedSplits,
      setSettingsClosing,
      setSettingsOpen,
      setSiteUpdateSeconds,
      setTimerElapsed,
      setTimerLaps,
      setTimerRunning,
      setTimerRuntime,
      setUpdateReady,
      setWorkoutDates,
      timerMode,
      timerStartedAtRef,
      restEndsAtRef,
    ],
  );

  return {
    savePersonalInfo,
    saveUsername,
    updateRankCategoryOverride,
    updateRankEquipmentOverride,
    savePasswordReset,
    openPasswordReset,
    clearAccountClientState,
  };
}
