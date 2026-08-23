"use client";

import { lazy, Suspense, type RefObject } from "react";
import type { EquipmentType, MuscleGroup, RankTask } from "../rankData";
import { CalendarScreenSkeleton, RankScreenSkeleton, WorkoutScreenSkeleton } from "./LoadingSkeletons";
import { TimerScreenSkeleton } from "./TimerScreenSkeleton";
import type { RestTimerSelection, TimerMode, TimerTransition } from "./TimerScreen";
import { WorkoutEditorProvider, type WorkoutEditorContextValue } from "../contexts/WorkoutEditorContext";
import { WorkoutPage } from "./WorkoutPage";
import type { CalendarScreenProps } from "./CalendarScreen";
import type { Checklist, Filter, PersonalInfo, Task } from "../trackTypes";

const TimerScreen = lazy(async () => ({ default: (await import("./TimerScreen")).TimerScreen }));
const RankScreen = lazy(async () => ({ default: (await import("./RankScreen")).RankScreen }));
const CalendarScreen = lazy(async () => ({ default: (await import("./CalendarScreen")).CalendarScreen }));

type WorkspaceContentProps = {
  homeTransition: boolean;
  cloudReady: boolean;
  showRank: boolean;
  showCalendar: boolean;
  showTimer: boolean;
  active: Checklist | null;
  tasks: Task[];
  rankTasks: RankTask[];
  visible: Task[];
  completionEnabled: boolean;
  filter: Filter;
  openCount: number;
  exerciseSuggestions: string[];
  value: string;
  showSuggestions: boolean;
  searchQueryActive: boolean;
  progressFading: boolean;
  workoutActionsAvailable: boolean;
  workoutActionsExiting: boolean;
  composerRef: RefObject<HTMLFormElement | null>;
  inputRef: RefObject<HTMLInputElement | null>;
  rankHistoryTasks: RankTask[];
  personalInfo: PersonalInfo | null;
  rankCategoryOverrides: Record<string, MuscleGroup>;
  rankEquipmentOverrides: Record<string, EquipmentType>;
  onRankCategoryOverride: (exerciseId: string, group: MuscleGroup | null) => void;
  onRankEquipmentOverride: (exerciseId: string, equipment: EquipmentType | null) => void;
  calendarMonth: Date;
  onCalendarMonthChange: (month: Date) => void;
  workoutDates: Set<string>;
  userId: string;
  onWorkoutDateRemoved: CalendarScreenProps["onWorkoutDateRemoved"];
  onWorkoutDateRestored: CalendarScreenProps["onWorkoutDateRestored"];
  onOfferUndo: CalendarScreenProps["onOfferUndo"];
  onWorkoutDateEvent: CalendarScreenProps["onWorkoutDateEvent"];
  timerMode: TimerMode;
  timerRunning: boolean;
  timerElapsed: number;
  restRemaining: number;
  restSeconds: number;
  restCustom: boolean;
  customRestInput: string;
  timerLaps: number[];
  timerTransition: TimerTransition;
  timerTransitionKey: number;
  onBeginTimerSwipe: (
    x: number,
    y: number,
    target: EventTarget | null,
    pointerType?: "touch" | "mouse" | "pen",
  ) => void;
  onFinishTimerSwipe: (x: number, y: number) => void;
  onCancelTimerSwipe: () => void;
  onChooseTimerMode: (mode: TimerMode) => void;
  onToggleTimer: () => void;
  onLapOrReset: () => void;
  onClearLaps: () => void;
  onStartRest: (selection?: RestTimerSelection) => void;
  onCreateChecklist: () => void;
  onAddExercise: (name: string) => void;
  onAddTask: (event: React.FormEvent<HTMLFormElement>) => void;
  onFilterChange: (filter: Filter) => void;
  onFinishWorkout: () => Promise<void>;
  onSearchValueChange: (value: string) => void;
  onShowSuggestionsChange: (show: boolean) => void;
  workoutEditorContextValue: WorkoutEditorContextValue;
};

