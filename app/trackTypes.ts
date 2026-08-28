import type { TimerMode } from "./components/TimerScreen";

export type SetEntry = {
  id: string;
  weight: string;
  unit: "kg" | "lb";
  reps: string;
  rir: string;
  lastWeight?: number;
  lastWeightUnit?: WeightUnit;
  lastReps?: number;
  lastRir?: number;
};

export type Task = {
  id: string;
  text: string;
  sets?: SetEntry[];
  weight?: string;
  unit?: "kg" | "lb";
  reps: string;
  rir: string;
  done: boolean;
  collapsed?: boolean;
  lastReps?: number;
  lastWeight?: number;
  lastWeightUnit?: WeightUnit;
};

export type Checklist = {
  id: string;
  title: string;
  tasks: Task[];
  updatedAt: number;
};

export type Filter = "all" | "open" | "done";
export type WeightUnit = "kg" | "lb";
export type ThemeMode = "light" | "dark";
export type AccountPresenceStatus = "connecting" | "online" | "offline";

// Runtime-only timer state is intentionally separate from workout snapshots.
// It contains no exercise, profile, or authentication data and is optional so
// existing accounts and older saved preferences remain fully compatible.
export type TimerRuntimeState = {
  // Optional keeps timer state written by older builds compatible. New saves
  // include the mode so a refresh cannot restore a rest timer as a stopwatch
  // when the separate UI preference has not hydrated yet.
  mode?: "stopwatch" | "rest";
  running: boolean;
  elapsedMs: number;
  startedAtMs: number | null;
  restRemainingMs: number;
  restEndsAtMs: number | null;
  laps: number[];
  updatedAt: number;
};

export type TrackPreferences = {
  defaultUnit: WeightUnit;
  timerMode: TimerMode;
  restSeconds: number;
  restCustom: boolean;
  rememberExercisesAcrossSplits: boolean;
  completionEnabled: boolean;
  timerRuntime?: TimerRuntimeState;
};

export type PersonalInfo = { heightCm: number; weightKg: number };

export type SettingsView =
  | "appearance"
  | "personal"
  | "privacy"
  | "updates"
  | "workout"
  | "data"
  | "ai"
  | "account"
  | "about"
  | "admin";

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };
export type TrackFunctionError = { code?: string; message?: string } | null | undefined;
export type ExportCell = string | number | null | undefined;
export type TrackAnnouncement = { id: string; message: string };

export type WorkoutLog = {
  exerciseId: string;
  exerciseName: string;
  setNumber: number;
  weight: number;
  unit: WeightUnit;
  reps: number;
  rir: number;
};

export type WorkoutSessionPayload = {
  splitId: string;
  splitName: string;
  logs: WorkoutLog[];
  clientMutationId: string;
  occurredAt: string;
  dateKey: string;
};

export type WorkoutDraft = {
  splitId: string;
  splitTitle: string;
  tasks: Task[];
  baselineTasks: Task[];
  startedAt: number;
  updatedAt: number;
  wasSaved: boolean;
};

export type ReleaseSignal = {
  source: string;
  remoteVersion: string;
  remoteBuildId?: string;
  detectedAt: number;
  countdownSeconds?: number;
};

export type RemoteRelease = { version: string; buildId?: string };
export type UpdateCheckResult = "update" | "current" | "error";
export type UpdatesViewStatus = "idle" | "checking" | "current" | "available" | "error";

export type AiExercise = {
  name: string;
  needsReview: boolean;
  sets: { weight: number; unit: "kg" | "lb"; reps: number; rir: number }[];
};

export type ExportSession = {
  id: string;
  split_id: string | null;
  split_name: string;
  created_at: string;
};

export type ExerciseHistoryEntry = {
  id: string;
  sessionId: string | null;
  splitId?: string | null;
  createdAt: string;
  setNumber: number;
  weight: number;
  unit: WeightUnit;
  reps: number;
  rir: number;
};

export type ExportLog = {
  session_id: string;
  exercise_id: string | null;
  exercise_name: string;
  set_number: number;
  weight: number;
  unit: WeightUnit;
  reps: number;
  rir: number;
  created_at: string;
};

export type UndoNotice = { message: string; undo: () => void };
export type SyncStatusTone = "saved" | "busy" | "warning" | "error";
export type TouchPoint = { clientX: number; clientY: number };
export type TouchListLike = { length: number; [index: number]: TouchPoint };

export type TrackSaveResult =
  | { ok: true; revision: number; method: "incremental" | "transaction" }
  | { ok: false; conflict?: boolean; revision?: number; message?: string };

export type WorkoutSaveResult =
  | { ok: true; sessionId: string; method: "transaction" }
  | { ok: false; message?: string };
