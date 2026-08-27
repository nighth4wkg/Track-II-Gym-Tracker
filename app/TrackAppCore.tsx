"use client";

import { Capacitor } from "@capacitor/core";
import { AppLoadingSkeleton } from "./components/LoadingSkeletons";
import { AuthScreen } from "./components/AuthScreen";
import { TrackAppView } from "./components/TrackAppView";
import { useIdentityState } from "./hooks/useIdentityState";
import { useWorkoutState } from "./hooks/useWorkoutState";
import { useSettingsState } from "./hooks/useSettingsState";
import { useNavigationState } from "./hooks/useNavigationState";
import { useRankCalendarState } from "./hooks/useRankCalendarState";
import { useTimerState } from "./hooks/useTimerState";
import { useTrackAppRuntime } from "./hooks/useTrackAppRuntime";

export default function TrackApp() {
  const nativeApp = Capacitor.isNativePlatform();
  const identityState = useIdentityState();
  const workoutState = useWorkoutState();
  const settingsState = useSettingsState();
  const navigationState = useNavigationState();
  const rankState = useRankCalendarState();
  const timerState = useTimerState();
  const runtime = useTrackAppRuntime({
    nativeApp,
    identityState,
    workoutState,
    settingsState,
    navigationState,
    rankState,
    timerState,
  });

  if (runtime.authLoading) return <AppLoadingSkeleton />;
  if (!identityState.user) return <AuthScreen initialMessage={identityState.authMessage} />;

  return (
    <TrackAppView
      active={runtime.active}
      controllers={runtime.controllers}
      local={runtime.local}
      nativeApp={nativeApp}
      state={{
        identity: identityState,
        workout: workoutState,
        settings: settingsState,
        navigation: navigationState,
        rank: rankState,
        timer: timerState,
      }}
      tasks={runtime.tasks}
    />
  );
}
