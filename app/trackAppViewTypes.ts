import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from "react";
import type { useBottomTabNavigation } from "./hooks/useBottomTabNavigation";
import type { useIdentityState } from "./hooks/useIdentityState";
import type { useNavigationState } from "./hooks/useNavigationState";
import type { useRankCalendarState } from "./hooks/useRankCalendarState";
import type { useSettingsState } from "./hooks/useSettingsState";
import type { useSidebarGestures } from "./hooks/useSidebarGestures";
import type { useSplitActions } from "./hooks/useSplitActions";
import type { useSplitReorderGesture } from "./hooks/useSplitReorderGesture";
import type { useTimerActions } from "./hooks/useTimerActions";
import type { useTimerState } from "./hooks/useTimerState";
import type { useTrackAccountActions } from "./hooks/useTrackAccountActions";
import type { useTrackAppInteractions } from "./hooks/useTrackAppInteractions";
import type { useTrackExportActions } from "./hooks/useTrackExportActions";
import type { useUndoNotice } from "./hooks/useUndoNotice";
import type { useWorkoutDateSync } from "./hooks/useWorkoutDateSync";
import type { useWorkoutEditorController } from "./hooks/useWorkoutEditorController";
import type { useWorkoutImportActions } from "./hooks/useWorkoutImportActions";
import type { useWorkoutState } from "./hooks/useWorkoutState";
import type { AiExercise, Checklist } from "./trackTypes";

type AppState = {
  identity: ReturnType<typeof useIdentityState>;
  workout: ReturnType<typeof useWorkoutState>;
  settings: ReturnType<typeof useSettingsState>;
  navigation: ReturnType<typeof useNavigationState>;
  rank: ReturnType<typeof useRankCalendarState>;
  timer: ReturnType<typeof useTimerState>;
};

export type AppLocalState = {
  aiBusy: boolean;
  aiError: string;
  aiExercises: AiExercise[];
  aiKey: string;
  announcementDragStart: MutableRefObject<number | null>;
  composerRef: RefObject<HTMLFormElement | null>;
  exportBusy: "csv" | "json" | null;
  exportMessage: string;
  inputRef: RefObject<HTMLInputElement | null>;
  siteUpdateCheckRef: MutableRefObject<((manual?: boolean) => Promise<"update" | "current" | "error">) | null>;
  setAiExercises: Dispatch<SetStateAction<AiExercise[]>>;
  setAiKey: Dispatch<SetStateAction<string>>;
  settingsTabsRef: RefObject<HTMLDivElement | null>;
};

type AppControllers = {
  accountActions: ReturnType<typeof useTrackAccountActions>;
  bottomTabs: ReturnType<typeof useBottomTabNavigation>;
  exportActions: ReturnType<typeof useTrackExportActions>;
  finishWorkout: () => Promise<void>;
  importActions: ReturnType<typeof useWorkoutImportActions>;
  interactions: ReturnType<typeof useTrackAppInteractions>;
  sidebarGestures: ReturnType<typeof useSidebarGestures>;
  splitActions: ReturnType<typeof useSplitActions>;
  splitReorder: ReturnType<typeof useSplitReorderGesture>;
  timerActions: ReturnType<typeof useTimerActions>;
  timerPersistence: { markTimerChanged: () => void };
  undo: ReturnType<typeof useUndoNotice>;
  workoutDate: ReturnType<typeof useWorkoutDateSync>;
  workoutEditor: ReturnType<typeof useWorkoutEditorController>;
};

export type TrackAppViewProps = {
  active: Checklist | undefined;
  controllers: AppControllers;
  local: AppLocalState;
  nativeApp: boolean;
  state: AppState;
  tasks: Checklist["tasks"];
};
