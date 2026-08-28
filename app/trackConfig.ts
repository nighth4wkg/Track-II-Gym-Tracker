// The Pages/native build replaces this token with package.json's semver. This
// keeps the in-app badge, release comparison, IPA, APK, and GitHub tag aligned.
export const TRACK_VERSION = "__TRACK_VERSION__";
// Static assets use an independent cache token so a new icon can be deployed
// without pretending that the public app version changed.
export const TRACK_ASSET_VERSION = "3.0.2";
export const TRACK_ASSET_QUERY = `?v=${TRACK_ASSET_VERSION}`;

// The release identifier keeps full semver so update comparisons remain
// lossless. The compact label is only for the small in-app/native-facing
// badge: patch groups roll into the second digit (1.0.10 -> 1.1, 1.9.10 -> 2.0).
export function formatTrackDisplayVersion(version: string) {
  const match = version
    .trim()
    .replace(/^v/i, "")
    .match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!match) return version.trim().replace(/^v/i, "") || "0.0";
  let major = Number(match[1]);
  let minor = Number(match[2]) + Math.floor(Number(match[3] ?? 0) / 10);
  major += Math.floor(minor / 10);
  minor %= 10;
  return `${major}.${minor}`;
}

export const TRACK_DISPLAY_VERSION = formatTrackDisplayVersion(TRACK_VERSION);
// The Pages build replaces this token with an ISO timestamp. It lets the
// updater detect a fresh deployment even when the public version stays the same.
export const TRACK_BUILD_ID = "__TRACK_BUILD_ID__";

// The Pages/native build can override these values for a fork or staging site.
// The public release endpoint stays available as a safe default so a native
// package cannot silently lose its update check when build variables are absent.
const configuredTrackWebOrigin = process.env.NEXT_PUBLIC_TRACK_WEB_ORIGIN ?? "";
const configuredTrackReleasesUrl = process.env.NEXT_PUBLIC_TRACK_RELEASES_URL ?? "";
const configuredTrackIssuesUrl = process.env.NEXT_PUBLIC_TRACK_ISSUES_URL ?? "";
const configuredTrackMetricsUrl = process.env.NEXT_PUBLIC_TRACK_METRICS_URL ?? "";
const configuredTrackDiscordHandle = process.env.NEXT_PUBLIC_TRACK_DISCORD_HANDLE ?? "n1ghthawq";
const defaultTrackReleasesUrl = "https://github.com/nighth4wkg/Track-II-Gym-Tracker/releases/latest";

export const TRACK_WEB_ORIGIN = configuredTrackWebOrigin.trim();
export const TRACK_RELEASES_URL = (configuredTrackReleasesUrl || defaultTrackReleasesUrl).trim();
export const TRACK_ISSUES_URL = configuredTrackIssuesUrl.trim();
export const TRACK_METRICS_URL = configuredTrackMetricsUrl.trim();
// Public support contact; deployments can replace it without editing source.
export const TRACK_DISCORD_HANDLE = configuredTrackDiscordHandle.trim().replace(/^@/, "");

export const GEMINI_API_KEY_URL = "https://aistudio.google.com/app/apikey";
export const GEMINI_API_KEY_DOCS_URL = "https://ai.google.dev/gemini-api/docs/api-key";

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
