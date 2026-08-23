import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { EQUIPMENT_TYPES, type EquipmentType, type MuscleGroup } from "./rankTypes.ts";
import { MUSCLE_GROUPS, ACCOUNT_LOCAL_KEYS, TRACK_LIMITS } from "./trackConstants.ts";
import type {
  Checklist,
  JsonObject,
  JsonValue,
  PersonalInfo,
  SetEntry,
  Task,
  TrackFunctionError,
  TrackPreferences,
  TimerRuntimeState,
  TouchListLike,
  WeightUnit,
} from "./trackTypes.ts";

export function syncStatusTone(label: string) {
  const normalized = label.toLowerCase();
  if (/(failed|couldn|not saved|offline|couldn't|can't load)/.test(normalized)) return "error" as const;
  if (/(retrying|another device|updated online|saved locally)/.test(normalized)) return "warning" as const;
  if (/(saving|syncing|loading|merging|updating|update in)/.test(normalized)) return "busy" as const;
  return "saved" as const;
}

export function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isStringValue(value: JsonValue | undefined): value is string {
  return typeof value === "string";
}

export function isBooleanValue(value: JsonValue | undefined): value is boolean {
  return typeof value === "boolean";
}

const MAX_TIMER_RUNTIME_MS = 7 * 24 * 60 * 60 * 1000;

export function normalizeTimerRuntime(value: JsonValue | undefined): TimerRuntimeState | null {
  if (!isJsonObject(value)) return null;
  const finiteNumber = (candidate: JsonValue | undefined): candidate is number =>
    typeof candidate === "number" && Number.isFinite(candidate);
  const boundedDuration = (candidate: JsonValue | undefined) =>
    finiteNumber(candidate) ? Math.min(MAX_TIMER_RUNTIME_MS, Math.max(0, candidate)) : 0;
  const nullableTimestamp = (candidate: JsonValue | undefined) =>
    finiteNumber(candidate) && candidate > 0 ? candidate : null;
  const laps = Array.isArray(value.laps)
    ? value.laps
        .filter((lap): lap is number => finiteNumber(lap) && lap >= 0 && lap <= MAX_TIMER_RUNTIME_MS)
        .slice(-100)
    : [];
  if (!finiteNumber(value.updatedAt) || value.updatedAt < 0) return null;
  return {
    mode: value.mode === "rest" ? "rest" : value.mode === "stopwatch" ? "stopwatch" : undefined,
    running: value.running === true,
    elapsedMs: boundedDuration(value.elapsedMs),
    startedAtMs: nullableTimestamp(value.startedAtMs),
    restRemainingMs: boundedDuration(value.restRemainingMs),
    restEndsAtMs: nullableTimestamp(value.restEndsAtMs),
    laps,
    updatedAt: value.updatedAt,
  };
}

export function parsedSyncRevision(value: JsonValue | undefined) {
  const revision = Number(value);
  return Number.isSafeInteger(revision) && revision >= 0 ? revision : null;
}

export function hasTouchList(event: Event): event is Event & { touches: TouchListLike } {
  if (!("touches" in event)) return false;
  const touches = event.touches;
  return typeof touches === "object" && touches !== null && "length" in touches;
}

export function parsedRankCategoryOverrides(value: JsonValue | undefined) {
  if (!isJsonObject(value)) return {};
  const next: Record<string, MuscleGroup> = {};
  for (const [exerciseId, group] of Object.entries(value)) {
    const parsedGroup = MUSCLE_GROUPS.find((candidate) => candidate === group);
    if (exerciseId && parsedGroup) next[exerciseId] = parsedGroup;
  }
  return next;
}

export function parsedRankEquipmentOverrides(value: JsonValue | undefined) {
  if (!isJsonObject(value)) return {};
  const next: Record<string, EquipmentType> = {};
  for (const [exerciseId, equipment] of Object.entries(value)) {
    const parsedEquipment = EQUIPMENT_TYPES.find((candidate) => candidate === equipment);
    if (exerciseId && parsedEquipment) next[exerciseId] = parsedEquipment;
  }
  return next;
}

export function parsedPersonalInfo(
  heightValue: JsonValue | undefined,
  weightValue: JsonValue | undefined,
): PersonalInfo | null {
  const heightCm = Number(heightValue);
  const weightKg = Number(weightValue);
  if (!Number.isFinite(heightCm) || heightCm < TRACK_LIMITS.minHeightCm || heightCm > TRACK_LIMITS.maxHeightCm)
    return null;
  if (!Number.isFinite(weightKg) || weightKg < TRACK_LIMITS.minWeightKg || weightKg > TRACK_LIMITS.maxWeightKg)
    return null;
  return { heightCm: Math.round(heightCm * 10) / 10, weightKg: Math.round(weightKg * 10) / 10 };
}

