"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

type SettingsProgressSyncProps = {
  preview: { exerciseCount: number; splitCount: number };
  onSync: () => { exerciseCount: number; splitCount: number };
};

export function SettingsProgressSync({ preview, onSync }: SettingsProgressSyncProps) {
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [message, setMessage] = useState("");

  return (
    <>
      <div className="setting-row progress-sync-row">
        <div>
          <strong>Sync latest exercise progress</strong>
          <p>Use the newest weight, reps, and RIR for matching exercises in every split.</p>
          {message && (
            <small className="progress-sync-message" role="status">
              {message}
            </small>
          )}
        </div>
        <button
          type="button"
          className="ui-button ui-button-secondary"
          disabled={preview.exerciseCount === 0}
          onClick={() => {
            setMessage("");
            setConfirmationOpen(true);
          }}
        >
          {preview.exerciseCount === 0 ? "Already synced" : "Review sync"}
        </button>
      </div>
      {confirmationOpen &&
        globalThis.document &&
        createPortal(
          <div
            className="progress-sync-backdrop"
            role="presentation"
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) setConfirmationOpen(false);
            }}
          >
            <section
              className="progress-sync-confirm"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="progress-sync-title"
              aria-describedby="progress-sync-description"
            >
              <span className="progress-sync-icon" aria-hidden="true">
                ↻
              </span>
              <h3 id="progress-sync-title">Replace older exercise progress?</h3>
              <p id="progress-sync-description">
                This will update {preview.exerciseCount} matching{" "}
                {preview.exerciseCount === 1 ? "exercise" : "exercises"}
                {" across "}
                {preview.splitCount} {preview.splitCount === 1 ? "split" : "splits"} with the newest weight, reps, and
                RIR.
              </p>
              <small>
                Workout history, exercise names, completion state, and set counts will not be deleted. Undo remains
                available.
              </small>
              <div className="progress-sync-actions">
                <button
                  type="button"
                  className="ui-button ui-button-secondary"
                  onClick={() => setConfirmationOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="ui-button ui-button-primary"
                  onClick={() => {
                    const result = onSync();
                    setConfirmationOpen(false);
                    setMessage(
                      result.exerciseCount
                        ? `Updated ${result.exerciseCount} ${result.exerciseCount === 1 ? "exercise" : "exercises"} across ${result.splitCount} ${result.splitCount === 1 ? "split" : "splits"}.`
                        : "Every matching exercise is already using the latest data.",
                    );
                  }}
                >
                  Replace older data
                </button>
              </div>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
