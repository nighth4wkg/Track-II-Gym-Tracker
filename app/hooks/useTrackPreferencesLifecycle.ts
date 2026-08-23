import { useEffect } from "react";
import { accountStorageKey, safeStorageSet } from "../trackUtils";
import type { UseTrackAppLifecycleOptions } from "./trackLifecycleTypes";

export function useTrackPreferencesLifecycle({
  user,
  workout,
  settings,
  timer,
  refs,
  updateSettingsTabsEdge,
}: UseTrackAppLifecycleOptions) {
  const { setFilter } = workout;
  const {
    settingsOpen,
    completionEnabled,
    defaultUnit,
    savedSplits,
    dirtySplits,
    finishedSignatures,
    finishedDates,
    accountLocalReadyFor,
    setSettingsTabsAtEnd,
  } = settings;
  const { timerMode, restSeconds, restCustom, timerRunning, timerRuntime, setRestRemaining } = timer;
  const { savedSplitsRef, finishedSignaturesRef, finishedDatesRef, settingsTabsRef } = refs;

  useEffect(() => {
    safeStorageSet("track-completion-enabled", String(completionEnabled));
    if (!completionEnabled) setFilter("all");
  }, [completionEnabled, setFilter]);

  useEffect(() => {
    safeStorageSet("track-weight-unit", defaultUnit);
  }, [defaultUnit]);

  useEffect(() => {
    safeStorageSet("track-timer-mode", timerMode);
    safeStorageSet("track-rest-seconds", String(restSeconds));
    safeStorageSet("track-rest-custom", String(restCustom));
    // A stopped rest timer can be intentionally paused with time remaining.
    // Only initialize an empty runtime; never overwrite a restored pause.
    if (timerMode === "rest" && !timerRunning && timerRuntime.updatedAt === 0) setRestRemaining(restSeconds * 1000);
  }, [restCustom, restSeconds, setRestRemaining, timerMode, timerRunning, timerRuntime.updatedAt]);

  useEffect(() => {
    savedSplitsRef.current = new Set(savedSplits);
    if (user?.id && accountLocalReadyFor === user.id)
      safeStorageSet(accountStorageKey(user.id, "saved-splits"), JSON.stringify([...savedSplits]));
  }, [accountLocalReadyFor, savedSplits, savedSplitsRef, user?.id]);

  useEffect(() => {
    if (user?.id && accountLocalReadyFor === user.id)
      safeStorageSet(accountStorageKey(user.id, "dirty-splits"), JSON.stringify([...dirtySplits]));
  }, [accountLocalReadyFor, dirtySplits, user?.id]);

  useEffect(() => {
    finishedSignaturesRef.current = finishedSignatures;
    if (user?.id && accountLocalReadyFor === user.id)
      safeStorageSet(accountStorageKey(user.id, "finished-signatures"), JSON.stringify(finishedSignatures));
  }, [accountLocalReadyFor, finishedSignatures, finishedSignaturesRef, user?.id]);

  useEffect(() => {
    finishedDatesRef.current = finishedDates;
    if (user?.id && accountLocalReadyFor === user.id)
      safeStorageSet(accountStorageKey(user.id, "finished-dates"), JSON.stringify(finishedDates));
  }, [accountLocalReadyFor, finishedDates, finishedDatesRef, user?.id]);

  useEffect(() => {
    if (!settingsOpen) {
      setSettingsTabsAtEnd(true);
      return;
    }
    const frame = window.requestAnimationFrame(updateSettingsTabsEdge);
    const element = settingsTabsRef.current;
    const observer = element ? new ResizeObserver(updateSettingsTabsEdge) : null;
    if (element) observer?.observe(element);
    window.addEventListener("resize", updateSettingsTabsEdge, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", updateSettingsTabsEdge);
    };
  }, [setSettingsTabsAtEnd, settingsOpen, settingsTabsRef, updateSettingsTabsEdge]);
}
