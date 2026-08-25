"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { SETTINGS_CONTENT_VIEWS, THEME_MODES, TRACK_LIMITS, TRACK_UI_COPY, WEIGHT_UNITS } from "../trackConstants";
import type {
  AiExercise,
  Checklist,
  SettingsView,
  Task,
  ThemeMode,
  UpdatesViewStatus,
  WeightUnit,
} from "../trackTypes";
import { useSettingsContext } from "../contexts/SettingsContext";
import { formatPersonalInput, PERSONAL_CONVERSION, toMetricPersonalInput } from "../personalMeasurements";
import { SettingsAboutView, SettingsAdminView, SettingsUpdatesView } from "./SettingsSpecialViews";

type NotificationState = NotificationPermission | "unsupported";
type ExportFormat = "csv" | "json";

export type SettingsViewContentProps = {
  active: Checklist | null;
  aiBusy: boolean;
  aiError: string;
  aiExercises: AiExercise[];
  aiKey: string;
  announcementComposerOpen: boolean;
  announcementSendBusy: boolean;
  announcementSendMessage: string;
  announcementText: string;
  completionEnabled: boolean;
  defaultUnit: WeightUnit;
  exportBusy: ExportFormat | null;
  exportMessage: string;
  isAdmin: boolean;
  nativeApp: boolean;
  notificationMessage: string;
  notificationPermission: NotificationState;
  notificationRequestBusy: boolean;
  notificationSettingsAvailable: boolean;
  personalHeightInput: string;
  personalInfoMessage: string;
  personalInfoSaving: boolean;
  personalWeightInput: string;
  releaseAvailable: boolean;
  rememberExercisesAcrossSplits: boolean;
  settingsView: SettingsView;
  tasks: Task[];
  themeMode: ThemeMode;
  updateCheckBusy: boolean;
  updateCheckMessage: string;
  updateVersion: string | null;
  updatesViewBusy: boolean;
  updatesViewStatus: UpdatesViewStatus;
  updatesViewMessage: string;
  onAddAiExercises: () => void;
  onAiExercisesChange: Dispatch<SetStateAction<AiExercise[]>>;
  onAiKeyChange: (value: string) => void;
  onApplyExerciseUnit: (taskId: string, unit: WeightUnit) => void;
  onApplyGlobalUnit: (unit: WeightUnit) => void;
  onApplyTheme: (mode: ThemeMode) => void;
  onCheckForUpdates: () => Promise<void>;
  onCompletionEnabledChange: (enabled: boolean) => void;
  onExportWorkoutData: (format: ExportFormat) => Promise<void>;
  onFakeUpdateNotification: () => void;
  onForceUpdateCheck: () => void;
  onImportWorkoutImage: (file?: File) => Promise<void>;
  onNotificationRequest: () => Promise<void>;
  onPersonalHeightChange: (value: string) => void;
  onPersonalWeightChange: (value: string) => void;
  onRememberExercisesChange: (enabled: boolean) => void;
  onSendAnnouncement: () => Promise<void>;
  onSetAdminAnnouncementOpen: (open: boolean) => void;
  onSetAnnouncementText: (value: string) => void;
  onSetSignOutConfirm: () => void;
  onSavePersonalInfo: () => Promise<void>;
};

