import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { User } from "@supabase/supabase-js";
import type { TimerMode } from "../components/TimerScreen";
import { supabase } from "../supabase";
import { TRACK_TIMING, TRACK_UI_COPY } from "../trackConstants";
import type { EquipmentType } from "../rankTypes";
import type { TimerRuntimeState, TrackPreferences } from "../trackTypes";
import {
  accountMetadataSignature,
  normalizePreferences,
  parsedRankEquipmentOverrides,
  preferencesSignature,
  promiseWithTimeout,
  rankEquipmentOverridesSignature,
  restMinutesInputFromSeconds,
} from "../trackUtils";

type RankEquipmentOverrides = Record<string, EquipmentType>;

type UseTrackPreferenceSyncOptions = {
  user: User | null;
  defaultUnit: TrackPreferences["defaultUnit"];
  timerMode: TimerMode;
  timerRunning: boolean;
  timerRuntime: TimerRuntimeState;
  restSeconds: number;
  restCustom: boolean;
  rememberExercisesAcrossSplits: boolean;
  completionEnabled: boolean;
  syncRealtimeConnected: MutableRefObject<boolean>;
  applyTimerRuntime: (runtime: TimerRuntimeState) => void;
  reportSyncStatus: (label: string, settleToSaved?: boolean) => void;
  broadcastPreferences: (preferences: TrackPreferences) => void;
  setDefaultUnit: Dispatch<SetStateAction<TrackPreferences["defaultUnit"]>>;
  setTimerMode: Dispatch<SetStateAction<TimerMode>>;
  setRestSeconds: Dispatch<SetStateAction<number>>;
  setRestCustom: Dispatch<SetStateAction<boolean>>;
  setCustomRestInput: Dispatch<SetStateAction<string>>;
  setRestRemaining: Dispatch<SetStateAction<number>>;
  setRememberExercisesAcrossSplits: Dispatch<SetStateAction<boolean>>;
  setCompletionEnabled: Dispatch<SetStateAction<boolean>>;
  setRankEquipmentOverrides: Dispatch<SetStateAction<RankEquipmentOverrides>>;
  setUser: Dispatch<SetStateAction<User | null>>;
};

