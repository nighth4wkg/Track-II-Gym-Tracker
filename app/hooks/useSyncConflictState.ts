import { useCallback, useRef, useState } from "react";
import type { Checklist } from "../trackTypes";

export type SyncConflictDetails = {
  userId: string;
  baseLists: Checklist[];
  localLists: Checklist[];
  remoteLists: Checklist[];
  mergedLists: Checklist[];
  revision: number;
};

export function useSyncConflictState() {
  const conflictRef = useRef<SyncConflictDetails | null>(null);
  const [syncConflict, setSyncConflict] = useState<SyncConflictDetails | null>(null);
  const updateConflictState = useCallback((next: SyncConflictDetails | null) => {
    conflictRef.current = next;
    setSyncConflict(next);
  }, []);
  const clearConflictForUser = useCallback(
    (userId: string | null) => {
      if (!conflictRef.current || conflictRef.current.userId !== userId) return false;
      updateConflictState(null);
      return true;
    },
    [updateConflictState],
  );
  return { conflictRef, syncConflict, updateConflictState, clearConflictForUser };
}
