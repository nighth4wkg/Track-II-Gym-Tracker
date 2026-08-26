import { THEME_MODES, TRACK_LIMITS, TRACK_UI_COPY, WEIGHT_UNITS } from "../trackConstants";
import { formatPersonalInput, PERSONAL_CONVERSION, toMetricPersonalInput } from "../personalMeasurements";
import type { SettingsViewContentProps } from "./SettingsViewContent";
import { SettingsProgressSync } from "./SettingsProgressSync";

const EXPORT_FORMATS = [
  { format: "csv", label: "Export CSV" },
  { format: "json", label: "Export JSON" },
] as const;

function AppearanceSettings({ onApplyTheme, themeMode }: SettingsViewContentProps) {
  return (
    <div className="setting-section is-active">
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
  );
}

function PersonalSettings(props: SettingsViewContentProps) {
  const {
    defaultUnit,
    onApplyGlobalUnit,
    onPersonalHeightChange,
    onPersonalWeightChange,
    onSavePersonalInfo,
    personalHeightInput,
    personalInfoMessage,
    personalInfoSaving,
    personalWeightInput,
  } = props;
  const imperial = defaultUnit === "lb";
  const personalHeightUnit = imperial ? "in" : "cm";
  const personalWeightUnit = imperial ? "lbs" : "kg";
  const personalHeightMin = imperial
    ? TRACK_LIMITS.minHeightCm / PERSONAL_CONVERSION.centimetersPerInch
    : TRACK_LIMITS.minHeightCm;
  const personalHeightMax = imperial
    ? TRACK_LIMITS.maxHeightCm / PERSONAL_CONVERSION.centimetersPerInch
    : TRACK_LIMITS.maxHeightCm;
  const personalWeightMin = imperial
    ? TRACK_LIMITS.minWeightKg * PERSONAL_CONVERSION.poundsPerKilogram
    : TRACK_LIMITS.minWeightKg;
  const personalWeightMax = imperial
    ? TRACK_LIMITS.maxWeightKg * PERSONAL_CONVERSION.poundsPerKilogram
    : TRACK_LIMITS.maxWeightKg;

  return (
    <div className="setting-section personal-info-section is-active">
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
          <button type="button" className={imperial ? "selected" : ""} onClick={() => onApplyGlobalUnit("lb")}>
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
          type="button"
          className="ui-button ui-button-primary"
          onClick={() => void onSavePersonalInfo()}
          disabled={personalInfoSaving}
        >
          {personalInfoSaving ? TRACK_UI_COPY.status.saving : "Save changes"}
        </button>
      </div>
    </div>
  );
}

function NotificationSettings({
  notificationMessage,
  notificationPermission,
  notificationRequestBusy,
  notificationSettingsAvailable,
  onNotificationRequest,
}: SettingsViewContentProps) {
  const actionLabel = notificationRequestBusy
    ? "Opening…"
    : notificationPermission === "granted"
      ? "Enabled"
      : notificationPermission === "denied"
        ? notificationSettingsAvailable
          ? "Open Settings"
          : "Blocked"
        : notificationPermission === "unsupported"
          ? "Unavailable"
          : "Enable";

  return (
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
        type="button"
        className="permission-button ui-button ui-button-secondary"
        onClick={() => void onNotificationRequest()}
        disabled={
          notificationPermission === "granted" || notificationPermission === "unsupported" || notificationRequestBusy
        }
      >
        {actionLabel}
      </button>
    </div>
  );
}

function WorkoutSettings(props: SettingsViewContentProps) {
  const {
    active,
    completionEnabled,
    onApplyExerciseUnit,
    onCompletionEnabledChange,
    onRememberExercisesChange,
    onSyncExerciseProgress,
    rememberExercisesAcrossSplits,
    syncProgressPreview,
    tasks,
  } = props;

  return (
    <div className="setting-section is-active">
      <div className="setting-row">
        <div>
          <strong>Exercise completion</strong>
          <p>Show completion controls.</p>
        </div>
        <button
          type="button"
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
          type="button"
          className={rememberExercisesAcrossSplits ? "theme-toggle on" : "theme-toggle"}
          onClick={() => onRememberExercisesChange(!rememberExercisesAcrossSplits)}
          role="switch"
          aria-checked={rememberExercisesAcrossSplits}
          aria-label="Remember exercises across splits"
        >
          <span />
        </button>
      </div>
      <SettingsProgressSync preview={syncProgressPreview} onSync={onSyncExerciseProgress} />
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
                      type="button"
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
  );
}

function DataExportSettings({
  exportBusy,
  exportMessage,
  heading = false,
  onExportWorkoutData,
}: SettingsViewContentProps & { heading?: boolean }) {
  return (
    <div className="setting-section data-export-section is-active">
      {heading && <h3>Data &amp; Backup</h3>}
      <div className="export-copy">
        <strong>Keep a copy of your training data</strong>
        <p>Export your workouts for backup or move them to another Track II browser.</p>
      </div>
      <div className="export-actions export-card">
        {EXPORT_FORMATS.map(({ format, label }) => (
          <button
            type="button"
            className="ui-button ui-button-secondary export-action-button"
            onClick={() => void onExportWorkoutData(format)}
            disabled={exportBusy !== null}
            key={format}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v2h14v-2" />
            </svg>
            {exportBusy === format ? TRACK_UI_COPY.status.loading : label}
          </button>
        ))}
      </div>
      {exportMessage && (
        <div className="export-message" role="status">
          {exportMessage}
        </div>
      )}
    </div>
  );
}

function AccountSettings(props: SettingsViewContentProps) {
  return (
    <>
      <div className="setting-section is-active">
        <h3>Privacy &amp; Notifications</h3>
        <NotificationSettings {...props} />
      </div>
      <DataExportSettings {...props} heading />
      <div className="setting-section account-actions-section is-active">
        <h3>Account</h3>
        <div className="setting-row">
          <div>
            <strong>Sign out of Track II</strong>
          </div>
          <button
            type="button"
            className="settings-sign-out ui-button ui-button-danger"
            onClick={props.onSetSignOutConfirm}
          >
            Sign out
          </button>
        </div>
      </div>
    </>
  );
}

export function SettingsStandardViews(props: SettingsViewContentProps) {
  switch (props.settingsView) {
    case "appearance":
      return <AppearanceSettings {...props} />;
    case "personal":
      return <PersonalSettings {...props} />;
    case "privacy":
      return (
        <div className="setting-section is-active">
          <NotificationSettings {...props} />
        </div>
      );
    case "workout":
      return <WorkoutSettings {...props} />;
    case "data":
      return <DataExportSettings {...props} />;
    case "account":
      return <AccountSettings {...props} />;
    default:
      return null;
  }
}
