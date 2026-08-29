import type { AccountPresenceStatus } from "./trackTypes";

export type SyncPhase = "synced" | "syncing" | "offline" | "attention";

export const SYNC_PHASE_LABELS = {
  synced: "Synced",
  syncing: "Syncing",
  offline: "Offline",
  attention: "Needs attention",
} satisfies Record<SyncPhase, string>;

export const ACCOUNT_PRESENCE_LABELS = {
  connecting: "Connecting…",
  online: "Online",
  offline: "Offline",
} satisfies Record<AccountPresenceStatus, string>;

export function syncPhaseForLabel(label: string): SyncPhase {
  const normalized = label.toLowerCase();
  if (normalized.includes("offline")) return "offline";
  if (
    /(retry|failed|couldn|needs attention|not saved|conflict|review changes|stuck|paused|storage|full)/.test(normalized)
  )
    return "attention";
  if (/(saving|syncing|loading|updating|merging|update in)/.test(normalized)) return "syncing";
  return "synced";
}
