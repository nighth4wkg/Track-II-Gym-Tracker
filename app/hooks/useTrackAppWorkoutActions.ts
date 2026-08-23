"use client";

import { useCallback, type MutableRefObject } from "react";
import type { TrackSyncEventName, TrackSyncEventPayload } from "./useTrackCloudSync";
import { useTrackExportActions } from "./useTrackExportActions";
import { useWorkoutFinishAction } from "./useWorkoutFinishAction";
import { useWorkoutImportActions } from "./useWorkoutImportActions";

type ImportOptions = Parameters<typeof useWorkoutImportActions>[0];
type ExportOptions = Parameters<typeof useTrackExportActions>[0];
type FinishOptions = Parameters<typeof useWorkoutFinishAction>[0];

type TrackSyncEventRef = MutableRefObject<(event: TrackSyncEventName, payload?: TrackSyncEventPayload) => void>;

type UseTrackAppWorkoutActionsOptions = {
  broadcastSyncEventRef: TrackSyncEventRef;
  exportOptions: ExportOptions;
  finishOptions: Omit<FinishOptions, "broadcastWorkoutFinished" | "invalidateCloudReads">;
  importOptions: ImportOptions;
  invalidateCloudReads: FinishOptions["invalidateCloudReads"];
};

export function useTrackAppWorkoutActions({
  broadcastSyncEventRef,
  exportOptions,
  finishOptions,
  importOptions,
  invalidateCloudReads,
}: UseTrackAppWorkoutActionsOptions) {
  const importActions = useWorkoutImportActions(importOptions);
  const exportActions = useTrackExportActions(exportOptions);
  const broadcastWorkoutFinished = useCallback(
    (payload: { dateKey: string; splitId: string }) => {
      broadcastSyncEventRef.current("workout-finished", payload);
    },
    [broadcastSyncEventRef],
  );
  const finishWorkout = useWorkoutFinishAction({
    ...finishOptions,
    invalidateCloudReads,
    broadcastWorkoutFinished,
  });

  return { exportActions, finishWorkout, importActions };
}
