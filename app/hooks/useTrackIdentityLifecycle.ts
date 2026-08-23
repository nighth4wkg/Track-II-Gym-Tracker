import { useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../supabase";
import { fetchRecentRankTasks } from "../data/trackApi";
import { TRACK_LIMITS, USERNAME_PATTERN } from "../trackConstants";
import { parsedPersonalInfo } from "../trackUtils";
import type { UseTrackAppLifecycleOptions } from "./trackLifecycleTypes";

export function useTrackIdentityLifecycle({ user, showRank, identity, rank, refs }: UseTrackAppLifecycleOptions) {
  const {
    setAuthLoading,
    setUser,
    setUsernamePromptOpen,
    setUsernameInput,
    setUsernameMessage,
    setPersonalInfo,
    setPersonalHeightInput,
    setPersonalWeightInput,
    setPersonalInfoPromptOpen,
    setPersonalInfoMessage,
  } = identity;
  const { rankHistoryVersion, setRankHistoryTasks } = rank;
  const { activeUserIdRef, openPasswordResetRef, clearAccountClientStateRef } = refs;

  useEffect(() => {
    const adoptSessionUser = (nextUser: User | null) => {
      const previousUserId = activeUserIdRef.current;
      const nextUserId = nextUser?.id ?? null;

      // Initial session hydration is not an account switch. Keep the
      // locally persisted timer alive until cloud preferences reconcile it.
      // Clearing here made refreshes appear to randomly reset a running
      // stopwatch or rest timer.
      if (previousUserId && previousUserId !== nextUserId) clearAccountClientStateRef.current(previousUserId);
      activeUserIdRef.current = nextUserId;
      setUser(nextUser);
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
      adoptSessionUser(session?.user ?? null);
      if (event === "PASSWORD_RECOVERY") openPasswordResetRef.current();
    });
    return () => data.subscription.unsubscribe();
  }, [activeUserIdRef, clearAccountClientStateRef, openPasswordResetRef, setAuthLoading, setUser]);

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
    if (!user || !showRank) return;
    let cancelled = false;
    void fetchRecentRankTasks(user.id).then((history) => {
      if (!cancelled) setRankHistoryTasks(history);
    });
    return () => {
      cancelled = true;
    };
  }, [rankHistoryVersion, setRankHistoryTasks, showRank, user]);
}
