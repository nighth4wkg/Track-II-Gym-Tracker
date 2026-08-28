"use client";

import { Capacitor } from "@capacitor/core";
import { useCallback, useState, type ReactNode } from "react";
import { AppLoadingSkeleton } from "./components/LoadingSkeletons";
import { AuthScreen } from "./components/AuthScreen";
import { NativeLaunchIntro } from "./components/NativeLaunchIntro";
import { TrackAppView } from "./components/TrackAppView";
import { useIdentityState } from "./hooks/useIdentityState";
import { useWorkoutState } from "./hooks/useWorkoutState";
import { useSettingsState } from "./hooks/useSettingsState";
import { useNavigationState } from "./hooks/useNavigationState";
import { useRankCalendarState } from "./hooks/useRankCalendarState";
import { useTimerState } from "./hooks/useTimerState";
import { useTrackAppRuntime } from "./hooks/useTrackAppRuntime";
import { safeStorageGet, safeStorageSet } from "./trackUtils";

const NATIVE_INTRO_STORAGE_KEY = "track-native-intro-seen";

export default function TrackApp() {
  const nativeApp = Capacitor.isNativePlatform();
  const [nativeIntroVisible, setNativeIntroVisible] = useState(
    () => nativeApp && safeStorageGet(NATIVE_INTRO_STORAGE_KEY) !== "true",
  );
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

  const completeNativeIntro = useCallback(() => {
    safeStorageSet(NATIVE_INTRO_STORAGE_KEY, "true");
    setNativeIntroVisible(false);
  }, []);

  let content: ReactNode;
  if (runtime.authLoading) content = <AppLoadingSkeleton />;
  else if (!identityState.user) content = <AuthScreen initialMessage={identityState.authMessage} />;
  else {
    content = (
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

  return (
    <>
      <div
        className={nativeIntroVisible ? "track-app-underlay is-covered" : "track-app-underlay"}
        aria-hidden={nativeIntroVisible || undefined}
      >
        {content}
      </div>
      {nativeApp && nativeIntroVisible ? (
        <NativeLaunchIntro ready={!runtime.authLoading} onComplete={completeNativeIntro} />
      ) : null}
    </>
  );
}