export function convertWeight(weight: number, from: WeightUnit, to: WeightUnit) {
  if (from === to || !Number.isFinite(weight)) return weight;
  const converted = from === "kg" ? weight * 2.2046226218 : weight / 2.2046226218;
  return Math.round(converted * 100) / 100;
}

export function convertSetUnit(set: SetEntry, unit: WeightUnit): SetEntry {
  if (set.unit === unit) return set;
  const weight = convertWeight(Number(set.weight), set.unit, unit);
  const lastWeight = set.lastWeight === undefined ? undefined : convertWeight(set.lastWeight, set.unit, unit);
  return { ...set, unit, weight: Number.isFinite(weight) ? String(weight) : set.weight, lastWeight };
}

export function sanitizeDecimalInput(input: string, maxChars: number) {
  return input
    .replace(/[^\d.]/g, "")
    .replace(/(\..*)\./g, "$1")
    .slice(0, maxChars);
}

export function normalizeWeightInputOnBlur(input: string): string | null {
  const value = input.trim();
  if (!value || value === ".") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? String(number) : null;
}

// Browsers can disable web storage (private browsing, strict tracking
// protection, embedded previews). Storage must never prevent Track from mounting.
export function safeStorageGet(key: string) {
  if (!globalThis.window) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeStorageSet(key: string, value: string) {
  if (!globalThis.window) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* optional persistence */
  }
}

export function safeStorageRemove(key: string) {
  if (!globalThis.window) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* optional persistence */
  }
}

// Release-loop guards are intentionally session-scoped. They should survive
// one page reload, but they must not become durable user data.
export function safeSessionStorageGet(key: string) {
  if (!globalThis.window) return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSessionStorageSet(key: string, value: string) {
  if (!globalThis.window) return;
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    /* optional session state */
  }
}

export function promiseWithTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  if (!globalThis.window) return promise;
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      settled = true;
      reject(new Error("timeout"));
    }, timeoutMs);
    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve(value);
      },
      (error: Error | { code?: string; message?: string } | string | null) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function nativeLocalNotificationsAvailable() {
  return (
    Boolean(globalThis.window) && Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("LocalNotifications")
  );
}

export async function readNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!globalThis.window) return "unsupported";
  if (nativeLocalNotificationsAvailable()) {
    try {
      const permission = await promiseWithTimeout(LocalNotifications.checkPermissions(), 4000);
      if (permission.display === "granted") return "granted";
      if (permission.display === "denied") return "denied";
      return "default";
    } catch {
      return "unsupported";
    }
  }
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export function notificationIdFromKey(key: string) {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) hash = Math.imul(hash ^ key.charCodeAt(index), 16777619);
  return (hash >>> 0) % 2147483647 || 1;
}

export async function showSystemNotification(message: string, id: string) {
  if (!globalThis.window) return false;
  try {
    if (nativeLocalNotificationsAvailable()) {
      const permission = await LocalNotifications.checkPermissions();
      if (permission.display !== "granted") return false;
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notificationIdFromKey(`track-${id}`),
            title: "Track II",
            body: message,
            schedule: { at: new Date(Date.now() + 1000) },
            extra: { id },
          },
        ],
      });
      return true;
    }
    if (!("Notification" in window) || Notification.permission !== "granted") return false;
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification("Track II", {
        body: message,
        icon: "/icon-192.png?v=3.0.2",
        badge: "/notification-badge.png?v=3.0.2",
        tag: `track-${id}`,
      });
      return true;
    }
    new Notification("Track II", { body: message, icon: "/icon-192.png?v=3.0.2", tag: `track-${id}` });
    return true;
  } catch {
    /* keep the in-app announcement when system notifications are unavailable */ return false;
  }
}

export function restSecondsFromMinutes(input: string): number {
  const minutes = Number(input);
  if (!Number.isFinite(minutes)) return 60;
  return Math.min(3600, Math.max(6, Math.round(minutes * 60)));
}

export function restMinutesInputFromSeconds(seconds: number): string {
  const minutes = Number((Math.max(1, seconds) / 60).toFixed(2));
  return String(minutes);
}

