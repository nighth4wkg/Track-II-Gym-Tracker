"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { readWorkoutDrafts, removeWorkoutDraft, upsertWorkoutDraft } from "../offlineStore";
import type { Checklist, Task, WorkoutDraft } from "../trackTypes";
import { cloneWorkoutTasks, workoutDraftSignature } from "../workoutDraft";
import { runViewTransition } from "../viewTransitions";

type CleanWorkoutState = { tasks: Task[]; wasSaved: boolean };

type WorkoutDraftRecoveryOptions = {
  userId: string | null;
  accountReady: boolean;
  cloudReady: boolean;
  active?: Checklist;
  lists: Checklist[];
  dirtySplits: Set<string>;
  savedSplitsRef: MutableRefObject<Set<string>>;
  setLists: Dispatch<SetStateAction<Checklist[]>>;
  setActiveId: Dispatch<SetStateAction<string>>;
  setDirtySplits: Dispatch<SetStateAction<Set<string>>>;
  setSavedSplits: Dispatch<SetStateAction<Set<string>>>;
  setWorkoutActionsExiting: Dispatch<SetStateAction<boolean>>;
};

export type WorkoutDraftNotice = { draft: WorkoutDraft; recoveredAt: number };

export function useWorkoutDraftRecovery({
  userId,
  accountReady,
  cloudReady,
  active,
  lists,
  dirtySplits,
  savedSplitsRef,
  setLists,
  setActiveId,
  setDirtySplits,
  setSavedSplits,
  setWorkoutActionsExiting,
}: WorkoutDraftRecoveryOptions) {
  const [notice, setNotice] = useState<WorkoutDraftNotice | null>(null);
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);
  const hydrationStartedForRef = useRef<string | null>(null);
  const draftsRef = useRef(new Map<string, WorkoutDraft>());
  const cleanStatesRef = useRef(new Map<string, CleanWorkoutState>());
  const listsRef = useRef(lists);
  const writeTimerRef = useRef<number | null>(null);
  const pendingWriteRef = useRef<{ userId: string; draft: WorkoutDraft } | null>(null);
  const flushPendingWrite = useCallback(() => {
    if (writeTimerRef.current !== null) window.clearTimeout(writeTimerRef.current);
    writeTimerRef.current = null;
    const pending = pendingWriteRef.current;
    pendingWriteRef.current = null;
    if (pending) void upsertWorkoutDraft(pending.userId, pending.draft);
  }, []);

  useEffect(() => {
    listsRef.current = lists;
  }, [lists]);

  useEffect(() => {
    if (!userId) hydrationStartedForRef.current = null;
  }, [userId]);

  useEffect(() => {
    if (!userId || !accountReady || !cloudReady || hydrationStartedForRef.current === userId) return;
    hydrationStartedForRef.current = userId;
    let cancelled = false;
    void readWorkoutDrafts(userId).then((drafts) => {
      if (cancelled) return;
      const currentLists = listsRef.current;
      const existingIds = new Set(currentLists.map((list) => list.id));
      const validDrafts = drafts.filter((draft) => existingIds.has(draft.splitId));
      draftsRef.current = new Map(validDrafts.map((draft) => [draft.splitId, draft]));
      for (const list of currentLists) {
        const draft = draftsRef.current.get(list.id);
        cleanStatesRef.current.set(list.id, {
          tasks: cloneWorkoutTasks(draft?.baselineTasks ?? list.tasks),
          wasSaved: draft?.wasSaved ?? savedSplitsRef.current.has(list.id),
        });
      }
      const latest = [...validDrafts].sort((left, right) => right.updatedAt - left.updatedAt)[0];
      if (latest) {
        const draftIds = new Set(validDrafts.map((draft) => draft.splitId));
        runViewTransition(() => {
          setLists((current) =>
            current.map((list) => {
              const draft = draftsRef.current.get(list.id);
              return draft
                ? {
                    ...list,
                    title: draft.splitTitle,
                    tasks: cloneWorkoutTasks(draft.tasks),
                    updatedAt: draft.updatedAt,
                  }
                : list;
            }),
          );
          setActiveId(latest.splitId);
          setDirtySplits((current) => new Set([...current, ...draftIds]));
          setSavedSplits((current) => {
            const next = new Set(current);
            for (const splitId of draftIds) next.delete(splitId);
            savedSplitsRef.current = next;
            return next;
          });
          setWorkoutActionsExiting(false);
          setNotice({ draft: latest, recoveredAt: Date.now() });
        });
      } else runViewTransition(() => setNotice(null));
      setHydratedFor(userId);
    });
    return () => {
      cancelled = true;
    };
  }, [
    accountReady,
    cloudReady,
    savedSplitsRef,
    setActiveId,
    setDirtySplits,
    setLists,
    setSavedSplits,
    setWorkoutActionsExiting,
    userId,
  ]);

  useEffect(() => {
    if (!userId || hydratedFor !== userId || !active) return;
    const isDirty = dirtySplits.has(active.id);
    const storedDraft = draftsRef.current.get(active.id);
    if (!isDirty) {
      cleanStatesRef.current.set(active.id, {
        tasks: cloneWorkoutTasks(active.tasks),
        wasSaved: savedSplitsRef.current.has(active.id),
      });
      if (storedDraft) {
        if (pendingWriteRef.current?.draft.splitId === active.id) {
          if (writeTimerRef.current !== null) window.clearTimeout(writeTimerRef.current);
          writeTimerRef.current = null;
          pendingWriteRef.current = null;
        }
        draftsRef.current.delete(active.id);
        void removeWorkoutDraft(userId, active.id);
      }
      return;
    }
    const cleanState = cleanStatesRef.current.get(active.id);
    const now = Date.now();
    const nextDraft: WorkoutDraft = {
      splitId: active.id,
      splitTitle: active.title,
      tasks: cloneWorkoutTasks(active.tasks),
      baselineTasks: cloneWorkoutTasks(storedDraft?.baselineTasks ?? cleanState?.tasks ?? active.tasks),
      startedAt: storedDraft?.startedAt ?? now,
      updatedAt: now,
      wasSaved: storedDraft?.wasSaved ?? cleanState?.wasSaved ?? false,
    };
    if (storedDraft && workoutDraftSignature(storedDraft) === workoutDraftSignature(nextDraft)) return;
    draftsRef.current.set(active.id, nextDraft);
    if (writeTimerRef.current !== null) {
      window.clearTimeout(writeTimerRef.current);
      const pending = pendingWriteRef.current;
      if (pending && pending.draft.splitId !== nextDraft.splitId) {
        void upsertWorkoutDraft(pending.userId, pending.draft);
      }
    }
    pendingWriteRef.current = { userId, draft: nextDraft };
    writeTimerRef.current = window.setTimeout(() => {
      const pending = pendingWriteRef.current;
      writeTimerRef.current = null;
      pendingWriteRef.current = null;
      if (pending) void upsertWorkoutDraft(pending.userId, pending.draft);
    }, 250);
  }, [active, dirtySplits, hydratedFor, savedSplitsRef, userId]);

  useEffect(() => {
    if (!userId) return undefined;
    const flushWhenHidden = () => {
      if (document.visibilityState === "hidden") flushPendingWrite();
    };
    window.addEventListener("pagehide", flushPendingWrite);
    document.addEventListener("visibilitychange", flushWhenHidden);
    return () => {
      window.removeEventListener("pagehide", flushPendingWrite);
      document.removeEventListener("visibilitychange", flushWhenHidden);
    };
  }, [flushPendingWrite, userId]);

  useEffect(() => () => flushPendingWrite(), [flushPendingWrite]);

  const continueWorkout = useCallback(() => runViewTransition(() => setNotice(null)), []);

  const discardDraft = useCallback(() => {
    if (!notice || !userId) return;
    const { draft } = notice;
    runViewTransition(() => {
      setLists((current) =>
        current.map((list) =>
          list.id === draft.splitId
            ? { ...list, title: draft.splitTitle, tasks: cloneWorkoutTasks(draft.baselineTasks), updatedAt: Date.now() }
            : list,
        ),
      );
      setDirtySplits((current) => {
        const next = new Set(current);
        next.delete(draft.splitId);
        return next;
      });
      setSavedSplits((current) => {
        const next = new Set(current);
        if (draft.wasSaved) next.add(draft.splitId);
        else next.delete(draft.splitId);
        savedSplitsRef.current = next;
        return next;
      });
      draftsRef.current.delete(draft.splitId);
      if (pendingWriteRef.current?.draft.splitId === draft.splitId) {
        if (writeTimerRef.current !== null) window.clearTimeout(writeTimerRef.current);
        writeTimerRef.current = null;
        pendingWriteRef.current = null;
      }
      cleanStatesRef.current.set(draft.splitId, {
        tasks: cloneWorkoutTasks(draft.baselineTasks),
        wasSaved: draft.wasSaved,
      });
      setNotice(null);
    });
    void removeWorkoutDraft(userId, draft.splitId);
  }, [notice, savedSplitsRef, setDirtySplits, setLists, setSavedSplits, userId]);

  return { notice, continueWorkout, discardDraft };
}
