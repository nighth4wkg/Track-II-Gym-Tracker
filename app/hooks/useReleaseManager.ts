"use client";

import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { haptic } from "../haptics";
import { TRACK_BUILD_ID, TRACK_WEB_ORIGIN, isNewerTrackVersion } from "../trackConfig";
import {
  SITE_UPDATE_COUNTDOWN_SECONDS,
  SITE_UPDATE_POLL_MS,
  SITE_UPDATE_RELOAD_GUARD_KEY,
  TRACK_TIMING,
} from "../trackConstants";
import type { JsonValue, ReleaseSignal, RemoteRelease, UpdateCheckResult } from "../trackTypes";
import {
  isJsonObject,
  isStringValue,
  promiseWithTimeout,
  safeSessionStorageGet,
  safeSessionStorageSet,
  safeStorageGet,
  safeStorageSet,
  showSystemNotification,
  readNotificationPermission,
} from "../trackUtils";

type UseReleaseManagerOptions = {
  nativeApp: boolean;
  siteUpdateSeconds: number | null;
  setSiteUpdateSeconds: Dispatch<SetStateAction<number | null>>;
  updateReady: ReleaseSignal | null;
  setUpdateReady: Dispatch<SetStateAction<ReleaseSignal | null>>;
  setAvailableUpdateVersion: Dispatch<SetStateAction<string | null>>;
  setUpdateCheckBusy: Dispatch<SetStateAction<boolean>>;
  setUpdateCheckMessage: Dispatch<SetStateAction<string>>;
  isSaveInFlight: () => boolean;
};

function hasAttemptedReleaseReload(identity: string) {
  const raw = safeSessionStorageGet(SITE_UPDATE_RELOAD_GUARD_KEY);
  if (!raw) return false;
  try {
    const parsed: JsonValue = JSON.parse(raw);
    return (
      isJsonObject(parsed) &&
      isStringValue(parsed.identity) &&
      parsed.identity === identity &&
      Number.isFinite(Number(parsed.at))
    );
  } catch {
    return false;
  }
}

function rememberReleaseReloadAttempt(identity: string) {
  safeSessionStorageSet(SITE_UPDATE_RELOAD_GUARD_KEY, JSON.stringify({ identity, at: Date.now() }));
}

