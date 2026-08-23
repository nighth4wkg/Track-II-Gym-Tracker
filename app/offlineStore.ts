export type TrackLocalSnapshot<T> = {
  userId: string;
  lists: T;
  pending: boolean;
  updatedAt: number;
  remoteRevision: number;
};

type EncryptedTrackSnapshot = {
  format: "encrypted-v1";
  userId: string;
  iv: ArrayBuffer;
  payload: ArrayBuffer;
};

type SnapshotKeyRow = {
  id: "snapshot-key";
  key: CryptoKey;
};
type StoredSnapshot = TrackLocalSnapshot<unknown> | EncryptedTrackSnapshot;

const DATABASE_NAME = "track-local-cache";
const DATABASE_VERSION = 2;
const SNAPSHOT_STORE = "snapshots";
const KEY_STORE = "keys";

let databasePromise: Promise<IDBDatabase | null> | null = null;
let encryptionKeyPromise: Promise<CryptoKey | null> | null = null;

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
        if (!database.objectStoreNames.contains(KEY_STORE)) {
          database.createObjectStore(KEY_STORE, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
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

async function encryptSnapshot<T>(
  database: IDBDatabase,
  snapshot: TrackLocalSnapshot<T>,
): Promise<EncryptedTrackSnapshot | null> {
  const cryptoApi = browserCrypto();
  const key = await getEncryptionKey(database);
  if (!cryptoApi || !key) return null;
  try {
    const iv = cryptoApi.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(snapshot));
    const payload = await cryptoApi.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
    return { format: "encrypted-v1", userId: snapshot.userId, iv: iv.buffer.slice(0), payload };
  } catch {
    return null;
  }
}

async function decryptSnapshot<T>(
  database: IDBDatabase,
  stored: EncryptedTrackSnapshot,
): Promise<TrackLocalSnapshot<T> | null> {
  const cryptoApi = browserCrypto();
  const key = await getEncryptionKey(database);
  if (!cryptoApi || !key) return null;
  try {
    const encoded = await cryptoApi.subtle.decrypt({ name: "AES-GCM", iv: stored.iv }, key, stored.payload);
    // SAFETY: this assertion is immediately validated below and the payload
    // was authenticated by AES-GCM with the key stored in the same database.
    const parsed = JSON.parse(new TextDecoder().decode(encoded)) as TrackLocalSnapshot<T>;
    if (!parsed || parsed.userId !== stored.userId || !Number.isFinite(parsed.updatedAt)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isEncryptedSnapshot(value: StoredSnapshot | null | undefined): value is EncryptedTrackSnapshot {
  if (!value || typeof value !== "object") return false;
  // SAFETY: after the object check, only fields from the IndexedDB record are
  // inspected and the predicate below verifies every encrypted field.
  const candidate = value as Partial<EncryptedTrackSnapshot>;
  return (
    candidate.format === "encrypted-v1" &&
    typeof candidate.userId === "string" &&
    candidate.iv instanceof ArrayBuffer &&
    candidate.payload instanceof ArrayBuffer
  );
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
        const stored = request.result as TrackLocalSnapshot<T> | EncryptedTrackSnapshot | undefined;
        if (!stored) {
          resolve(null);
          return;
        }
        if (isEncryptedSnapshot(stored)) {
          resolve(await decryptSnapshot<T>(database, stored));
          return;
        }
        // Legacy plaintext snapshots remain readable so existing offline data
        // is not lost. The next successful write replaces them with ciphertext.
        // SAFETY: isEncryptedSnapshot has ruled out the encrypted record; the
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
  if (!database) return false;
  const encrypted = await encryptSnapshot(database, snapshot);
  // Never write private workout data as new plaintext. If Web Crypto is not
  // available, the cloud sync path remains authoritative and this cache is
  // simply skipped.
  if (!encrypted) return false;
  return new Promise((resolve) => {
    try {
      const request = database.transaction(SNAPSHOT_STORE, "readwrite").objectStore(SNAPSHOT_STORE).put(encrypted);
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
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