export function parseStringArray(value: string | null) {
  try {
    const parsed: JsonValue = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) && parsed.every(isStringValue) ? parsed : [];
  } catch {
    return [];
  }
}

export function isStringRecord(value: JsonValue | undefined): value is Record<string, string> {
  return isJsonObject(value) && Object.values(value).every(isStringValue);
}

export function parseStringRecord(value: string | null) {
  try {
    const parsed: JsonValue = JSON.parse(value ?? "{}");
    return isStringRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function normalizePreferences(value: JsonValue | undefined): TrackPreferences | null {
  if (!isJsonObject(value)) return null;
  const raw = value;
  const restSeconds = Math.min(
    TRACK_LIMITS.maxRestSeconds,
    Math.max(1, Number(raw.restSeconds) || TRACK_LIMITS.defaultRestSeconds),
  );
  const timerMode: TrackPreferences["timerMode"] = raw.timerMode === "rest" ? "rest" : "stopwatch";
  const timerRuntime = normalizeTimerRuntime(raw.timerRuntime);
  // Older preference payloads did not store the runtime mode. Use the
  // preference mode as a compatibility fallback, but preserve a newer
  // runtime mode when it exists because the runtime includes the actual
  // running timer and its clock anchor.
  const resolvedTimerRuntime =
    timerRuntime && timerRuntime.mode === undefined ? { ...timerRuntime, mode: timerMode } : timerRuntime;
  const preferences: TrackPreferences = {
    defaultUnit: raw.defaultUnit === "lb" ? "lb" : "kg",
    timerMode,
    restSeconds,
    restCustom: isBooleanValue(raw.restCustom) ? raw.restCustom : ![60, 90, 120].includes(restSeconds),
    rememberExercisesAcrossSplits: raw.rememberExercisesAcrossSplits === true,
    completionEnabled: raw.completionEnabled === true,
  };
  if (resolvedTimerRuntime) preferences.timerRuntime = resolvedTimerRuntime;
  return preferences;
}

export function preferencesSignature(preferences: TrackPreferences) {
  let hashA = 0x811c9dc5;
  let hashB = 0x9e3779b1;
  const addToken = (token: string) => {
    for (let index = 0; index < token.length; index += 1) {
      const code = token.charCodeAt(index);
      hashA = Math.imul(hashA ^ code, 0x01000193);
      hashB = Math.imul(hashB ^ (code + index), 0x85ebca6b);
    }
  };
  const addText = (value: string) => addToken("s" + value.length + ":" + value + "\u001f");
  const addNumber = (value: number) => addToken("n" + value + "\u001f");
  const addBoolean = (value: boolean) => addToken("b" + (value ? 1 : 0) + "\u001f");

  addText(preferences.defaultUnit);
  addText(preferences.timerMode);
  addNumber(preferences.restSeconds);
  addBoolean(preferences.restCustom);
  addBoolean(preferences.rememberExercisesAcrossSplits);
  addBoolean(preferences.completionEnabled);
  const runtime = preferences.timerRuntime;
  addBoolean(Boolean(runtime));
  if (runtime) {
    addText(runtime.mode ?? "");
    addBoolean(runtime.running);
    addNumber(runtime.elapsedMs);
    addNumber(runtime.startedAtMs ?? 0);
    addNumber(runtime.restRemainingMs);
    addNumber(runtime.restEndsAtMs ?? 0);
    addNumber(runtime.updatedAt);
    addNumber(runtime.laps.length);
    runtime.laps.forEach(addNumber);
  }
  return (hashA >>> 0) + ":" + (hashB >>> 0);
}

function sortedStringRecordSignature(record: Record<string, string>) {
  return Object.entries(record)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\u001e");
}

export function rankCategoryOverridesSignature(overrides: Record<string, MuscleGroup>) {
  return sortedStringRecordSignature(overrides);
}

export function rankEquipmentOverridesSignature(overrides: Record<string, EquipmentType>) {
  return sortedStringRecordSignature(overrides);
}

// Only fields consumed by the client belong in this signature. Auth metadata
// can contain provider-specific fields that do not affect Track state; keeping
// them out avoids replacing the whole User object for unrelated metadata.
export function accountMetadataSignature(metadata: JsonValue | undefined) {
  if (!isJsonObject(metadata)) return "";
  const preferences = normalizePreferences(metadata.track_preferences);
  return [
    String(metadata.username ?? ""),
    String(metadata.height_cm ?? ""),
    String(metadata.weight_kg ?? ""),
    rankCategoryOverridesSignature(parsedRankCategoryOverrides(metadata.rank_category_overrides)),
    rankEquipmentOverridesSignature(parsedRankEquipmentOverrides(metadata.rank_equipment_overrides)),
    preferences ? preferencesSignature(preferences) : "",
  ].join("\u001f");
}

export function normalizeTask(task: Task): Task {
  if (task.sets?.length) return task;
  return {
    ...task,
    sets: [
      {
        id: `${task.id}-set-1`,
        weight: task.weight ?? "0",
        unit: task.unit ?? "kg",
        reps: /^\d+$/.test(task.reps) ? task.reps : "8",
        rir: task.rir || "0",
        lastWeight: task.lastWeight,
        lastReps: task.lastReps,
      },
    ],
  };
}

// Collapse/expand is presentation state, not workout data. Keep it in the
// current browser/device cache while taking the server's exercise and set values
// from account sync.
export function restoreLocalCollapseState(remote: Checklist[], local: Checklist[] | undefined) {
  if (!local?.length)
    return remote.map((list) => ({ ...list, tasks: list.tasks.map((task) => ({ ...task, collapsed: false })) }));
  const localStates = new Map<string, boolean>();
  const localSetMetadata = new Map<string, Pick<SetEntry, "lastWeight" | "lastReps" | "lastRir">>();
  for (const list of local)
    for (const task of list.tasks) {
      localStates.set(task.id, Boolean(task.collapsed));
      for (const set of task.sets ?? [])
        localSetMetadata.set(set.id, {
          lastWeight: set.lastWeight,
          lastReps: set.lastReps,
          lastRir: set.lastRir,
        });
    }
  return remote.map((list) => ({
    ...list,
    tasks: list.tasks.map((task) => ({
      ...task,
      collapsed: localStates.has(task.id) ? localStates.get(task.id) : false,
      sets: (task.sets ?? []).map((set) => {
        const localMetadata = localSetMetadata.get(set.id);
        return localMetadata
          ? {
              ...set,
              lastWeight: set.lastWeight ?? localMetadata.lastWeight,
              lastReps: set.lastReps ?? localMetadata.lastReps,
              lastRir: set.lastRir ?? localMetadata.lastRir,
            }
          : set;
      }),
    })),
  }));
}

export function cloudListSignature(lists: Checklist[]) {
  // Keep the change detector aligned with the exact persisted shape. Derived
  // fields such as lastWeight/lastReps/lastRir are local display metadata and
  // must not make a save look new after a remote refresh. Hashing the persisted
  // fields avoids rebuilding and stringifying a complete snapshot on every
  // keystroke while retaining deterministic ordering for conflict checks.
  let hashA = 0x811c9dc5;
  let hashB = 0x9e3779b1;
  const addToken = (token: string) => {
    for (let index = 0; index < token.length; index += 1) {
      const code = token.charCodeAt(index);
      hashA = Math.imul(hashA ^ code, 0x01000193);
      hashB = Math.imul(hashB ^ (code + index), 0x85ebca6b);
    }
  };
  const addText = (value: string) => addToken(`s${value.length}:${value}\u001f`);
  const addNumber = (value: number) => addToken(`n${value}\u001f`);
  const addBoolean = (value: boolean) => addToken(`b${value ? 1 : 0}\u001f`);

  addNumber(lists.length);
  lists.forEach((list, position) => {
    addText(list.id);
    addText(list.title);
    addNumber(position);
    addNumber(list.updatedAt);
    addNumber(list.tasks.length);
    list.tasks.forEach((task, taskPosition) => {
      addText(task.id);
      addText(task.text);
      addNumber(taskPosition);
      addBoolean(Boolean(task.done));
      const sets = task.sets ?? [];
      addNumber(sets.length);
      sets.forEach((set, setPosition) => {
        addText(set.id);
        addNumber(setPosition + 1);
        addNumber(Number(set.weight) || 0);
        addText(set.unit === "lb" ? "lb" : "kg");
        addNumber(Number(set.reps) || 0);
        addNumber(Number(set.rir) || 0);
      });
    });
  });
  return `${lists.length}:${hashA >>> 0}:${hashB >>> 0}`;
}

export function workoutValueSignature(list: Checklist | undefined) {
  if (!list) return "";
  // This signature is used for the finished-workout guard. Keep its exact
  // persisted fields, but hash them incrementally so a repeated realtime read
  // does not allocate and stringify a complete workout snapshot.
  let hashA = 0x811c9dc5;
  let hashB = 0x9e3779b1;
  const addToken = (token: string) => {
    for (let index = 0; index < token.length; index += 1) {
      const code = token.charCodeAt(index);
      hashA = Math.imul(hashA ^ code, 0x01000193);
      hashB = Math.imul(hashB ^ (code + index), 0x85ebca6b);
    }
  };
  const addText = (value: string) => addToken(`s${value.length}:${value}\u001f`);
  const addNumber = (value: number) => addToken(`n${value}\u001f`);

  addText(list.id);
  addText(list.title);
  addNumber(list.tasks.length);
  for (const task of list.tasks) {
    addText(task.id);
    addText(task.text);
    const sets = task.sets ?? [];
    addNumber(sets.length);
    for (const set of sets) {
      addText(set.id);
      addText(String(set.weight));
      addText(set.unit === "lb" ? "lb" : "kg");
      addText(String(set.reps));
      addText(String(set.rir));
    }
  }
  return `${hashA >>> 0}:${hashB >>> 0}`;
}

function setValueChanged<T>(base: T | undefined, value: T | undefined) {
  return base !== undefined && value !== undefined ? !Object.is(base, value) : base !== value;
}

function mergeValue<T>(base: T | undefined, remote: T | undefined, local: T | undefined) {
  if (setValueChanged(base, local)) return local;
  if (setValueChanged(base, remote)) return remote;
  return local ?? remote;
}

function persistedSetChanged(base: SetEntry | undefined, value: SetEntry | undefined) {
  if (!base || !value) return base !== value;
  return base.weight !== value.weight || base.unit !== value.unit || base.reps !== value.reps || base.rir !== value.rir;
}

function persistedTaskChanged(base: Task | undefined, value: Task | undefined) {
  if (!base || !value) return base !== value;
  const baseSets = new Map((base.sets ?? []).map((set) => [set.id, set]));
  const valueSets = new Map((value.sets ?? []).map((set) => [set.id, set]));
  return (
    base.text !== value.text ||
    base.done !== value.done ||
    baseSets.size !== valueSets.size ||
    [...baseSets].some(([id, set]) => persistedSetChanged(set, valueSets.get(id)))
  );
}

function persistedListChanged(base: Checklist | undefined, value: Checklist | undefined) {
  if (!base || !value) return base !== value;
  return cloudListSignature([base]) !== cloudListSignature([value]);
}

export function mergeTrackLists(remote: Checklist[], local: Checklist[], base: Checklist[] = []): Checklist[] {
  const remoteById = new Map(remote.map((list) => [list.id, list]));
  const localById = new Map(local.map((list) => [list.id, list]));
  const baseById = new Map(base.map((list) => [list.id, list]));
  const mergeTask = (remoteTask: Task | undefined, localTask: Task, baseTask?: Task): Task => {
    const localSets = normalizeTask(localTask).sets ?? [];
    const remoteSets = remoteTask ? (normalizeTask(remoteTask).sets ?? []) : [];
    const baseSets = baseTask ? (normalizeTask(baseTask).sets ?? []) : [];
    const remoteBySetId = new Map(remoteSets.map((set) => [set.id, set]));
    const localBySetId = new Map(localSets.map((set) => [set.id, set]));
    const baseBySetId = new Map(baseSets.map((set) => [set.id, set]));
    const mergedSets: SetEntry[] = localSets.flatMap((localSet): SetEntry[] => {
      const remoteSet = remoteBySetId.get(localSet.id);
      const baseSet = baseBySetId.get(localSet.id);
      if (!remoteSet && baseSet && !persistedSetChanged(baseSet, localSet)) return [];
      return [
        {
          ...remoteSet,
          ...localSet,
          weight: mergeValue(baseSet?.weight, remoteSet?.weight, localSet.weight) ?? localSet.weight,
          unit: mergeValue(baseSet?.unit, remoteSet?.unit, localSet.unit) ?? localSet.unit,
          reps: mergeValue(baseSet?.reps, remoteSet?.reps, localSet.reps) ?? localSet.reps,
          rir: mergeValue(baseSet?.rir, remoteSet?.rir, localSet.rir) ?? localSet.rir,
          lastWeight: localSet.lastWeight ?? remoteSet?.lastWeight,
          lastReps: localSet.lastReps ?? remoteSet?.lastReps,
          lastRir: localSet.lastRir ?? remoteSet?.lastRir,
        },
      ];
    });
    for (const remoteSet of remoteSets)
      if (!localBySetId.has(remoteSet.id) && !baseBySetId.has(remoteSet.id)) mergedSets.push(remoteSet);
    return {
      ...remoteTask,
      ...localTask,
      text: mergeValue(baseTask?.text, remoteTask?.text, localTask.text) ?? localTask.text,
      done: mergeValue(baseTask?.done, remoteTask?.done, localTask.done) ?? localTask.done,
      reps: mergeValue(baseTask?.reps, remoteTask?.reps, localTask.reps) ?? localTask.reps,
      rir: mergeValue(baseTask?.rir, remoteTask?.rir, localTask.rir) ?? localTask.rir,
      weight: mergeValue(baseTask?.weight, remoteTask?.weight, localTask.weight),
      unit: mergeValue(baseTask?.unit, remoteTask?.unit, localTask.unit),
      sets: mergedSets.map((set) => {
        const remoteSet = remoteBySetId.get(set.id);
        return {
          ...remoteSet,
          ...set,
          lastWeight: set.lastWeight ?? remoteSet?.lastWeight,
          lastReps: set.lastReps ?? remoteSet?.lastReps,
          lastRir: set.lastRir ?? remoteSet?.lastRir,
        };
      }),
    };
  };
  const mergeList = (remoteList: Checklist | undefined, localList: Checklist): Checklist => {
    const remoteTasks = remoteList?.tasks ?? [];
    const remoteByTaskId = new Map(remoteTasks.map((task) => [task.id, task]));
    const baseList = baseById.get(localList.id);
    const baseTasks = baseList?.tasks ?? [];
    const baseByTaskId = new Map(baseTasks.map((task) => [task.id, task]));
    const localByTaskId = new Map(localList.tasks.map((task) => [task.id, task]));
    const localTasks = localList.tasks.flatMap((task) => {
      const remoteTask = remoteByTaskId.get(task.id);
      const baseTask = baseByTaskId.get(task.id);
      if (!remoteTask && baseTask && !persistedTaskChanged(baseTask, task)) {
        return [];
      }
      return [mergeTask(remoteTask, task, baseTask)];
    });
    for (const remoteTask of remoteTasks)
      if (!localByTaskId.has(remoteTask.id) && !baseByTaskId.has(remoteTask.id)) localTasks.push(remoteTask);
    return {
      ...remoteList,
      ...localList,
      title: mergeValue(baseList?.title, remoteList?.title, localList.title) ?? localList.title,
      updatedAt: Math.max(remoteList?.updatedAt ?? 0, localList.updatedAt),
      tasks: localTasks,
    };
  };
  const merged = local.flatMap((list) => {
    const remoteList = remoteById.get(list.id);
    const baseList = baseById.get(list.id);
    if (!remoteList && baseList && !persistedListChanged(baseList, list)) return [];
    return [mergeList(remoteList, list)];
  });
  for (const remoteList of remote)
    if (!localById.has(remoteList.id) && !baseById.has(remoteList.id)) merged.push(remoteList);
  return merged;
}

export function trackStatePayload(lists: Checklist[]) {
  return {
    splits: lists.map((list, position) => ({
      id: list.id,
      name: list.title,
      position,
      updatedAt: list.updatedAt,
      tasks: list.tasks.map((task, taskPosition) => ({
        id: task.id,
        name: task.text,
        position: taskPosition,
        completed: Boolean(task.done),
        sets: (task.sets ?? []).map((set, setPosition) => ({
          id: set.id,
          setNumber: setPosition + 1,
          weight: Number(set.weight) || 0,
          unit: set.unit === "lb" ? "lb" : "kg",
          reps: Number(set.reps) || 0,
          rir: Number(set.rir) || 0,
        })),
      })),
    })),
  };
}

/**
 * A save with missing child arrays can be interpreted by the server as a
 * destructive replacement. Empty lists are valid (the user may intentionally
 * clear every split), but a partially-shaped list/task is never a valid save.
 */
export function isCompleteTrackState(lists: Checklist[]) {
  if (!Array.isArray(lists)) return false;
  return lists.every(
    (list) =>
      Boolean(list?.id) &&
      Array.isArray(list?.tasks) &&
      list.tasks.every((task) => Boolean(task?.id) && Array.isArray(task?.sets)),
  );
}

export function isMissingTrackFunction(error: TrackFunctionError) {
  return (
    error?.code === "PGRST202" || /could not find the function|function .* does not exist/i.test(error?.message ?? "")
  );
}

export function accountStorageKey(userId: string, key: (typeof ACCOUNT_LOCAL_KEYS)[number]) {
  return `track:account:${userId}:${key}`;
}
