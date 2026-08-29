import { isJsonObject, isStringValue, safeStorageGet, safeStorageSet } from "./trackUtils";
import type { JsonValue } from "./trackTypes";

const SYNC_TELEMETRY_KEY = "track:sync-telemetry";
const MAX_SYNC_TELEMETRY_EVENTS = 100;

export type SyncTelemetryKind = "queued" | "retry" | "uploaded" | "stuck" | "storage-error";

export type SyncTelemetryEvent = {
  kind: SyncTelemetryKind;
  at: number;
  queueDepth?: number;
  attempts?: number;
  durationMs?: number;
  storageStatus?: "quota" | "unavailable";
};

const SYNC_TELEMETRY_KINDS: ReadonlySet<string> = new Set(["queued", "retry", "uploaded", "stuck", "storage-error"]);

function isFiniteNumber(value: JsonValue | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isTelemetryEvent(value: JsonValue | undefined): value is SyncTelemetryEvent {
  return (
    isJsonObject(value) && isStringValue(value.kind) && SYNC_TELEMETRY_KINDS.has(value.kind) && isFiniteNumber(value.at)
  );
}

export function readSyncTelemetry(): SyncTelemetryEvent[] {
  const stored = safeStorageGet(SYNC_TELEMETRY_KEY);
  if (!stored) return [];
  try {
    const parsed: JsonValue = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(isTelemetryEvent).slice(-MAX_SYNC_TELEMETRY_EVENTS) : [];
  } catch {
    return [];
  }
}

export function recordSyncTelemetry(event: Omit<SyncTelemetryEvent, "at"> & { at?: number }) {
  const next = [...readSyncTelemetry(), { ...event, at: event.at ?? Date.now() }].slice(-MAX_SYNC_TELEMETRY_EVENTS);
  safeStorageSet(SYNC_TELEMETRY_KEY, JSON.stringify(next));
  if (globalThis.window) window.dispatchEvent(new CustomEvent("track-sync-telemetry", { detail: next.at(-1) }));
}
