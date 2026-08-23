import { useEffect } from "react";
import { applyAnimatedStyles, clearAnimatedStyles } from "../domMotion";
import {
  accountStorageKey,
  parsedRankCategoryOverrides,
  parsedRankEquipmentOverrides,
  parseStringArray,
  parseStringRecord,
  readNotificationPermission,
  safeStorageGet,
  safeStorageRemove,
} from "../trackUtils";
import type { UseTrackAppLifecycleOptions } from "./trackLifecycleTypes";

export function useTrackBootstrapLifecycle({
  user,
  local,
  identity,
  workout,
  settings,
  rank,
  refs,
}: UseTrackAppLifecycleOptions) {
  const { setReady } = local;
  const { setExerciseNames } = identity;
  const { setSidebarCollapsed, setMobileSidebarOpen } = workout;
  const {
    setThemeMode,
    setCompletionEnabled,
    setNotificationPermission,
    setNotificationPrompt,
    setSavedSplits,
    setDirtySplits,
    setFinishedSignatures,
    setFinishedDates,
    setAccountLocalReadyFor,
  } = settings;
  const { setRankCategoryOverrides, setRankEquipmentOverrides } = rank;
  const { savedSplitsRef, finishedSignaturesRef, finishedDatesRef, mobileOrientationRef } = refs;

  useEffect(() => {
    let mounted = true;
    void import("../exerciseCatalog").then(({ exerciseNames }) => {
      if (mounted) setExerciseNames(exerciseNames);
    });
    return () => {
      mounted = false;
    };
  }, [setExerciseNames]);

  useEffect(() => {
    // Remove the old unscoped cache. It could display one account's workout
    // data while a different account was signing in on the same device.
    safeStorageRemove("ironlog-splits");
    safeStorageRemove("ironlog-active-split");
    const savedTheme = safeStorageGet("quiet-checklist-theme");
    const mode = savedTheme === "light" ? "light" : "dark";
    setThemeMode(mode);
    document.documentElement.dataset.theme = mode;
    setSidebarCollapsed(safeStorageGet("ironlog-sidebar") === "collapsed");
    setCompletionEnabled(safeStorageGet("track-completion-enabled") === "true");
    setReady(true);
  }, [setCompletionEnabled, setReady, setSidebarCollapsed, setThemeMode]);

  useEffect(() => {
    const userId = user?.id ?? null;
    if (!userId) {
      setAccountLocalReadyFor(null);
      savedSplitsRef.current = new Set();
      finishedSignaturesRef.current = {};
      finishedDatesRef.current = {};
      setSavedSplits(new Set());
      setDirtySplits(new Set());
      setFinishedSignatures({});
      setFinishedDates({});
      return;
    }
    setAccountLocalReadyFor(null);
    const nextSaved = new Set(parseStringArray(safeStorageGet(accountStorageKey(userId, "saved-splits"))));
    const nextDirty = new Set(parseStringArray(safeStorageGet(accountStorageKey(userId, "dirty-splits"))));
    const nextFinishedSignatures = parseStringRecord(safeStorageGet(accountStorageKey(userId, "finished-signatures")));
    const nextFinishedDates = parseStringRecord(safeStorageGet(accountStorageKey(userId, "finished-dates")));
    savedSplitsRef.current = nextSaved;
    finishedSignaturesRef.current = nextFinishedSignatures;
    finishedDatesRef.current = nextFinishedDates;
    setSavedSplits(nextSaved);
    setDirtySplits(nextDirty);
    setFinishedSignatures(nextFinishedSignatures);
    setFinishedDates(nextFinishedDates);
    setAccountLocalReadyFor(userId);
  }, [
    finishedDatesRef,
    finishedSignaturesRef,
    savedSplitsRef,
    setAccountLocalReadyFor,
    setDirtySplits,
    setFinishedDates,
    setFinishedSignatures,
    setSavedSplits,
    user?.id,
  ]);

  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    const updateBottomInset = () => {
      if (!viewport || viewport.height < window.innerHeight * 0.75) {
        applyAnimatedStyles(root, { "--track-viewport-bottom-inset": "0px" });
        return;
      }
      const viewportGap = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      applyAnimatedStyles(root, { "--track-viewport-bottom-inset": `${Math.min(48, Math.round(viewportGap))}px` });
    };
    updateBottomInset();
    window.addEventListener("resize", updateBottomInset);
    window.addEventListener("orientationchange", updateBottomInset);
    viewport?.addEventListener("resize", updateBottomInset);
    viewport?.addEventListener("scroll", updateBottomInset);
    return () => {
      window.removeEventListener("resize", updateBottomInset);
      window.removeEventListener("orientationchange", updateBottomInset);
      viewport?.removeEventListener("resize", updateBottomInset);
      viewport?.removeEventListener("scroll", updateBottomInset);
      clearAnimatedStyles(root, ["--track-viewport-bottom-inset"]);
    };
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    const syncMobileOrientation = () => {
      if (!window.matchMedia("(max-width: 1200px)").matches) {
        mobileOrientationRef.current = null;
        setMobileSidebarOpen(false);
        return;
      }
      const nextOrientation = window.matchMedia("(orientation: landscape)").matches ? "landscape" : "portrait";
      if (mobileOrientationRef.current && mobileOrientationRef.current !== nextOrientation) setMobileSidebarOpen(false);
      mobileOrientationRef.current = nextOrientation;
    };

    syncMobileOrientation();
    window.addEventListener("orientationchange", syncMobileOrientation);
    window.addEventListener("resize", syncMobileOrientation, { passive: true });
    return () => {
      window.removeEventListener("orientationchange", syncMobileOrientation);
      window.removeEventListener("resize", syncMobileOrientation);
    };
  }, [mobileOrientationRef, setMobileSidebarOpen]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void readNotificationPermission().then((permission) => {
      if (cancelled) return;
      setNotificationPermission(permission);
      if (permission === "default" && safeStorageGet("track-notification-prompt") !== "dismissed")
        setNotificationPrompt(true);
    });
    return () => {
      cancelled = true;
    };
  }, [setNotificationPermission, setNotificationPrompt, user]);

  useEffect(() => {
    setRankCategoryOverrides(parsedRankCategoryOverrides(user?.user_metadata?.rank_category_overrides));
  }, [setRankCategoryOverrides, user?.id, user?.user_metadata?.rank_category_overrides]);

  useEffect(() => {
    setRankEquipmentOverrides(parsedRankEquipmentOverrides(user?.user_metadata?.rank_equipment_overrides));
  }, [setRankEquipmentOverrides, user?.id, user?.user_metadata?.rank_equipment_overrides]);
}
