"use client";

import { useCallback, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from "react";
import { haptic } from "../haptics";
import type { Checklist } from "../trackTypes";
import { TRACK_INTERACTION, TRACK_TIMING } from "../trackConstants";

type UseSplitActionsOptions = {
  active?: Checklist;
  activeId: string;
  lists: Checklist[];
  splitName: string;
  inputRef: RefObject<HTMLInputElement | null>;
  savedSplitsRef: MutableRefObject<Set<string>>;
  finishedSignaturesRef: MutableRefObject<Record<string, string>>;
  finishedDatesRef: MutableRefObject<Record<string, string>>;
  offerUndo: (message: string, undo: () => void) => void;
  setLists: Dispatch<SetStateAction<Checklist[]>>;
  setActiveId: Dispatch<SetStateAction<string>>;
  setShowTimer: Dispatch<SetStateAction<boolean>>;
  setShowCalendar: Dispatch<SetStateAction<boolean>>;
  setShowRank: Dispatch<SetStateAction<boolean>>;
  setFilter: Dispatch<SetStateAction<"all" | "open" | "done">>;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  setHomeTransition: Dispatch<SetStateAction<boolean>>;
  setMobileSidebarOpen: Dispatch<SetStateAction<boolean>>;
  setEditing: Dispatch<SetStateAction<string | null>>;
  setSplitMenu: Dispatch<SetStateAction<{ id: string; x: number; y: number } | null>>;
  setRenamingId: Dispatch<SetStateAction<string | null>>;
  setSavedSplits: Dispatch<SetStateAction<Set<string>>>;
  setFinishedSignatures: Dispatch<SetStateAction<Record<string, string>>>;
  setFinishedDates: Dispatch<SetStateAction<Record<string, string>>>;
  setDirtySplits: Dispatch<SetStateAction<Set<string>>>;
};

export function useSplitActions({
  active,
  activeId,
  lists,
  splitName,
  inputRef,
  savedSplitsRef,
  finishedSignaturesRef,
  finishedDatesRef,
  offerUndo,
  setLists,
  setActiveId,
  setShowTimer,
  setShowCalendar,
  setShowRank,
  setFilter,
  setSearchQuery,
  setHomeTransition,
  setMobileSidebarOpen,
  setEditing,
  setSplitMenu,
  setRenamingId,
  setSavedSplits,
  setFinishedSignatures,
  setFinishedDates,
  setDirtySplits,
}: UseSplitActionsOptions) {
  const showWorkout = useCallback(() => {
    setShowTimer(false);
    setShowCalendar(false);
    setShowRank(false);
  }, [setShowCalendar, setShowRank, setShowTimer]);

  const newChecklist = useCallback(() => {
    const createSplit = () => {
      const list: Checklist = { id: crypto.randomUUID(), title: "Untitled split", tasks: [], updatedAt: Date.now() };
      setLists((current) => [...current, list]);
      showWorkout();
      setActiveId(list.id);
      setFilter("all");
      setSearchQuery("");
      setHomeTransition(false);
      setMobileSidebarOpen(false);
      window.setTimeout(() => inputRef.current?.focus(), TRACK_INTERACTION.focusDelayMs);
    };
    if (!active) {
      setHomeTransition(true);
      window.setTimeout(createSplit, TRACK_TIMING.splitCreateDelayMs);
    } else {
      createSplit();
    }
  }, [
    active,
    inputRef,
    setActiveId,
    setFilter,
    setHomeTransition,
    setLists,
    setMobileSidebarOpen,
    setSearchQuery,
    showWorkout,
  ]);

  const selectChecklist = useCallback(
    (id: string) => {
      showWorkout();
      setActiveId(id);
      setFilter("all");
      setEditing(null);
      setMobileSidebarOpen(false);
    },
    [setActiveId, setEditing, setFilter, setMobileSidebarOpen, showWorkout],
  );

  const goHome = useCallback(() => {
    haptic(10);
    showWorkout();
    setActiveId("");
    setFilter("all");
    setEditing(null);
    setMobileSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [setActiveId, setEditing, setFilter, setMobileSidebarOpen, showWorkout]);

  const saveSplitName = useCallback(
    (id: string) => {
      const title = splitName.trim();
      if (title)
        setLists((current) =>
          current.map((list) => (list.id === id ? { ...list, title, updatedAt: Date.now() } : list)),
        );
      setRenamingId(null);
    },
    [setLists, setRenamingId, splitName],
  );

  const removeSplit = useCallback(
    (id: string) => {
      const removed = lists.find((list) => list.id === id);
      if (!removed) return;
      const removedIndex = lists.findIndex((list) => list.id === id);
      const previousActiveId = activeId;
      const wasSaved = savedSplitsRef.current.has(id);
      const previousFinishedSignature = finishedSignaturesRef.current[id];
      const previousFinishedDate = finishedDatesRef.current[id];
      let transitionTimer: number | null = null;
      const restore = () => {
        if (transitionTimer !== null) window.clearTimeout(transitionTimer);
        setHomeTransition(false);
        setLists((current) => {
          if (current.some((list) => list.id === id)) return current;
          const next = [...current];
          next.splice(Math.min(removedIndex, next.length), 0, removed);
          return next;
        });
        setActiveId(previousActiveId || id);
        if (wasSaved) {
          const nextSaved = new Set(savedSplitsRef.current);
          nextSaved.add(id);
          savedSplitsRef.current = nextSaved;
          setSavedSplits(nextSaved);
        }
        if (previousFinishedSignature)
          setFinishedSignatures((current) => ({ ...current, [id]: previousFinishedSignature }));
        if (previousFinishedDate) setFinishedDates((current) => ({ ...current, [id]: previousFinishedDate }));
      };
      if (savedSplitsRef.current.has(id)) {
        const nextSaved = new Set(savedSplitsRef.current);
        nextSaved.delete(id);
        savedSplitsRef.current = nextSaved;
        setSavedSplits(nextSaved);
      }
      setFinishedSignatures((current) => {
        if (!(id in current)) return current;
        const next = { ...current };
        delete next[id];
        return next;
      });
      setFinishedDates((current) => {
        if (!(id in current)) return current;
        const next = { ...current };
        delete next[id];
        return next;
      });
      if (lists.length === 1 && lists[0].id === id) {
        setSplitMenu(null);
        setHomeTransition(true);
        transitionTimer = window.setTimeout(() => {
          setLists([]);
          setActiveId("");
          setHomeTransition(false);
        }, 380);
        offerUndo("Split deleted", restore);
        return;
      }
      setLists((current) => {
        const remaining = current.filter((list) => list.id !== id);
        if (activeId === id) setActiveId(remaining[0]?.id ?? "");
        return remaining;
      });
      setSplitMenu(null);
      offerUndo("Split deleted", restore);
    },
    [
      activeId,
      finishedDatesRef,
      finishedSignaturesRef,
      lists,
      offerUndo,
      savedSplitsRef,
      setActiveId,
      setFinishedDates,
      setFinishedSignatures,
      setHomeTransition,
      setLists,
      setSavedSplits,
      setSplitMenu,
    ],
  );

  const duplicateSplit = useCallback(
    (id: string) => {
      const source = lists.find((list) => list.id === id);
      if (!source) return;
      const existingTitles = new Set(lists.map((list) => list.title.trim().toLowerCase()));
      const baseTitle = `${source.title} copy`;
      let title = baseTitle;
      let copyNumber = 2;
      while (existingTitles.has(title.toLowerCase())) title = `${baseTitle} ${copyNumber++}`;
      const duplicate: Checklist = {
        id: crypto.randomUUID(),
        title,
        updatedAt: Date.now(),
        tasks: source.tasks.map((task) => ({
          ...task,
          id: crypto.randomUUID(),
          done: false,
          collapsed: false,
          sets: (task.sets ?? []).map((set) => ({ ...set, id: crypto.randomUUID() })),
        })),
      };
      setLists((current) => [...current, duplicate]);
      setDirtySplits((current) => new Set(current).add(duplicate.id));
      setActiveId(duplicate.id);
      showWorkout();
      setFilter("all");
      setSearchQuery("");
      setEditing(null);
      setSplitMenu(null);
      setMobileSidebarOpen(false);
      window.setTimeout(() => inputRef.current?.focus(), TRACK_INTERACTION.focusDelayMs);
    },
    [
      inputRef,
      lists,
      setActiveId,
      setDirtySplits,
      setEditing,
      setFilter,
      setLists,
      setMobileSidebarOpen,
      setSearchQuery,
      setSplitMenu,
      showWorkout,
    ],
  );

  return { newChecklist, selectChecklist, goHome, saveSplitName, removeSplit, duplicateSplit };
}