export function useReleaseManager({
  nativeApp,
  siteUpdateSeconds,
  setSiteUpdateSeconds,
  updateReady,
  setUpdateReady,
  setAvailableUpdateVersion,
  setUpdateCheckBusy,
  setUpdateCheckMessage,
  isSaveInFlight,
}: UseReleaseManagerOptions) {
  const releaseIdentitySeen = useRef<string | null>(null);
  const releaseDeadline = useRef<number | null>(null);
  const releaseSignalPayload = useRef<ReleaseSignal | null>(null);
  const releaseReloadIdentity = useRef<string | null>(null);
  const siteUpdateSecondsRef = useRef<number | null>(null);
  const updateReadyRef = useRef<ReleaseSignal | null>(null);
  const checkRef = useRef<(manual?: boolean) => Promise<UpdateCheckResult>>(async () => "error");
  const sourceId = useRef("");

  useEffect(() => {
    siteUpdateSecondsRef.current = siteUpdateSeconds;
    updateReadyRef.current = updateReady;
  }, [siteUpdateSeconds, updateReady]);

  const startReleaseCountdown = useCallback(
    (seconds: number, detectedAt = Date.now()) => {
      const duration = Math.max(1, Number(seconds) || SITE_UPDATE_COUNTDOWN_SECONDS);
      releaseDeadline.current = Math.max(Date.now(), Number(detectedAt) || Date.now()) + duration * 1000;
      setSiteUpdateSeconds(Math.max(0, Math.ceil((releaseDeadline.current - Date.now()) / 1000)));
    },
    [setSiteUpdateSeconds],
  );

  const presentReleaseSignal = useCallback(
    (payload: ReleaseSignal) => {
      const releaseIdentity = `${payload.remoteVersion}:${payload.remoteBuildId ?? ""}`;
      releaseIdentitySeen.current = releaseIdentity;
      releaseSignalPayload.current = payload;
      setAvailableUpdateVersion(payload.remoteVersion);
      const notificationMessage = nativeApp
        ? "A new Track II update is ready. Download the latest IPA or APK and install it over Track II."
        : "A new Track II update is ready. Refresh Track II to load the latest version.";

      if (
        nativeApp ||
        hasAttemptedReleaseReload(releaseIdentity) ||
        releaseReloadIdentity.current === releaseIdentity
      ) {
        releaseDeadline.current = null;
        setSiteUpdateSeconds(null);
        setUpdateReady(payload);
      } else {
        rememberReleaseReloadAttempt(releaseIdentity);
        startReleaseCountdown(payload.countdownSeconds ?? SITE_UPDATE_COUNTDOWN_SECONDS, payload.detectedAt);
      }

      void (async () => {
        const permission = await readNotificationPermission();
        if (permission !== "granted") return;
        const notificationKey = `track-update-notified:${releaseIdentity}`;
        if (safeStorageGet(notificationKey) === "sent") return;
        const delivered = await promiseWithTimeout(
          showSystemNotification(notificationMessage, `update-${releaseIdentity}`),
          TRACK_TIMING.notificationDeliveryTimeoutMs,
        ).catch(() => false);
        if (delivered) safeStorageSet(notificationKey, "sent");
      })();
    },
    [nativeApp, setAvailableUpdateVersion, setSiteUpdateSeconds, setUpdateReady, startReleaseCountdown],
  );

  const checkForSiteUpdate = useCallback(
    async (manual = false): Promise<UpdateCheckResult> => checkRef.current(manual),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const signalRelease = (remoteVersion: string, remoteBuildId?: string) => {
      const releaseIdentity = `${remoteVersion}:${remoteBuildId ?? ""}`;
      if (!remoteVersion || releaseIdentitySeen.current === releaseIdentity) return;
      if (!sourceId.current) sourceId.current = globalThis.crypto?.randomUUID?.() ?? `release-${Date.now()}`;
      const payload: ReleaseSignal = {
        source: sourceId.current,
        remoteVersion,
        remoteBuildId,
        detectedAt: Date.now(),
        countdownSeconds: SITE_UPDATE_COUNTDOWN_SECONDS,
      };
      presentReleaseSignal(payload);
    };
    const requestHeaders = { "cache-control": "no-cache, no-store, must-revalidate", pragma: "no-cache" };
    const readRemoteRelease = async (): Promise<RemoteRelease | null> => {
      const cacheBust = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const releaseOrigin = nativeApp ? TRACK_WEB_ORIGIN : window.location.origin;
      const credentials: RequestCredentials = nativeApp ? "omit" : "same-origin";
      const requestOptions: RequestInit = { cache: "no-store", credentials };
      if (!nativeApp) requestOptions.headers = requestHeaders;
      try {
        const manifestUrl = new URL("/track-release.json", releaseOrigin);
        manifestUrl.searchParams.set("v", cacheBust);
        const manifestResponse = await fetch(manifestUrl, requestOptions);
        if (manifestResponse.ok) {
          const manifest: JsonValue = await manifestResponse.json();
          if (isJsonObject(manifest) && isStringValue(manifest.version) && manifest.version)
            return {
              version: manifest.version,
              buildId: isStringValue(manifest.buildId) ? manifest.buildId : undefined,
            };
        }
      } catch {
        /* Older deployments do not have the manifest; use HTML below. */
      }
      const htmlUrl = new URL("/index.html", releaseOrigin);
      htmlUrl.searchParams.set("track_version_check", cacheBust);
      const response = await fetch(htmlUrl, requestOptions);
      if (!response.ok) return null;
      const html = await response.text();
      const parsedDocument = new DOMParser().parseFromString(html, "text/html");
      const version =
        parsedDocument.querySelector<HTMLMetaElement>('meta[name="track-version"]')?.content?.trim() ?? "";
      const buildId = parsedDocument.querySelector<HTMLMetaElement>('meta[name="track-build"]')?.content?.trim() ?? "";
      return version && version !== "__TRACK_VERSION__" ? { version, buildId: buildId || undefined } : null;
    };
    const check = async (manual = false): Promise<UpdateCheckResult> => {
      if (manual) {
        setUpdateCheckBusy(true);
        setUpdateCheckMessage("");
      }
      try {
        const remoteRelease = await readRemoteRelease();
        if (cancelled) return "error";
        if (!remoteRelease) {
          if (manual) setUpdateCheckMessage("Couldn’t verify the current release. Try again in a moment.");
          return "error";
        }
        const currentBuildId =
          TRACK_BUILD_ID !== "__TRACK_BUILD_ID__"
            ? TRACK_BUILD_ID
            : (document.querySelector<HTMLMetaElement>('meta[name="track-build"]')?.content?.trim() ?? "");
        const hasNewBuild = Boolean(
          remoteRelease.buildId &&
            currentBuildId &&
            currentBuildId !== "__TRACK_BUILD_ID__" &&
            remoteRelease.buildId !== currentBuildId,
        );
        if (isNewerTrackVersion(remoteRelease.version) || hasNewBuild) {
          setAvailableUpdateVersion(remoteRelease.version);
          if (manual) setUpdateCheckMessage("Update ready.");
          signalRelease(remoteRelease.version, remoteRelease.buildId);
          return "update";
        }
        const releaseStillPending = Boolean(
          releaseSignalPayload.current &&
            (releaseDeadline.current !== null || siteUpdateSecondsRef.current !== null || updateReadyRef.current),
        );
        if (manual || !releaseStillPending) {
          setAvailableUpdateVersion(null);
          setUpdateReady(null);
          releaseDeadline.current = null;
          setSiteUpdateSeconds(null);
          releaseSignalPayload.current = null;
          releaseIdentitySeen.current = null;
        }
        if (manual) setUpdateCheckMessage("No updates yet.");
        return "current";
      } catch {
        if (manual) setUpdateCheckMessage("Couldn’t check for updates. Try again in a moment.");
        return "error";
      } finally {
        if (manual) setUpdateCheckBusy(false);
      }
    };
    checkRef.current = check;
    void check();
    const interval = window.setInterval(() => {
      void check();
    }, SITE_UPDATE_POLL_MS);
    const resume = () => {
      if (!document.hidden) void check();
    };
    window.addEventListener("online", resume);
    window.addEventListener("focus", resume);
    window.addEventListener("pageshow", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      cancelled = true;
      checkRef.current = async () => "error";
      window.clearInterval(interval);
      window.removeEventListener("online", resume);
      window.removeEventListener("focus", resume);
      window.removeEventListener("pageshow", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [
    nativeApp,
    presentReleaseSignal,
    setAvailableUpdateVersion,
    setSiteUpdateSeconds,
    setUpdateCheckBusy,
    setUpdateCheckMessage,
    setUpdateReady,
  ]);

  useEffect(() => {
    if (siteUpdateSeconds === null) return;
    const deadline = releaseDeadline.current ?? Date.now() + siteUpdateSeconds * 1000;
    releaseDeadline.current = deadline;
    if (siteUpdateSeconds > 0) {
      const interval = window.setInterval(() => {
        const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        setSiteUpdateSeconds((current) => (current === remaining ? current : remaining));
      }, TRACK_TIMING.releaseCountdownTickMs);
      return () => window.clearInterval(interval);
    }
    const payload = releaseSignalPayload.current;
    const releaseIdentity = payload ? `${payload.remoteVersion}:${payload.remoteBuildId ?? ""}` : null;
    const focused = document.activeElement;
    if (focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement || isSaveInFlight()) {
      releaseDeadline.current = null;
      setSiteUpdateSeconds(null);
      if (payload) setUpdateReady(payload);
      return;
    }
    if (!payload || !releaseIdentity || releaseReloadIdentity.current === releaseIdentity) {
      releaseDeadline.current = null;
      setSiteUpdateSeconds(null);
      if (payload) setUpdateReady(payload);
      return;
    }
    releaseReloadIdentity.current = releaseIdentity;
    haptic(8);
    const refreshUrl = new URL(window.location.href);
    refreshUrl.searchParams.delete("track_version_check");
    refreshUrl.searchParams.set("track_updated", String(Date.now()));
    window.location.replace(refreshUrl.toString());
  }, [isSaveInFlight, setSiteUpdateSeconds, setUpdateReady, siteUpdateSeconds]);

  return { checkForSiteUpdate };
}
