"use client";

import { CapacitorHttp } from "@capacitor/core";
import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { haptic } from "../haptics";
import { TRACK_BUILD_ID, TRACK_RELEASES_URL, TRACK_WEB_ORIGIN, isNewerTrackVersion } from "../trackConfig";
import { SITE_UPDATE_COUNTDOWN_SECONDS, SITE_UPDATE_POLL_MS, TRACK_TIMING } from "../trackConstants";
import type { JsonValue, ReleaseSignal, RemoteRelease, UpdateCheckResult } from "../trackTypes";
import {
  isJsonObject,
  isStringValue,
  promiseWithTimeout,
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

function parseRemoteReleasePayload(payload: JsonValue): RemoteRelease | null {
  if (!isJsonObject(payload)) return null;
  const altStoreVersion = (() => {
    if (!Array.isArray(payload.apps)) return "";
    const firstApp = payload.apps[0];
    if (!isJsonObject(firstApp) || !Array.isArray(firstApp.versions)) return "";
    const firstVersion = firstApp.versions[0];
    return isJsonObject(firstVersion) && isStringValue(firstVersion.version) ? firstVersion.version.trim() : "";
  })();
  const version = isStringValue(payload.version)
    ? payload.version.trim()
    : isStringValue(payload.tag_name)
      ? payload.tag_name.trim()
      : altStoreVersion;
  if (!version) return null;
  const buildId = isStringValue(payload.buildId)
    ? payload.buildId.trim()
    : isStringValue(payload.build_id)
      ? payload.build_id.trim()
      : "";
  return buildId ? { version, buildId } : { version };
}

function githubLatestReleaseApiUrl(releasesUrl: string) {
  try {
    const url = new URL(releasesUrl);
    const segments = url.pathname.split("/").filter(Boolean);
    if (url.hostname !== "github.com" || segments.length < 4) return null;
    const [owner, repository, releases, latest] = segments;
    if (releases !== "releases" || latest !== "latest") return null;
    return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/releases/latest`;
  } catch {
    return null;
  }
}

function githubLatestReleaseAssetUrl(releasesUrl: string, assetName: string) {
  try {
    const url = new URL(releasesUrl);
    const segments = url.pathname.split("/").filter(Boolean);
    if (url.hostname !== "github.com" || segments.length < 4) return null;
    const [owner, repository, releases, latest] = segments;
    if (releases !== "releases" || latest !== "latest") return null;
    return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/releases/latest/download/${encodeURIComponent(assetName)}`;
  } catch {
    return null;
  }
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

  const presentReleaseSignal = useCallback(
    (payload: ReleaseSignal) => {
      const releaseIdentity = `${payload.remoteVersion}:${payload.remoteBuildId ?? ""}`;
      releaseIdentitySeen.current = releaseIdentity;
      releaseSignalPayload.current = payload;
      setAvailableUpdateVersion(payload.remoteVersion);
      if (!nativeApp) return;
      releaseDeadline.current = null;
      setSiteUpdateSeconds(null);
      setUpdateReady(payload);

      void (async () => {
        const notificationMessage =
          "A new Track II update is ready. Download the latest IPA or APK and install it over Track II.";
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
    [nativeApp, setAvailableUpdateVersion, setSiteUpdateSeconds, setUpdateReady],
  );

  const checkForSiteUpdate = useCallback(
    async (manual = false): Promise<UpdateCheckResult> => checkRef.current(manual),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    if (!nativeApp) {
      setSiteUpdateSeconds(null);
      setUpdateReady(null);
      setAvailableUpdateVersion(null);
      checkRef.current = async (manual = false) => {
        if (manual) {
          setUpdateCheckBusy(false);
          setUpdateCheckMessage("Updates are checked in the installed APK or IPA.");
        }
        return "current";
      };
      return () => {
        cancelled = true;
        checkRef.current = async () => "error";
      };
    }

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
    const nativeRequestOptions: RequestInit = {
      cache: "no-store",
      credentials: "omit",
      headers: requestHeaders,
    };
    const readJsonRelease = async (url: string, options: RequestInit): Promise<RemoteRelease | null> => {
      try {
        if (nativeApp) {
          const headers = Object.fromEntries(new Headers(options.headers).entries());
          const response = await CapacitorHttp.get({
            url,
            headers,
            connectTimeout: TRACK_TIMING.cloudRequestTimeoutMs,
            readTimeout: TRACK_TIMING.cloudRequestTimeoutMs,
            responseType: "json",
          });
          if (response.status < 200 || response.status >= 300) return null;
          return parseRemoteReleasePayload(response.data);
        }
        const response = await fetch(url, options);
        if (!response.ok) return null;
        return parseRemoteReleasePayload(await response.json());
      } catch {
        return null;
      }
    };
    const readRemoteRelease = async (): Promise<RemoteRelease | null> => {
      const cacheBust = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const githubReleaseAssetUrl = githubLatestReleaseAssetUrl(TRACK_RELEASES_URL, "altstore-source.json");
      if (githubReleaseAssetUrl) {
        const sideStoreRelease = await readJsonRelease(githubReleaseAssetUrl, nativeRequestOptions);
        if (sideStoreRelease) return sideStoreRelease;
      }
      const githubApiUrl = githubLatestReleaseApiUrl(TRACK_RELEASES_URL);
      if (githubApiUrl) {
        const githubRelease = await readJsonRelease(githubApiUrl, {
          ...nativeRequestOptions,
          headers: { ...requestHeaders, accept: "application/vnd.github+json" },
        });
        if (githubRelease) return githubRelease;
      } else if (TRACK_RELEASES_URL) {
        const configuredRelease = await readJsonRelease(TRACK_RELEASES_URL, nativeRequestOptions);
        if (configuredRelease) return configuredRelease;
      }

      if (!TRACK_WEB_ORIGIN) return null;
      const releaseOrigin = TRACK_WEB_ORIGIN;
      try {
        const manifestUrl = new URL("/track-release.json", releaseOrigin);
        manifestUrl.searchParams.set("v", cacheBust);
        const manifest = await readJsonRelease(manifestUrl.toString(), nativeRequestOptions);
        if (manifest) return manifest;
      } catch {
        /* Older deployments do not have the manifest; use HTML below. */
      }
      const htmlUrl = new URL("/index.html", releaseOrigin);
      htmlUrl.searchParams.set("track_version_check", cacheBust);
      const response = await fetch(htmlUrl, nativeRequestOptions);
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
          nativeApp &&
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
    if (!nativeApp) return;
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
  }, [isSaveInFlight, nativeApp, setSiteUpdateSeconds, setUpdateReady, siteUpdateSeconds]);

  return { checkForSiteUpdate };
}
