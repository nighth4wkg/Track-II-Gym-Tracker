"use client";

import { useState } from "react";
import { TRACK_LIMITS } from "../trackConstants";
import { GEMINI_API_KEY_DOCS_URL, GEMINI_API_KEY_URL } from "../trackConfig";
import type { AiExercise } from "../trackTypes";
import type { SettingsViewContentProps } from "./SettingsViewContent";

type AiSet = AiExercise["sets"][number];

export function SettingsAiImportView({
  active,
  aiBusy,
  aiError,
  aiExercises,
  aiKey,
  onAddAiExercises,
  onAiExercisesChange,
  onAiKeyChange,
  onImportWorkoutImage,
}: SettingsViewContentProps) {
  const [aiKeyVisible, setAiKeyVisible] = useState(false);
  const maxImageMegabytes = Math.round(TRACK_LIMITS.maxAiImageBytes / (1024 * 1024));

  const updateExercise = (exerciseIndex: number, update: (exercise: AiExercise) => AiExercise) => {
    onAiExercisesChange((current) =>
      current.map((exercise, index) => (index === exerciseIndex ? update(exercise) : exercise)),
    );
  };

  const updateSet = (exerciseIndex: number, setIndex: number, patch: Partial<AiSet>) => {
    updateExercise(exerciseIndex, (exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set, index) => (index === setIndex ? { ...set, ...patch } : set)),
    }));
  };

  return (
    <div className="setting-section ai-import-section is-active">
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
      <div className="ai-privacy">Your key stays in memory and is cleared when Track II closes or you sign out.</div>
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
          <a href={GEMINI_API_KEY_URL} target="_blank" rel="noopener noreferrer">
            Open Google AI Studio
          </a>
          <a href={GEMINI_API_KEY_DOCS_URL} target="_blank" rel="noopener noreferrer">
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
        <small>Camera, photo library, JPG, PNG, or HEIC · up to {maxImageMegabytes} MB</small>
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
                    updateExercise(exerciseIndex, (current) => ({ ...current, name: event.target.value }))
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
                      onChange={(event) => updateSet(exerciseIndex, setIndex, { weight: Number(event.target.value) })}
                    />
                    <small>{set.unit}</small>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={set.reps}
                    onChange={(event) => updateSet(exerciseIndex, setIndex, { reps: Number(event.target.value) })}
                  />
                  <input
                    type="number"
                    min="0"
                    value={set.rir}
                    onChange={(event) => updateSet(exerciseIndex, setIndex, { rir: Number(event.target.value) })}
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
  );
}
