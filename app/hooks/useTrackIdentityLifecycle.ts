import { useEffect, useRef } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../supabase";
import { fetchDashboardSummary, fetchRecentRankTasks, fetchTrackRevision } from "../data/trackApi";
import type { DashboardSummary } from "../dashboardSummary";
import { TRACK_LIMITS, USERNAME_PATTERN } from "../trackConstants";
import { parsedPersonalInfo } from "../trackUtils";
import type { UseTrackAppLifecycleOptions } from "./trackLifecycleTypes";

const dashboardSummaryCache = new Map<string, DashboardSummary>();
const dashboardSummaryRevisionCache = new Map<string, number>();

function verifiedAdminRole(user: User | null) {
  return user?.app_metadata?.role === "admin" || user?.app_metadata?.is_admin === true;
}

export function useTrackIdentityLifecycle({
  user,
  showDashboard,
  showRank,
  identity,
  rank,
  refs,
}: UseTrackAppLifecycleOptions) {
  const {
    setAuthLoading,
    setAuthMessage,
    setUser,
    setUsernamePromptOpen,
    setUsernameInput,
    setUsernameMessage,
    setPersonalInfo,
    setPersonalHeightInput,
    setPersonalWeightInput,
    setPersonalInfoPromptOpen,
    setPersonalInfoMessage,
    setAdminAuthorized,
  } = identity;
  const { rankHistoryVersion, setDashboardSummary, setRankHistoryTasks } = rank;
  const { activeUserIdRef, openPasswordResetRef, clearAccountClientStateRef } = refs;
  const loadedDataUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const adoptSessionUser = (nextUser: User | null, event = "INITIAL_SESSION") => {
      const previousUserId = activeUserIdRef.current;
      const nextUserId = nextUser?.id ?? null;

      // Initial session hydration is not an account switch. Keep the
      // locally persisted timer alive until cloud preferences reconcile it.
      // Clearing here made refreshes appear to randomly reset a running
      // stopwatch or rest timer.
      if (previousUserId && previousUserId !== nextUserId) clearAccountClientStateRef.current(previousUserId);
      activeUserIdRef.current = nextUserId;
      setUser(nextUser);
      if (nextUser) setAuthMessage("");
      else if (previousUserId && event === "SIGNED_OUT")
        setAuthMessage("Your session ended. Sign in again—your saved workout data is still safe.");
      setAdminAuthorized(verifiedAdminRole(nextUser));
      setAuthLoading(false);
    };
    supabase.auth
      .getSession()
      .then(({ data }) => {
        adoptSessionUser(data.session?.user ?? null);
        if (window.location.hash.includes("type=recovery")) openPasswordResetRef.current();
      })
      .catch(() => adoptSessionUser(null));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      adoptSessionUser(session?.user ?? null, event);
      if (event === "PASSWORD_RECOVERY") openPasswordResetRef.current();
    });
    return () => data.subscription.unsubscribe();
  }, [
    activeUserIdRef,
    clearAccountClientStateRef,
    openPasswordResetRef,
    setAdminAuthorized,
    setAuthLoading,
    setAuthMessage,
    setUser,
  ]);

  useEffect(() => {
    if (!user) return;
    const existing = String(user.user_metadata?.username ?? "").trim();
    const hasValidUsername = USERNAME_PATTERN.test(existing);
    if (hasValidUsername) {
      setUsernamePromptOpen(false);
      return;
    }
    setUsernameInput(
      user.email
        ?.split("@")[0]
        ?.replace(/[^a-zA-Z0-9_.-]/g, "")
        .slice(0, TRACK_LIMITS.maxUsernameChars) ?? "",
    );
    setUsernameMessage("");
    setUsernamePromptOpen(true);
  }, [setUsernameInput, setUsernameMessage, setUsernamePromptOpen, user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const checkUsername = async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled || !data.user) return;
      const existing = String(data.user.user_metadata?.username ?? "").trim();
      if (!USERNAME_PATTERN.test(existing)) {
        setUsernameInput(
          (current) =>
            current ||
            data.user.email
              ?.split("@")[0]
              ?.replace(/[^a-zA-Z0-9_.-]/g, "")
              .slice(0, TRACK_LIMITS.maxUsernameChars) ||
            "",
        );
        setUsernamePromptOpen(true);
      }
    };
    const timeout = window.setTimeout(() => {
      void checkUsername();
    }, TRACK_LIMITS.usernameCheckDebounceMs);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [setUsernameInput, setUsernamePromptOpen, user]);

  useEffect(() => {
    if (!user) {
      setPersonalInfo(null);
      setPersonalInfoPromptOpen(false);
      return;
    }
    let cancelled = false;
    const loadPersonalInfo = async () => {
      const metadataInfo = parsedPersonalInfo(user.user_metadata?.height_cm, user.user_metadata?.weight_kg);
      if (metadataInfo) {
        if (!cancelled) {
          setPersonalInfo(metadataInfo);
          setPersonalHeightInput(String(metadataInfo.heightCm));
          setPersonalWeightInput(String(metadataInfo.weightKg));
          setPersonalInfoPromptOpen(false);
        }
        return;
      }
      const profileResult = await supabase
        .from("profiles")
        .select("height_cm,weight_kg")
        .eq("user_id", user.id)
        .maybeSingle();
      const profileInfo = !profileResult.error
        ? parsedPersonalInfo(profileResult.data?.height_cm, profileResult.data?.weight_kg)
        : null;
      if (cancelled) return;
      if (profileInfo) {
        setPersonalInfo(profileInfo);
        setPersonalHeightInput(String(profileInfo.heightCm));
        setPersonalWeightInput(String(profileInfo.weightKg));
        setPersonalInfoPromptOpen(false);
        const { data } = await supabase.auth.updateUser({
          data: { height_cm: profileInfo.heightCm, weight_kg: profileInfo.weightKg },
        });
        if (!cancelled && data.user) setUser(data.user);
        return;
      }
      setPersonalInfo(null);
      setPersonalInfoMessage("");
      setPersonalInfoPromptOpen(true);
    };
    void loadPersonalInfo();
    return () => {
      cancelled = true;
    };
  }, [
    setPersonalHeightInput,
    setPersonalInfo,
    setPersonalInfoMessage,
    setPersonalInfoPromptOpen,
    setPersonalWeightInput,
    setUser,
    user,
  ]);

  useEffect(() => {
    if (!user || (!showRank && !showDashboard)) {
      if (!user) {
        loadedDataUserIdRef.current = null;
        setDashboardSummary(null);
        setRankHistoryTasks([]);
      }
      return;
    }
    let cancelled = false;
    const loadRankAndDashboardData = async () => {
      if (loadedDataUserIdRef.current !== user.id) {
        loadedDataUserIdRef.current = user.id;
        setDashboardSummary(null);
        setRankHistoryTasks([]);
      }

      const cachedRevision = dashboardSummaryRevisionCache.get(user.id);
      const cached =
        cachedRevision === undefined ? undefined : dashboardSummaryCache.get(`${user.id}:${cachedRevision}`);
      if (showDashboard && cached) setDashboardSummary(cached);

      let refreshSummary = showDashboard && !cached;
      if (showDashboard && cached) {
        const revision = await fetchTrackRevision(user.id);
        if (cancelled) return;
        refreshSummary = revision === null || revision !== cached.revision;
      }

      const [history, summary] = await Promise.all([
        fetchRecentRankTasks(user.id, TRACK_LIMITS.rankHistoryDays),
        refreshSummary ? fetchDashboardSummary() : Promise.resolve(cached ?? null),
      ]);
      if (cancelled) return;
      setRankHistoryTasks(history);
      if (showDashboard && summary) {
        dashboardSummaryCache.set(`${user.id}:${summary.revision}`, summary);
        dashboardSummaryRevisionCache.set(user.id, summary.revision);
        setDashboardSummary(summary);
      }
    };
    void loadRankAndDashboardData();
    return () => {
      cancelled = true;
    };
  }, [rankHistoryVersion, setDashboardSummary, setRankHistoryTasks, showDashboard, showRank, user]);
}
