import { TRACK_LIMITS } from "./trackConstants";
import { coalesceOfflineWorkoutQueue } from "./offlineQueue";
import type { JsonValue, WorkoutDraft, WorkoutSessionPayload } from "./trackTypes";
import { isJsonObject, isStringValue } from "./trackUtils";

export type TrackLocalSnapshot<T> = {
  userId: string;
  lists: T;
  pending: boolean;
  updatedAt: number;
  remoteRevision: number;
};

type EncryptedLocalRecord = {
  format: "encrypted-v1";
  userId: string;
  iv: ArrayBuffer;
  payload: ArrayBuffer;
};

type SnapshotKeyRow = {
  id: "snapshot-key";
  key: CryptoKey;
};
export type OfflineQueueEntryStatus = {
  attempts: number;
  nextRetryAt: number;
  lastError?: string;
  stuck: boolean;
};

export type OfflineWorkoutQueueState = {
  entries: WorkoutSessionPayload[];
  statuses: Record<string, OfflineQueueEntryStatus>;
  updatedAt: number;
};

export type OfflineStorageStatus = "ok" | "quota" | "unavailable";

type WorkoutQueueEnvelope = {
  userId: string;
  entries: WorkoutSessionPayload[];
  updatedAt: number;
  statuses?: Record<string, OfflineQueueEntryStatus>;
};

type WorkoutDraftEnvelope = {
  userId: string;
  drafts: WorkoutDraft[];
  updatedAt: number;
};

type StoredWorkoutQueue = EncryptedLocalRecord | WorkoutQueueEnvelope;
type LocalStoreRecord = EncryptedLocalRecord | TrackLocalSnapshot<unknown> | WorkoutQueueEnvelope;

const DATABASE_NAME = "track-local-cache";
const DATABASE_VERSION = 4;
const SNAPSHOT_STORE = "snapshots";
const WORKOUT_QUEUE_STORE = "sync-queue";
const WORKOUT_DRAFT_STORE = "workout-drafts";
const KEY_STORE = "keys";

let databasePromise: Promise<IDBDatabase | null> | null = null;
let encryptionKeyPromise: Promise<CryptoKey | null> | null = null;
let offlineStorageStatus: OfflineStorageStatus = "ok";
const queueOperations = new Map<string, Promise<unknown>>();
const draftOperations = new Map<string, Promise<unknown>>();

type StorageErrorLike = { name?: string } | null | undefined;

function markStorageFailure(error?: StorageErrorLike) {
  const name = error?.name ?? "";
  offlineStorageStatus = /quota|space|storage/i.test(name) ? "quota" : "unavailable";
}

function markStorageSuccess() {
  offlineStorageStatus = "ok";
}

export function getOfflineStorageStatus(): OfflineStorageStatus {
  return offlineStorageStatus;
}

function browserCrypto() {
  const browserWindow = globalThis.window;
  const cryptoApi = globalThis.crypto;
  if (!browserWindow || !cryptoApi?.subtle) return null;
  return cryptoApi;
}

function openDatabase() {
  const browserWindow = globalThis.window;
  const browserIndexedDb = globalThis.indexedDB;
  if (!browserWindow || !browserIndexedDb) return Promise.resolve(null);
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve) => {
    try {
      const request = browserIndexedDb.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(SNAPSHOT_STORE)) {
          database.createObjectStore(SNAPSHOT_STORE, { keyPath: "userId" });
        }
        if (!database.objectStoreNames.contains(WORKOUT_QUEUE_STORE)) {
          database.createObjectStore(WORKOUT_QUEUE_STORE, { keyPath: "userId" });
        }
        if (!database.objectStoreNames.contains(WORKOUT_DRAFT_STORE)) {
          database.createObjectStore(WORKOUT_DRAFT_STORE, { keyPath: "userId" });
        }
        if (!database.objectStoreNames.contains(KEY_STORE)) {
          database.createObjectStore(KEY_STORE, { keyPath: "id" });
        }
      };
      request.onsuccess = () => {
        markStorageSuccess();
        resolve(request.result);
      };
      request.onerror = () => {
        markStorageFailure(request.error);
        resolve(null);
      };
      request.onblocked = () => {
        markStorageFailure();
        resolve(null);
      };
    } catch {
      markStorageFailure();
      resolve(null);
    }
  });
  return databasePromise;
}