export function SettingsViewContent(props: SettingsViewContentProps) {
  const {
    active,
    aiBusy,
    aiError,
    aiExercises,
    aiKey,
    completionEnabled,
    defaultUnit,
    exportBusy,
    exportMessage,
    isAdmin,
    notificationMessage,
    notificationPermission,
    notificationRequestBusy,
    notificationSettingsAvailable,
    personalHeightInput,
    personalInfoMessage,
    personalInfoSaving,
    personalWeightInput,
    rememberExercisesAcrossSplits,
    settingsView,
    tasks,
    themeMode,
    onAddAiExercises,
    onAiExercisesChange,
    onAiKeyChange,
    onApplyExerciseUnit,
    onApplyGlobalUnit,
    onApplyTheme,
    onCompletionEnabledChange,
    onExportWorkoutData,
    onImportWorkoutImage,
    onNotificationRequest,
    onPersonalHeightChange,
    onPersonalWeightChange,
    onRememberExercisesChange,
    onSetSignOutConfirm,
    onSavePersonalInfo,
  } = props;
  const [aiKeyVisible, setAiKeyVisible] = useState(false);
  const personalHeightUnit = defaultUnit === "lb" ? "in" : "cm";
  const personalWeightUnit = defaultUnit === "lb" ? "lbs" : "kg";
  const personalHeightMin =
    defaultUnit === "lb" ? TRACK_LIMITS.minHeightCm / PERSONAL_CONVERSION.centimetersPerInch : TRACK_LIMITS.minHeightCm;
  const personalHeightMax =
    defaultUnit === "lb" ? TRACK_LIMITS.maxHeightCm / PERSONAL_CONVERSION.centimetersPerInch : TRACK_LIMITS.maxHeightCm;
  const personalWeightMin =
    defaultUnit === "lb" ? TRACK_LIMITS.minWeightKg * PERSONAL_CONVERSION.poundsPerKilogram : TRACK_LIMITS.minWeightKg;
  const personalWeightMax =
    defaultUnit === "lb" ? TRACK_LIMITS.maxWeightKg * PERSONAL_CONVERSION.poundsPerKilogram : TRACK_LIMITS.maxWeightKg;

  if (settingsView === "updates") {
    return <SettingsUpdatesView {...props} />;
  }

  if (SETTINGS_CONTENT_VIEWS.includes(settingsView)) {
    return (
      <>
        <div className="setting-section">
          <div className="theme-preview-grid" aria-label="Theme previews">
            {THEME_MODES.map((mode) => (
              <button
                type="button"
                key={mode}
                className={themeMode === mode ? `theme-preview-tile ${mode} selected` : `theme-preview-tile ${mode}`}
                onClick={() => onApplyTheme(mode)}
                aria-pressed={themeMode === mode}
              >
                <span className="theme-preview-window" aria-hidden="true">
                  <i />
                  <span>
                    <i />
                    <i />
                    <i />
                  </span>
                </span>
                <strong>{mode[0].toUpperCase() + mode.slice(1)}</strong>
              </button>
            ))}
          </div>
        </div>

        <div className="setting-section personal-info-section">
          <div className="personal-info-copy">
            <strong>Your training profile</strong>
            <p>Used for Rank.</p>
          </div>
          <div className="personal-unit-selector">
            <span>Measurement system</span>
            <div className="segmented-control compact" role="group" aria-label="Personal information units">
              <button
                type="button"
                className={defaultUnit === "kg" ? "selected" : ""}
                onClick={() => onApplyGlobalUnit("kg")}
              >
                Metric <small>cm / kg</small>
              </button>
              <button
                type="button"
                className={defaultUnit === "lb" ? "selected" : ""}
                onClick={() => onApplyGlobalUnit("lb")}
              >
                Imperial <small>in / lbs</small>
              </button>
            </div>
          </div>
          <div className="personal-info-fields settings-personal-fields">
            <label>
              Height
              <div>
                <input
                  type="number"
                  inputMode="decimal"
                  min={personalHeightMin}
                  max={personalHeightMax}
                  step="0.1"
                  value={formatPersonalInput(personalHeightInput, "height", defaultUnit)}
                  onChange={(event) =>
                    onPersonalHeightChange(toMetricPersonalInput(event.target.value, "height", defaultUnit))
                  }
                />
                <small>{personalHeightUnit}</small>
              </div>
            </label>
            <label>
              Bodyweight
              <div>
                <input
                  type="number"
                  inputMode="decimal"
                  min={personalWeightMin}
                  max={personalWeightMax}
                  step="0.1"
                  value={formatPersonalInput(personalWeightInput, "weight", defaultUnit)}
                  onChange={(event) =>
                    onPersonalWeightChange(toMetricPersonalInput(event.target.value, "weight", defaultUnit))
                  }
                />
                <small>{personalWeightUnit}</small>
              </div>
            </label>
          </div>
          <div className="personal-info-actions">
            <span className={personalInfoMessage.startsWith("Saved") ? "personal-info-success" : "personal-info-error"}>
              {personalInfoMessage}
            </span>
            <button
              className="ui-button ui-button-primary"
              onClick={() => void onSavePersonalInfo()}
              disabled={personalInfoSaving}
            >
              {personalInfoSaving ? TRACK_UI_COPY.status.saving : "Save changes"}
            </button>
          </div>
        </div>

        <div className="setting-section">
          {settingsView === "account" && <h3>Privacy &amp; Notifications</h3>}
          <div className="setting-row notification-setting-row">
            <div>
              <strong>Device notifications</strong>
              {notificationMessage && <small className="notification-setting-message">{notificationMessage}</small>}
              {notificationPermission === "denied" && (
                <small className="notification-setting-help">
                  {notificationSettingsAvailable
                    ? "Open Settings, choose Track II, and turn on Allow Notifications."
                    : "Notifications are blocked by the browser. Allow Track II in this site’s permissions, then try again."}
                </small>
              )}
              {notificationPermission === "unsupported" && (
                <small className="notification-setting-help">This browser does not support device notifications.</small>
              )}
            </div>
            <button
              className="permission-button ui-button ui-button-secondary"
              onClick={() => void onNotificationRequest()}
              disabled={
                notificationPermission === "granted" ||
                notificationPermission === "unsupported" ||
                notificationRequestBusy
              }
            >
              {notificationRequestBusy
                ? "Opening…"
                : notificationPermission === "granted"
                  ? "Enabled"
                  : notificationPermission === "denied"
                    ? notificationSettingsAvailable
                      ? "Open Settings"
                      : "Blocked"
                    : notificationPermission === "unsupported"
                      ? "Unavailable"
                      : "Enable"}
            </button>
          </div>
        </div>

        <div className="setting-section">
          <div className="setting-row">
            <div>
              <strong>Exercise completion</strong>
              <p>Show completion controls.</p>
            </div>
            <button
              className={completionEnabled ? "theme-toggle on" : "theme-toggle"}
              onClick={() => onCompletionEnabledChange(!completionEnabled)}
              role="switch"
              aria-checked={completionEnabled}
              aria-label="Toggle exercise completion"
            >
              <span />
            </button>
          </div>
          <div className="setting-row">
            <div>
              <strong>Remember exercises across splits</strong>
              <p>Carry progress across splits.</p>
            </div>
            <button
              className={rememberExercisesAcrossSplits ? "theme-toggle on" : "theme-toggle"}
              onClick={() => onRememberExercisesChange(!rememberExercisesAcrossSplits)}
              role="switch"
              aria-checked={rememberExercisesAcrossSplits}
              aria-label="Remember exercises across splits"
            >
              <span />
            </button>
          </div>
          {active && tasks.length > 0 && (
            <div className="exercise-unit-settings">
              <div className="setting-subhead">
                <strong>Exercise units</strong>
                <span>{active.title}</span>
              </div>
              {tasks.map((task) => {
                const units = new Set((task.sets ?? []).map((set) => set.unit));
                return (
                  <div className="exercise-unit-row" key={task.id}>
                    <span>{task.text}</span>
                    <div className="segmented-control compact">
                      {WEIGHT_UNITS.map((unit) => (
                        <button
                          key={unit}
                          className={units.size === 1 && units.has(unit) ? "selected" : ""}
                          onClick={() => onApplyExerciseUnit(task.id, unit)}
                        >
                          {unit.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="setting-section data-export-section">
          {settingsView === "account" && <h3>Data &amp; Backup</h3>}
          <div className="export-copy">
            <strong>Keep a copy of your training data</strong>
            <p>Export your workouts for backup or move them to another Track II browser.</p>
          </div>
          <div className="export-actions export-card">
            <button
              type="button"
              className="ui-button ui-button-secondary export-action-button"
              onClick={() => void onExportWorkoutData("csv")}
              disabled={exportBusy !== null}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v2h14v-2" />
              </svg>
              {exportBusy === "csv" ? TRACK_UI_COPY.status.loading : "Export CSV"}
            </button>
            <button
              type="button"
              className="ui-button ui-button-secondary export-action-button"
              onClick={() => void onExportWorkoutData("json")}
              disabled={exportBusy !== null}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v2h14v-2" />
              </svg>
              {exportBusy === "json" ? TRACK_UI_COPY.status.loading : "Export JSON"}
            </button>
          </div>
          {exportMessage && (
            <div className="export-message" role="status">
              {exportMessage}
            </div>
          )}
        </div>

        <div className="setting-section ai-import-section">
          <div className="ai-intro">
            <div>
              <strong>Import workout from a picture</strong>
              <p>Review before adding.</p>
            </div>
          </div>
          <label className="ai-key-label">
            <span>Gemini API key</span>
            <div className="ai-key-control">
              <input
                type={aiKeyVisible ? "text" : "password"}
                value={aiKey}
                onChange={(event) => onAiKeyChange(event.target.value)}
                placeholder="Paste your key for this browser tab"
                autoComplete="off"
              />
              <button
                type="button"
                className="ai-key-visibility"
                onClick={() => setAiKeyVisible((visible) => !visible)}
                aria-label={aiKeyVisible ? "Hide Gemini API key" : "Show Gemini API key"}
                aria-pressed={aiKeyVisible}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  {aiKeyVisible ? (
                    <>
                      <path d="M3 12s3.2-6 9-6 9 6 9 6-3.2 6-9 6-9-6-9-6Z" />
                      <circle cx="12" cy="12" r="2.5" />
                    </>
                  ) : (
                    <>
                      <path d="m4 4 16 16M10.6 6.2A9.6 9.6 0 0 1 12 6c5.8 0 9 6 9 6a16 16 0 0 1-3.1 3.7M6.1 8.1C4.2 9.7 3 12 3 12s3.2 6 9 6c1 0 1.9-.2 2.7-.5" />
                    </>
                  )}
                </svg>
              </button>
            </div>
          </label>
          <div className="ai-privacy">
            Your key stays in memory and is cleared when Track II closes or you sign out.
          </div>
          <div className="ai-key-help">
            <strong>How to get a Gemini API key</strong>
            <ol>
              <li>Open Google AI Studio and sign in.</li>
              <li>
                Select <b>Create API key</b> on the API keys page.
              </li>
              <li>Copy the key and paste it above. Never share it or commit it to GitHub.</li>
            </ol>
            <div className="ai-key-help-links">
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">
                Open Google AI Studio
              </a>
              <a href="https://ai.google.dev/gemini-api/docs/api-key" target="_blank" rel="noopener noreferrer">
                Read Google&apos;s key-safety guide
              </a>
            </div>
          </div>
          <label className={aiBusy ? "ai-upload busy" : "ai-upload"}>
            <input
              type="file"
              accept="image/*"
              disabled={aiBusy}
              onChange={(event) => {
                void onImportWorkoutImage(event.target.files?.[0]);
                event.currentTarget.value = "";
              }}
            />
            <span className="ai-upload-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 8.5 4 4 0 0 0 7 18Z" />
                <path d="M12 15V9m0 0 2.5 2.5M12 9 9.5 11.5" />
              </svg>
            </span>
            <strong>{aiBusy ? "Reading workout…" : "Choose or take a picture"}</strong>
            <small>Camera, photo library, JPG, PNG, or HEIC · up to 8 MB</small>
          </label>
          {aiError && <div className="ai-error">{aiError}</div>}
          {aiExercises.length > 0 && (
            <div className="ai-review">
              <div className="ai-review-heading">
                <div>
                  <strong>Review import</strong>
                  <span>
                    {aiExercises.length} {aiExercises.length === 1 ? "exercise" : "exercises"} detected
                  </span>
                </div>
                <button onClick={() => onAiExercisesChange([])}>Discard</button>
              </div>
              {aiExercises.map((exercise, exerciseIndex) => (
                <div className="ai-exercise" key={`${exerciseIndex}-${exercise.name}`}>
                  <div className="ai-exercise-head">
                    <input
                      value={exercise.name}
                      onChange={(event) =>
                        onAiExercisesChange((current) =>
                          current.map((item, index) =>
                            index === exerciseIndex ? { ...item, name: event.target.value } : item,
                          ),
                        )
                      }
                      aria-label={`Exercise ${exerciseIndex + 1} name`}
                    />
                    {exercise.needsReview && <span>Needs review</span>}
                    <button
                      onClick={() =>
                        onAiExercisesChange((current) => current.filter((_, index) => index !== exerciseIndex))
                      }
                      aria-label={`Remove ${exercise.name}`}
                    >
                      ×
                    </button>
                  </div>
                  <div className="ai-set-head">
                    <span>Set</span>
                    <span>Weight</span>
                    <span>Reps</span>
                    <span>RIR</span>
                  </div>
                  {exercise.sets.map((set, setIndex) => (
                    <div className="ai-set" key={setIndex}>
                      <span>{setIndex + 1}</span>
                      <label>
                        <input
                          type="number"
                          min="0"
                          value={set.weight}
                          onChange={(event) =>
                            onAiExercisesChange((current) =>
                              current.map((item, index) =>
                                index === exerciseIndex
                                  ? {
                                      ...item,
                                      sets: item.sets.map((entry, index2) =>
                                        index2 === setIndex ? { ...entry, weight: Number(event.target.value) } : entry,
                                      ),
                                    }
                                  : item,
                              ),
                            )
                          }
                        />
                        <small>{set.unit}</small>
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={set.reps}
                        onChange={(event) =>
                          onAiExercisesChange((current) =>
                            current.map((item, index) =>
                              index === exerciseIndex
                                ? {
                                    ...item,
                                    sets: item.sets.map((entry, index2) =>
                                      index2 === setIndex ? { ...entry, reps: Number(event.target.value) } : entry,
                                    ),
                                  }
                                : item,
                            ),
                          )
                        }
                      />
                      <input
                        type="number"
                        min="0"
                        value={set.rir}
                        onChange={(event) =>
                          onAiExercisesChange((current) =>
                            current.map((item, index) =>
                              index === exerciseIndex
                                ? {
                                    ...item,
                                    sets: item.sets.map((entry, index2) =>
                                      index2 === setIndex ? { ...entry, rir: Number(event.target.value) } : entry,
                                    ),
                                  }
                                : item,
                            ),
                          )
                        }
                      />
                    </div>
                  ))}
                </div>
              ))}
              <button className="ai-add-button" onClick={onAddAiExercises}>
                {active ? `Add ${aiExercises.length} to ${active.title}` : `Create split with ${aiExercises.length}`}
              </button>
            </div>
          )}
        </div>

        <div className="setting-section account-actions-section">
          <h3>Account</h3>
          <div className="setting-row">
            <div>
              <strong>Sign out of Track II</strong>
            </div>
            <button className="settings-sign-out ui-button ui-button-danger" onClick={onSetSignOutConfirm}>
              Sign out
            </button>
          </div>
        </div>
      </>
    );
  }

  if (settingsView === "about") {
    return <SettingsAboutView />;
  }

  if (settingsView === "admin" && isAdmin) {
    return <SettingsAdminView {...props} />;
  }

  return null;
}

export function ConnectedSettingsViewContent() {
  return <SettingsViewContent {...useSettingsContext()} />;
}