export function WorkspaceContent({
  homeTransition,
  cloudReady,
  showRank,
  showCalendar,
  showTimer,
  active,
  tasks,
  rankTasks,
  visible,
  completionEnabled,
  filter,
  openCount,
  exerciseSuggestions,
  value,
  showSuggestions,
  searchQueryActive,
  progressFading,
  composerRef,
  inputRef,
  rankHistoryTasks,
  personalInfo,
  rankCategoryOverrides,
  rankEquipmentOverrides,
  onRankCategoryOverride,
  onRankEquipmentOverride,
  calendarMonth,
  onCalendarMonthChange,
  workoutDates,
  userId,
  onWorkoutDateRemoved,
  onWorkoutDateRestored,
  onOfferUndo,
  onWorkoutDateEvent,
  timerMode,
  timerRunning,
  timerElapsed,
  restRemaining,
  restSeconds,
  restCustom,
  customRestInput,
  timerLaps,
  timerTransition,
  timerTransitionKey,
  onBeginTimerSwipe,
  onFinishTimerSwipe,
  onCancelTimerSwipe,
  onChooseTimerMode,
  onToggleTimer,
  onLapOrReset,
  onClearLaps,
  onStartRest,
  onCreateChecklist,
  onAddExercise,
  onAddTask,
  onFilterChange,
  onSearchValueChange,
  onShowSuggestionsChange,
  workoutEditorContextValue,
}: WorkspaceContentProps) {
  return (
    <div
      key={showRank ? "rank" : showCalendar ? "calendar" : showTimer ? "timer" : (active?.id ?? "home")}
      className={homeTransition ? "content content-exit" : "content"}
    >
      {!cloudReady ? (
        showRank ? (
          <RankScreenSkeleton />
        ) : showCalendar ? (
          <CalendarScreenSkeleton />
        ) : showTimer ? (
          <TimerScreenSkeleton />
        ) : (
          <WorkoutScreenSkeleton />
        )
      ) : showRank ? (
        <Suspense fallback={<RankScreenSkeleton />}>
          <RankScreen
            tasks={rankTasks}
            historyTasks={rankHistoryTasks}
            bodyWeightKg={personalInfo?.weightKg ?? 0}
            heightCm={personalInfo?.heightCm ?? 0}
            categoryOverrides={rankCategoryOverrides}
            equipmentOverrides={rankEquipmentOverrides}
            onCategoryOverride={onRankCategoryOverride}
            onEquipmentOverride={onRankEquipmentOverride}
          />
        </Suspense>
      ) : showCalendar ? (
        <Suspense fallback={<CalendarScreenSkeleton />}>
          <CalendarScreen
            month={calendarMonth}
            onMonthChange={onCalendarMonthChange}
            workoutDates={workoutDates}
            userId={userId}
            onWorkoutDateRemoved={onWorkoutDateRemoved}
            onWorkoutDateRestored={onWorkoutDateRestored}
            onOfferUndo={onOfferUndo}
            onWorkoutDateEvent={onWorkoutDateEvent}
          />
        </Suspense>
      ) : showTimer ? (
        <Suspense fallback={<TimerScreenSkeleton />}>
          <TimerScreen
            mode={timerMode}
            running={timerRunning}
            elapsed={timerElapsed}
            restRemaining={restRemaining}
            restSeconds={restSeconds}
            restCustom={restCustom}
            customRestInput={customRestInput}
            laps={timerLaps}
            transition={timerTransition}
            transitionKey={timerTransitionKey}
            onBeginSwipe={onBeginTimerSwipe}
            onFinishSwipe={onFinishTimerSwipe}
            onCancelSwipe={onCancelTimerSwipe}
            onChooseMode={onChooseTimerMode}
            onToggle={onToggleTimer}
            onLapOrReset={onLapOrReset}
            onClearLaps={onClearLaps}
            onStartRest={onStartRest}
          />
        </Suspense>
      ) : !active ? (
        <div className="welcome-screen ui-empty">
          <div className="welcome-mark">
            <span className="dumbbell-icon" />
          </div>
          <div className="eyebrow">TRACK</div>
          <h1>Let’s get started</h1>
          <p>Create a split, then add exercises.</p>
          <button className="welcome-button ui-button ui-button-primary" onClick={onCreateChecklist}>
            <span>＋</span> Create a new split
          </button>
        </div>
      ) : (
        <WorkoutEditorProvider value={workoutEditorContextValue}>
          <WorkoutPage
            active={active}
            completionEnabled={completionEnabled}
            composerRef={composerRef}
            exerciseSuggestions={exerciseSuggestions}
            filter={filter}
            inputRef={inputRef}
            openCount={openCount}
            progressFading={progressFading}
            searchQueryActive={searchQueryActive}
            showSuggestions={showSuggestions}
            tasks={tasks}
            value={value}
            visible={visible}
            onAddExercise={onAddExercise}
            onAddTask={onAddTask}
            onFilterChange={onFilterChange}
            onSearchValueChange={onSearchValueChange}
            onShowSuggestionsChange={onShowSuggestionsChange}
          />
        </WorkoutEditorProvider>
      )}
    </div>
  );
}