export function useTrackPreferenceSync({
  user,
  defaultUnit,
  timerMode,
  timerRunning,
  timerRuntime,
  restSeconds,
  restCustom,
  rememberExercisesAcrossSplits,
  completionEnabled,
  syncRealtimeConnected,
  applyTimerRuntime,
  reportSyncStatus,
  broadcastPreferences,
  setDefaultUnit,
  setTimerMode,
  setRestSeconds,
  setRestCustom,
  setCustomRestInput,
  setRestRemaining,
  setRememberExercisesAcrossSplits,
  setCompletionEnabled,
  setRankEquipmentOverrides,
  setUser,
}: UseTrackPreferenceSyncOptions) {
  const preferenceSaveTimer = useRef<number | null>(null);
  const preferenceSaveGeneration = useRef(0);
  const preferenceSaveAttempt = useRef(0);
  const lastSavedPreferencesSignature = useRef("");
  const preferencesLoadedFor = useRef("");
  const applyingCloudPreferences = useRef(false);
  const preferencesRef = useRef<TrackPreferences>({
    defaultUnit,
    timerMode,
    restSeconds,
    restCustom,
    rememberExercisesAcrossSplits,
    completionEnabled,
    timerRuntime,
  });
  const timerRunningRef = useRef(timerRunning);
  const timerRuntimeRef = useRef(timerRuntime);

  useEffect(() => {
    timerRunningRef.current = timerRunning;
    timerRuntimeRef.current = timerRuntime;
  }, [timerRunning, timerRuntime]);

  const applyIncomingPreferences = useCallback(
    (incomingPreferences: TrackPreferences) => {
      const incomingSignature = preferencesSignature(incomingPreferences);
      const incomingRuntime = incomingPreferences.timerRuntime;
      const useIncomingRuntime = Boolean(
        incomingRuntime && incomingRuntime.updatedAt >= timerRuntimeRef.current.updatedAt,
      );
      const restoredRuntime = useIncomingRuntime && incomingRuntime ? incomingRuntime : timerRuntimeRef.current;
      const restoredMode =
        restoredRuntime.updatedAt > 0 && restoredRuntime.mode ? restoredRuntime.mode : incomingPreferences.timerMode;
      const preferences: TrackPreferences = {
        ...incomingPreferences,
        timerMode: restoredMode,
        timerRuntime: restoredRuntime,
      };
      if (preferencesSignature(preferences) === preferencesSignature(preferencesRef.current)) {
        lastSavedPreferencesSignature.current = incomingSignature;
        return;
      }
      applyingCloudPreferences.current = true;
      lastSavedPreferencesSignature.current = incomingSignature;
      preferencesRef.current = preferences;
      setDefaultUnit(preferences.defaultUnit);
      setTimerMode(preferences.timerMode);
      setRestSeconds(preferences.restSeconds);
      setRestCustom(preferences.restCustom);
      setRememberExercisesAcrossSplits(preferences.rememberExercisesAcrossSplits);
      setCompletionEnabled(preferences.completionEnabled);
      if (preferences.restCustom) setCustomRestInput(restMinutesInputFromSeconds(preferences.restSeconds));
      if (restoredRuntime.updatedAt > 0) applyTimerRuntime(restoredRuntime);
      else if (!timerRunningRef.current && preferences.timerMode === "rest")
        setRestRemaining(preferences.restSeconds * 1000);
    },
    [
      applyTimerRuntime,
      setCompletionEnabled,
      setCustomRestInput,
      setDefaultUnit,
      setRememberExercisesAcrossSplits,
      setRestCustom,
      setRestRemaining,
      setRestSeconds,
      setTimerMode,
    ],
  );

  const resetPreferenceSync = useCallback(() => {
    preferenceSaveGeneration.current += 1;
    preferenceSaveAttempt.current = 0;
    lastSavedPreferencesSignature.current = "";
    preferencesLoadedFor.current = "";
    applyingCloudPreferences.current = false;
    if (preferenceSaveTimer.current !== null) window.clearTimeout(preferenceSaveTimer.current);
    preferenceSaveTimer.current = null;
  }, []);

  const isPreferenceSaveInFlight = useCallback(
    () => preferenceSaveTimer.current !== null || applyingCloudPreferences.current,
    [],
  );

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const loadPreferences = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (cancelled) return;
        if (error) {
          reportSyncStatus("Retrying…");
          return;
        }
        if (data.user) {
          const cloudEquipmentOverrides = parsedRankEquipmentOverrides(
            data.user.user_metadata?.rank_equipment_overrides,
          );
          setRankEquipmentOverrides((current) =>
            rankEquipmentOverridesSignature(current) === rankEquipmentOverridesSignature(cloudEquipmentOverrides)
              ? current
              : cloudEquipmentOverrides,
          );
          if (accountMetadataSignature(data.user.user_metadata) !== accountMetadataSignature(user.user_metadata))
            setUser(data.user);
        }
        preferencesLoadedFor.current = user.id;
        const incomingPreferences = normalizePreferences(data.user?.user_metadata?.track_preferences);
        if (incomingPreferences) applyIncomingPreferences(incomingPreferences);
      } catch {
        if (!cancelled) reportSyncStatus("Retrying…");
      }
    };
    void loadPreferences();
    const interval = window.setInterval(() => {
      if (!document.hidden && !syncRealtimeConnected.current) void loadPreferences();
    }, TRACK_TIMING.preferenceFallbackPollMs);
    const resume = () => {
      if (!document.hidden) void loadPreferences();
    };
    window.addEventListener("focus", resume);
    window.addEventListener("pageshow", resume);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", resume);
      window.removeEventListener("pageshow", resume);
    };
  }, [applyIncomingPreferences, reportSyncStatus, setRankEquipmentOverrides, setUser, syncRealtimeConnected, user]);

  useEffect(() => {
    if (!user || preferencesLoadedFor.current !== user.id) return;
    if (applyingCloudPreferences.current) {
      applyingCloudPreferences.current = false;
      return;
    }
    const preferences: TrackPreferences = {
      defaultUnit,
      timerMode,
      restSeconds,
      restCustom,
      rememberExercisesAcrossSplits,
      completionEnabled,
      timerRuntime,
    };
    const signature = preferencesSignature(preferences);
    preferencesRef.current = preferences;
    if (signature === lastSavedPreferencesSignature.current) return;
    if (preferenceSaveTimer.current !== null) window.clearTimeout(preferenceSaveTimer.current);
    const saveGeneration = preferenceSaveGeneration.current + 1;
    preferenceSaveGeneration.current = saveGeneration;
    preferenceSaveAttempt.current = 0;

    const persist = async () => {
      if (saveGeneration !== preferenceSaveGeneration.current || !user) return;
      preferenceSaveTimer.current = null;
      applyingCloudPreferences.current = false;
      try {
        const { error } = await promiseWithTimeout(
          supabase.auth.updateUser({ data: { track_preferences: preferences } }),
          TRACK_TIMING.cloudRequestTimeoutMs,
        );
        if (error) throw error;
        lastSavedPreferencesSignature.current = signature;
        preferenceSaveAttempt.current = 0;
        broadcastPreferences(preferences);
        reportSyncStatus("Saved", true);
      } catch {
        if (saveGeneration !== preferenceSaveGeneration.current) return;
        const attempt = preferenceSaveAttempt.current;
        preferenceSaveAttempt.current += 1;
        const retryDelay = Math.min(
          TRACK_TIMING.preferenceSaveRetryBaseMs * 2 ** attempt,
          TRACK_TIMING.preferenceSaveRetryMaxMs,
        );
        reportSyncStatus(TRACK_UI_COPY.status.savedLocally);
        preferenceSaveTimer.current = window.setTimeout(() => {
          void persist();
        }, retryDelay);
      }
    };

    preferenceSaveTimer.current = window.setTimeout(() => {
      void persist();
    }, TRACK_TIMING.preferenceSaveDebounceMs);
    return () => {
      if (preferenceSaveTimer.current !== null) {
        window.clearTimeout(preferenceSaveTimer.current);
        preferenceSaveTimer.current = null;
      }
      if (preferenceSaveGeneration.current === saveGeneration) preferenceSaveGeneration.current += 1;
    };
  }, [
    broadcastPreferences,
    completionEnabled,
    defaultUnit,
    rememberExercisesAcrossSplits,
    reportSyncStatus,
    restCustom,
    restSeconds,
    timerMode,
    timerRuntime,
    user,
  ]);

  return {
    preferencesRef,
    timerRunningRef,
    timerRuntimeRef,
    resetPreferenceSync,
    applyIncomingPreferences,
    isPreferenceSaveInFlight,
  };
}
