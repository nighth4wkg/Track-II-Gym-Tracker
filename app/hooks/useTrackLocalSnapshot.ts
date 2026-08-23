import { useCallback, useEffect, useRef } from "react";
import { writeTrackSnapshot, type TrackLocalSnapshot } from "../offlineStore";
import type { Checklist } from "../trackTypes";
import { accountStorageKey, cloudListSignature, normalizeTask, safeStorageSet } from "../trackUtils";

type UseTrackLocalSnapshotOptions = {
  ready: boolean;
  cloudReady: boolean;
  activeId: string;
  accountLocalReadyFor: string | null;
  lists: Checklist[];
  userId: string | null;
  localChangesPending: { current: boolean };
  remoteRevision: { current: number };
};

export type TrackSnapshotWriter = (snapshot: TrackLocalSnapshot<Checklist[]>) => void;

/**
 * Owns private offline snapshot writes. Serializing encryption/IndexedDB
 * writes prevents a slower older write from replacing a newer snapshot.
 */
export function useTrackLocalSnapshot({
  ready,
  cloudReady,
  activeId,
  accountLocalReadyFor,
  lists,
  userId,
  localChangesPending,
  remoteRevision,
}: UseTrackLocalSnapshotOptions) {
  const writeGeneration = useRef(0);
  const writeQueue = useRef(Promise.resolve());
  const lastQueuedKey = useRef("");

  const invalidateSnapshotWrites = useCallback(() => {
    writeGeneration.current += 1;
    lastQueuedKey.current = "";
  }, []);

  const writeSnapshot = useCallback<TrackSnapshotWriter>((snapshot) => {
    const normalized = snapshot.lists.map((list) => ({ ...list, tasks: list.tasks.map(normalizeTask) }));
    const key = `${snapshot.userId}:${cloudListSignature(normalized)}:${snapshot.pending ? "pending" : "saved"}:${snapshot.remoteRevision}`;
    if (key === lastQueuedKey.current) return;
    lastQueuedKey.current = key;
    const generation = writeGeneration.current;
    const queuedSnapshot = { ...snapshot, lists: normalized };
    writeQueue.current = writeQueue.current
      .catch(() => undefined)
      .then(() =>
        generation === writeGeneration.current ? writeTrackSnapshot(queuedSnapshot).then(() => undefined) : undefined,
      )
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!ready || !userId || accountLocalReadyFor !== userId) return;
    safeStorageSet(accountStorageKey(userId, "active-split"), activeId);
  }, [accountLocalReadyFor, activeId, ready, userId]);

  useEffect(() => {
    if (!ready || !userId || !cloudReady) return;
    writeSnapshot({
      userId,
      lists,
      pending: localChangesPending.current,
      updatedAt: Date.now(),
      remoteRevision: remoteRevision.current,
    });
  }, [cloudReady, lists, ready, userId, writeSnapshot, localChangesPending, remoteRevision]);

  return { invalidateSnapshotWrites, writeSnapshot };
}