async function getEncryptionKey(database: IDBDatabase) {
  const cryptoApi = browserCrypto();
  if (!cryptoApi) return null;
  if (encryptionKeyPromise) return encryptionKeyPromise;
  encryptionKeyPromise = new Promise((resolve) => {
    try {
      const request = database.transaction(KEY_STORE, "readonly").objectStore(KEY_STORE).get("snapshot-key");
      request.onsuccess = async () => {
        // SAFETY: the `keys` object store contains only the non-extractable
        // CryptoKey row created by getEncryptionKey in this module.
        const stored = request.result as SnapshotKeyRow | undefined;
        if (stored?.key) {
          resolve(stored.key);
          return;
        }
        try {
          const key = await cryptoApi.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
            "encrypt",
            "decrypt",
          ]);
          const writeRequest = database
            .transaction(KEY_STORE, "readwrite")
            .objectStore(KEY_STORE)
            .put({ id: "snapshot-key", key });
          writeRequest.onsuccess = () => resolve(key);
          writeRequest.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return encryptionKeyPromise;
}

async function encryptLocalRecord(
  database: IDBDatabase,
  record: { userId: string },
): Promise<EncryptedLocalRecord | null> {
  const cryptoApi = browserCrypto();
  const key = await getEncryptionKey(database);
  if (!cryptoApi || !key) return null;
  try {
    const iv = cryptoApi.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(record));
    const payload = await cryptoApi.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
    return { format: "encrypted-v1", userId: record.userId, iv: iv.buffer.slice(0), payload };
  } catch {
    return null;
  }
}

async function decryptLocalRecord<T extends { userId: string; updatedAt: number }>(
  database: IDBDatabase,
  stored: EncryptedLocalRecord,
): Promise<T | null> {
  const cryptoApi = browserCrypto();
  const key = await getEncryptionKey(database);
  if (!cryptoApi || !key) return null;
  try {
    const encoded = await cryptoApi.subtle.decrypt({ name: "AES-GCM", iv: stored.iv }, key, stored.payload);
    // SAFETY: the payload was authenticated by AES-GCM with the non-extractable
    // key stored in this database; owner and timestamp are validated below and
    // each caller validates its domain-specific collection before using it.
    const parsed = JSON.parse(new TextDecoder().decode(encoded)) as T;
    if (!parsed || parsed.userId !== stored.userId || !Number.isFinite(parsed.updatedAt)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isEncryptedLocalRecord(value: LocalStoreRecord | null | undefined): value is EncryptedLocalRecord {
  if (!value) return false;
  // SAFETY: callers pass an IndexedDB record object and the predicate verifies
  // every encrypted-record field before treating it as ciphertext.
  const candidate = value as Partial<EncryptedLocalRecord>;
  return (
    candidate.format === "encrypted-v1" &&
    typeof candidate.userId === "string" &&
    candidate.iv instanceof ArrayBuffer &&
    candidate.payload instanceof ArrayBuffer
  );
}

function isWorkoutSessionPayload(value: JsonValue): value is WorkoutSessionPayload {
  if (!isJsonObject(value)) return false;
  const candidate = value;
  if (
    !isStringValue(candidate.splitId) ||
    !isStringValue(candidate.splitName) ||
    !isStringValue(candidate.clientMutationId) ||
    !isStringValue(candidate.occurredAt) ||
    !isStringValue(candidate.dateKey) ||
    !Array.isArray(candidate.logs) ||
    candidate.logs.length > 500 ||
    !Number.isFinite(Date.parse(candidate.occurredAt))
  )
    return false;
  return candidate.logs.every((log) => {
    if (!isJsonObject(log)) return false;
    const entry = log;
    return (
      isStringValue(entry.exerciseId) &&
      isStringValue(entry.exerciseName) &&
      Number.isFinite(entry.setNumber) &&
      Number.isFinite(entry.weight) &&
      (entry.unit === "kg" || entry.unit === "lb") &&
      Number.isFinite(entry.reps) &&
      Number.isFinite(entry.rir)
    );
  });
}

function normalizeWorkoutQueue(entries: JsonValue | WorkoutSessionPayload[]): WorkoutSessionPayload[] {
  if (!Array.isArray(entries)) return [];
  const seen = new Set<string>();
  const normalized: WorkoutSessionPayload[] = [];
  for (const entry of entries) {
    if (!isWorkoutSessionPayload(entry) || seen.has(entry.clientMutationId)) continue;
    seen.add(entry.clientMutationId);
    normalized.push(entry);
  }
  return normalized;
}

function normalizeOfflineQueueStatuses(entries: readonly WorkoutSessionPayload[], statuses: JsonValue | undefined) {
  if (!isJsonObject(statuses)) return {};
  const entryIds = new Set(entries.map((entry) => entry.clientMutationId));
  const normalizedEntries: Array<[string, OfflineQueueEntryStatus]> = [];
  for (const [mutationId, rawStatus] of Object.entries(statuses)) {
    if (!entryIds.has(mutationId) || !isJsonObject(rawStatus)) continue;
    const attempts = Number(rawStatus.attempts);
    const nextRetryAt = Number(rawStatus.nextRetryAt);
    normalizedEntries.push([
      mutationId,
      {
        attempts: Number.isFinite(attempts) ? Math.max(0, Math.floor(attempts)) : 0,
        nextRetryAt: Number.isFinite(nextRetryAt) ? Math.max(0, nextRetryAt) : 0,
        lastError: isStringValue(rawStatus.lastError) ? rawStatus.lastError.slice(0, 240) : undefined,
        stuck: rawStatus.stuck === true,
      },
    ]);
  }
  return Object.fromEntries(normalizedEntries);
}

function emptyOfflineWorkoutQueueState(): OfflineWorkoutQueueState {
  return { entries: [], statuses: {}, updatedAt: 0 };
}

export async function readTrackSnapshot<T>(userId: string): Promise<TrackLocalSnapshot<T> | null> {
  const database = await openDatabase();
  if (!database) return null;
  return new Promise((resolve) => {
    try {
      const request = database.transaction(SNAPSHOT_STORE, "readonly").objectStore(SNAPSHOT_STORE).get(userId);
      request.onsuccess = async () => {
        // SAFETY: this store is keyed by userId and contains either a legacy
        // TrackLocalSnapshot or the encrypted record written by this module.
        const stored = request.result as TrackLocalSnapshot<T> | EncryptedLocalRecord | undefined;
        if (!stored) {
          resolve(null);
          return;
        }
        if (isEncryptedLocalRecord(stored)) {
          resolve(await decryptLocalRecord<TrackLocalSnapshot<T>>(database, stored));
          return;
        }
        // Legacy plaintext snapshots remain readable so existing offline data
        // is not lost. The next successful write replaces them with ciphertext.
        // SAFETY: isEncryptedLocalRecord has ruled out the encrypted record; the
        // remaining legacy shape is the historical TrackLocalSnapshot format.
        resolve(stored as TrackLocalSnapshot<T>);
      };
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function writeTrackSnapshot<T>(snapshot: TrackLocalSnapshot<T>): Promise<boolean> {
  const database = await openDatabase();
  if (!database) {
    markStorageFailure();
    return false;
  }
  const encrypted = await encryptLocalRecord(database, snapshot);
  // Never write private workout data as new plaintext. If Web Crypto is not
  // available, the cloud sync path remains authoritative and this cache is
  // simply skipped.
  if (!encrypted) {
    markStorageFailure();
    return false;
  }
  return new Promise((resolve) => {
    try {
      const request = database.transaction(SNAPSHOT_STORE, "readwrite").objectStore(SNAPSHOT_STORE).put(encrypted);
      request.onsuccess = () => {
        markStorageSuccess();
        resolve(true);
      };
      request.onerror = () => {
        markStorageFailure(request.error);
        resolve(false);
      };
    } catch {
      markStorageFailure();
      resolve(false);
    }
  });
}

async function readWorkoutQueueState(userId: string): Promise<OfflineWorkoutQueueState> {
  const database = await openDatabase();
  if (!database) return emptyOfflineWorkoutQueueState();
  return new Promise((resolve) => {
    try {
      const request = database
        .transaction(WORKOUT_QUEUE_STORE, "readonly")
        .objectStore(WORKOUT_QUEUE_STORE)
        .get(userId);
      request.onsuccess = async () => {
        // SAFETY: the sync-queue store contains only the legacy envelope or
        // encrypted queue record written by this module.
        const stored = request.result as StoredWorkoutQueue | undefined;
        if (!stored) {
          resolve(emptyOfflineWorkoutQueueState());
          return;
        }
        // SAFETY: the encrypted predicate rules out the cipher record; the
        // remaining StoredWorkoutQueue member is the legacy envelope.
        const envelope = isEncryptedLocalRecord(stored)
          ? await decryptLocalRecord<WorkoutQueueEnvelope>(database, stored)
          : (stored as WorkoutQueueEnvelope);
        if (envelope?.userId !== userId) {
          resolve(emptyOfflineWorkoutQueueState());
          return;
        }
        const entries = normalizeWorkoutQueue(envelope.entries);
        resolve({
          entries,
          statuses: normalizeOfflineQueueStatuses(entries, envelope.statuses),
          updatedAt: Number.isFinite(envelope.updatedAt) ? envelope.updatedAt : 0,
        });
      };
      request.onerror = () => resolve(emptyOfflineWorkoutQueueState());
    } catch {
      resolve(emptyOfflineWorkoutQueueState());
    }
  });
}

async function writeWorkoutQueueState(userId: string, state: OfflineWorkoutQueueState) {
  const database = await openDatabase();
  if (!database) {
    markStorageFailure();
    return false;
  }
  if (!state.entries.length) {
    return new Promise<boolean>((resolve) => {
      try {
        const request = database
          .transaction(WORKOUT_QUEUE_STORE, "readwrite")
          .objectStore(WORKOUT_QUEUE_STORE)
          .delete(userId);
        request.onsuccess = () => {
          markStorageSuccess();
          resolve(true);
        };
        request.onerror = () => {
          markStorageFailure(request.error);
          resolve(false);
        };
      } catch {
        markStorageFailure();
        resolve(false);
      }
    });
  }
  const envelope: WorkoutQueueEnvelope = {
    userId,
    entries: state.entries,
    statuses: state.statuses,
    updatedAt: Date.now(),
  };
  const encrypted = await encryptLocalRecord(database, envelope);
  // Queue entries contain the same private workout data as the snapshot. Do
  // not fall back to a new plaintext record when encryption is unavailable.
  if (!encrypted) {
    markStorageFailure();
    return false;
  }
  return new Promise<boolean>((resolve) => {
    try {
      const request = database
        .transaction(WORKOUT_QUEUE_STORE, "readwrite")
        .objectStore(WORKOUT_QUEUE_STORE)
        .put(encrypted);
      request.onsuccess = () => {
        markStorageSuccess();
        resolve(true);
      };
      request.onerror = () => {
        markStorageFailure(request.error);
        resolve(false);
      };
    } catch {
      markStorageFailure();
      resolve(false);
    }
  });
}

function queueOperation<T>(userId: string, operation: () => Promise<T>) {
  const previous = queueOperations.get(userId) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(operation);
  queueOperations.set(
    userId,
    next.then(
      () => undefined,
      () => undefined,
    ),
  );
  return next;
}

export function readOfflineWorkoutQueue(userId: string) {
  return queueOperation(userId, async () => (await readWorkoutQueueState(userId)).entries);
}

export function readOfflineWorkoutQueueState(userId: string) {
  return queueOperation(userId, () => readWorkoutQueueState(userId));
}

export function enqueueOfflineWorkoutSession(userId: string, entry: WorkoutSessionPayload) {
  return queueOperation(userId, async () => {
    if (!isWorkoutSessionPayload(entry)) return false;
    const current = await readWorkoutQueueState(userId);
    const next = coalesceOfflineWorkoutQueue(current.entries, entry, TRACK_LIMITS.maxOfflineQueueEntries);
    if (!next) return false;
    return writeWorkoutQueueState(userId, {
      entries: next,
      statuses: current.statuses,
      updatedAt: Date.now(),
    });
  });
}

export function removeOfflineWorkoutSession(userId: string, clientMutationId: string) {
  return queueOperation(userId, async () => {
    const current = await readWorkoutQueueState(userId);
    if (!current.entries.some((entry) => entry.clientMutationId === clientMutationId)) return true;
    const statuses = { ...current.statuses };
    delete statuses[clientMutationId];
    return writeWorkoutQueueState(userId, {
      entries: current.entries.filter((entry) => entry.clientMutationId !== clientMutationId),
      statuses,
      updatedAt: Date.now(),
    });
  });
}

export function recordOfflineWorkoutFailure(
  userId: string,
  clientMutationId: string,
  message: string,
  nextRetryAt: number,
) {
  return queueOperation(userId, async () => {
    const current = await readWorkoutQueueState(userId);
    if (!current.entries.some((entry) => entry.clientMutationId === clientMutationId)) return false;
    const previous = current.statuses[clientMutationId];
    const attempts = (previous?.attempts ?? 0) + 1;
    const stuck = attempts >= TRACK_LIMITS.maxOfflineQueueRetries;
    return writeWorkoutQueueState(userId, {
      entries: current.entries,
      statuses: {
        ...current.statuses,
        [clientMutationId]: {
          attempts,
          nextRetryAt: stuck ? 0 : Math.max(0, nextRetryAt),
          lastError: message.slice(0, 240),
          stuck,
        },
      },
      updatedAt: Date.now(),
    });
  });
}

export function resetOfflineWorkoutQueueFailures(userId: string) {
  return queueOperation(userId, async () => {
    const current = await readWorkoutQueueState(userId);
    const statuses = Object.fromEntries(
      current.entries.map((entry) => [entry.clientMutationId, { attempts: 0, nextRetryAt: 0, stuck: false }]),
    );
    return writeWorkoutQueueState(userId, { entries: current.entries, statuses, updatedAt: Date.now() });
  });
}

export function deleteOfflineWorkoutQueue(userId: string) {
  return queueOperation(userId, async () => writeWorkoutQueueState(userId, emptyOfflineWorkoutQueueState()));
}

function validWorkoutDraft(draft: WorkoutDraft) {
  return (
    Boolean(draft.splitId && draft.splitTitle) &&
    Array.isArray(draft.tasks) &&
    Array.isArray(draft.baselineTasks) &&
    Number.isFinite(draft.startedAt) &&
    Number.isFinite(draft.updatedAt)
  );
}

async function readWorkoutDraftRecord(userId: string): Promise<WorkoutDraft[]> {
  const database = await openDatabase();
  if (!database) return [];
  return new Promise((resolve) => {
    try {
      const request = database
        .transaction(WORKOUT_DRAFT_STORE, "readonly")
        .objectStore(WORKOUT_DRAFT_STORE)
        .get(userId);
      request.onsuccess = async () => {
        // SAFETY: workout-drafts accepts only encrypted records written by this
        // module; the encrypted predicate and owner checks run before use.
        const stored = request.result as EncryptedLocalRecord | undefined;
        if (!stored || !isEncryptedLocalRecord(stored)) {
          resolve([]);
          return;
        }
        const envelope = await decryptLocalRecord<WorkoutDraftEnvelope>(database, stored);
        resolve(
          envelope?.userId === userId && Array.isArray(envelope.drafts)
            ? envelope.drafts.filter(validWorkoutDraft)
            : [],
        );
      };
      request.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

async function writeWorkoutDraftRecord(userId: string, drafts: WorkoutDraft[]) {
  const database = await openDatabase();
  if (!database) {
    markStorageFailure();
    return false;
  }
  if (!drafts.length) {
    return new Promise<boolean>((resolve) => {
      try {
        const request = database
          .transaction(WORKOUT_DRAFT_STORE, "readwrite")
          .objectStore(WORKOUT_DRAFT_STORE)
          .delete(userId);
        request.onsuccess = () => {
          markStorageSuccess();
          resolve(true);
        };
        request.onerror = () => {
          markStorageFailure(request.error);
          resolve(false);
        };
      } catch {
        markStorageFailure();
        resolve(false);
      }
    });
  }
  const envelope: WorkoutDraftEnvelope = { userId, drafts, updatedAt: Date.now() };
  const encrypted = await encryptLocalRecord(database, envelope);
  if (!encrypted) {
    markStorageFailure();
    return false;
  }
  return new Promise<boolean>((resolve) => {
    try {
      const request = database
        .transaction(WORKOUT_DRAFT_STORE, "readwrite")
        .objectStore(WORKOUT_DRAFT_STORE)
        .put(encrypted);
      request.onsuccess = () => {
        markStorageSuccess();
        resolve(true);
      };
      request.onerror = () => {
        markStorageFailure(request.error);
        resolve(false);
      };
    } catch {
      markStorageFailure();
      resolve(false);
    }
  });
}

function draftOperation<T>(userId: string, operation: () => Promise<T>) {
  const previous = draftOperations.get(userId) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(operation);
  draftOperations.set(
    userId,
    next.then(
      () => undefined,
      () => undefined,
    ),
  );
  return next;
}

export function readWorkoutDrafts(userId: string) {
  return draftOperation(userId, () => readWorkoutDraftRecord(userId));
}

export function upsertWorkoutDraft(userId: string, draft: WorkoutDraft) {
  return draftOperation(userId, async () => {
    if (!validWorkoutDraft(draft)) return false;
    const current = await readWorkoutDraftRecord(userId);
    const next = [draft, ...current.filter((entry) => entry.splitId !== draft.splitId)]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, 8);
    return writeWorkoutDraftRecord(userId, next);
  });
}

export function removeWorkoutDraft(userId: string, splitId: string) {
  return draftOperation(userId, async () => {
    const current = await readWorkoutDraftRecord(userId);
    if (!current.some((draft) => draft.splitId === splitId)) return true;
    return writeWorkoutDraftRecord(
      userId,
      current.filter((draft) => draft.splitId !== splitId),
    );
  });
}

export function deleteWorkoutDrafts(userId: string) {
  return draftOperation(userId, async () => writeWorkoutDraftRecord(userId, []));
}

export async function deleteTrackSnapshot(userId: string): Promise<boolean> {
  const database = await openDatabase();
  if (!database) return false;
  return new Promise((resolve) => {
    try {
      const request = database.transaction(SNAPSHOT_STORE, "readwrite").objectStore(SNAPSHOT_STORE).delete(userId);
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}
