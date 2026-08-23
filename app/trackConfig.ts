export const TRACK_VERSION = "1.0";
// Keep the installed-app label aligned with the release identifier used by
// the update checker and native release workflow.
export const TRACK_DISPLAY_VERSION = TRACK_VERSION;
// The Pages build replaces this token with an ISO timestamp. It lets the
// updater detect a fresh deployment even when the public version stays 1.0.
export const TRACK_BUILD_ID = "__TRACK_BUILD_ID__";

// These values are intentionally supplied by the deployer. Keeping them out of
// the source lets the same Beta build work with any Pages site or release repo.
const configuredTrackWebOrigin = process.env.NEXT_PUBLIC_TRACK_WEB_ORIGIN ?? "";
const configuredTrackReleasesUrl = process.env.NEXT_PUBLIC_TRACK_RELEASES_URL ?? "";
const configuredTrackIssuesUrl = process.env.NEXT_PUBLIC_TRACK_ISSUES_URL ?? "";

export const TRACK_WEB_ORIGIN = configuredTrackWebOrigin.trim();
export const TRACK_RELEASES_URL = configuredTrackReleasesUrl.trim();
export const TRACK_ISSUES_URL = configuredTrackIssuesUrl.trim();

export function isNewerTrackVersion(remoteVersion: string, currentVersion = TRACK_VERSION) {
  const parse = (value: string) => {
    const parts = value.trim().replace(/^v/i, "").split(".");
    if (parts.length < 2 || parts.some((part) => !/^\d+$/.test(part))) return null;
    return parts.map(Number);
  };
  const remote = parse(remoteVersion);
  const current = parse(currentVersion);
  if (!remote || !current) return false;
  for (let index = 0; index < Math.max(remote.length, current.length); index += 1) {
    const remotePart = remote[index] ?? 0;
    const currentPart = current[index] ?? 0;
    if (remotePart !== currentPart) return remotePart > currentPart;
  }
  return false;
}
