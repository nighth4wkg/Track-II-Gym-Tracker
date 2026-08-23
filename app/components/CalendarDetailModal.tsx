"use client";

import { createPortal } from "react-dom";
import type {
  Dispatch,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
  SetStateAction,
} from "react";
import type { WorkoutDayDetail } from "../data/calendarWorkoutData";
import { CalendarDetailSkeleton } from "./LoadingSkeletons";

type DetailScrollState = { canScroll: boolean; thumbSize: number; thumbOffset: number; value: number };

type CalendarDetailModalProps = {
  selectedDate: string;
  detail: WorkoutDayDetail | null;
  detailLoading: boolean;
  expandedExercises: string[];
  noteEditing: boolean;
  noteDraft: string;
  noteSaving: boolean;
  noteError: string;
  deletingWorkout: boolean;
  deleteError: string;
  detailScroll: DetailScrollState;
  detailModalRef: RefObject<HTMLElement | null>;
  detailScrollRef: RefObject<HTMLDivElement | null>;
  detailScrollTrackRef: RefObject<HTMLDivElement | null>;
  detailScrollThumbRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onExpandedExercisesChange: Dispatch<SetStateAction<string[]>>;
  onNoteEditingChange: Dispatch<SetStateAction<boolean>>;
  onNoteDraftChange: Dispatch<SetStateAction<string>>;
  onNoteErrorChange: Dispatch<SetStateAction<string>>;
  onSaveNote: () => void;
  onDeleteWorkout: () => void;
  onScroll: () => void;
  onTrackPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onThumbPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onThumbPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onThumbPointerEnd: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onThumbKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
};

export function CalendarDetailModal({
  selectedDate,
  detail,
  detailLoading,
  expandedExercises,
  noteEditing,
  noteDraft,
  noteSaving,
  noteError,
  deletingWorkout,
  deleteError,
  detailScroll,
  detailModalRef,
  detailScrollRef,
  detailScrollTrackRef,
  detailScrollThumbRef,
  onClose,
  onExpandedExercisesChange,
  onNoteEditingChange,
  onNoteDraftChange,
  onNoteErrorChange,
  onSaveNote,
  onDeleteWorkout,
  onScroll,
  onTrackPointerDown,
  onThumbPointerDown,
  onThumbPointerMove,
  onThumbPointerEnd,
  onThumbKeyDown,
}: CalendarDetailModalProps) {
  if (!globalThis.document) return null;
  return createPortal(
    <div
      className="calendar-detail-backdrop"
      onPointerDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        ref={detailModalRef}
        className="calendar-detail-modal ui-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-detail-title"
        tabIndex={-1}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button className="calendar-detail-close" onClick={onClose} aria-label="Close workout details">
          ×
        </button>
        <div className="calendar-detail-scroll-wrap">
          <div id="calendar-detail-scroll" className="calendar-detail-scroll" ref={detailScrollRef} onScroll={onScroll}>
            <div className="calendar-detail-header">
              <span className="settings-kicker">WORKOUT DETAIL</span>
              <h2 id="calendar-detail-title">
                {new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </h2>
            </div>
            {detailLoading ? (
              <CalendarDetailSkeleton />
            ) : detail ? (
              <>
                <div className="calendar-detail-stats">
                  <div>
                    <span>Exercises</span>
                    <strong>{detail.exercises.length}</strong>
                  </div>
                </div>
                <div className="calendar-detail-section">
                  <span className="calendar-detail-label">EXERCISES</span>
                  {detail.exercises.length ? (
                    <div className="calendar-detail-exercise-list">
                      {detail.exercises.map((exercise, index) => {
                        const expanded = expandedExercises.includes(exercise.name);
                        const panelId = `calendar-detail-exercise-${index}`;
                        return (
                          <div className="calendar-detail-exercise" key={exercise.name}>
                            <div className="calendar-detail-exercise-row">
                              <div className="calendar-detail-exercise-copy">
                                <strong>{exercise.name}</strong>
                              </div>
                              <button
                                type="button"
                                className="calendar-detail-expand"
                                aria-expanded={expanded}
                                aria-controls={panelId}
                                aria-label={`${expanded ? "Collapse " : "Expand "}${exercise.name} details`}
                                onClick={() =>
                                  onExpandedExercisesChange((current) =>
                                    current.includes(exercise.name)
                                      ? current.filter((name) => name !== exercise.name)
                                      : [...current, exercise.name],
                                  )
                                }
                              >
                                <span
                                  className={
                                    expanded ? "calendar-detail-expand-icon expanded" : "calendar-detail-expand-icon"
                                  }
                                  aria-hidden="true"
                                />
                              </button>
                            </div>
                            {expanded && (
                              <div
                                id={panelId}
                                className="calendar-detail-exercise-info"
                                role="region"
                                aria-label={`${exercise.name} set details`}
                              >
                                {exercise.setsDetail.length ? (
                                  <>
                                    <div className="calendar-detail-set-head">
                                      <span>SET</span>
                                      <span>WEIGHT</span>
                                      <span>REPS</span>
                                      <span>RIR</span>
                                    </div>
                                    <div className="calendar-detail-set-list">
                                      {exercise.setsDetail.map((set) => (
                                        <div key={`${exercise.name}-${set.setNumber}`}>
                                          <b>#{set.setNumber}</b>
                                          <span>
                                            {set.weight} {set.unit.toUpperCase()}
                                          </span>
                                          <span>{set.reps}</span>
                                          <span>{set.rir}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </>
                                ) : (
                                  <span>No set details</span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p>No exercise sets were recorded.</p>
                  )}
                </div>
                <div className="calendar-detail-total">
                  <span>Total tonnage</span>
                  <strong>{detail.tonnageKg.toFixed(1)} kg</strong>
                </div>
                <div className="calendar-detail-section calendar-detail-notes">
                  <div className="calendar-detail-notes-heading">
                    <span className="calendar-detail-label">NOTES</span>
                    {!noteEditing && (
                      <button
                        type="button"
                        className="calendar-note-edit"
                        onClick={() => {
                          onNoteDraftChange(detail.notes);
                          onNoteEditingChange(true);
                        }}
                      >
                        Edit note
                      </button>
                    )}
                  </div>
                  {noteEditing ? (
                    <>
                      <textarea
                        value={noteDraft}
                        onChange={(event) => onNoteDraftChange(event.target.value)}
                        maxLength={2000}
                        placeholder="Add a note about this workout..."
                        aria-label="Workout note"
                        autoFocus
                      />
                      <div className="calendar-note-actions">
                        <button
                          type="button"
                          className="ui-button ui-button-quiet"
                          onClick={() => {
                            onNoteEditingChange(false);
                            onNoteDraftChange(detail.notes);
                            onNoteErrorChange("");
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="primary ui-button ui-button-primary"
                          onClick={onSaveNote}
                          disabled={noteSaving}
                        >
                          {noteSaving ? "Saving…" : "Save note"}
                        </button>
                      </div>
                      {noteError && <p className="calendar-note-error">{noteError}</p>}
                    </>
                  ) : (
                    <p>{detail.notes || "No note yet."}</p>
                  )}
                </div>
                <div className="calendar-detail-actions">
                  <button
                    type="button"
                    className="delete-workout-button ui-button ui-button-danger"
                    onClick={onDeleteWorkout}
                    disabled={deletingWorkout}
                  >
                    {deletingWorkout ? "Deleting…" : "Delete workout"}
                  </button>
                  {deleteError && <p className="calendar-note-error">{deleteError}</p>}
                </div>
              </>
            ) : (
              <p className="calendar-detail-loading">Can’t load this workout.</p>
            )}
          </div>
          {detailScroll.canScroll && (
            <div className="calendar-detail-scrollbar" ref={detailScrollTrackRef} onPointerDown={onTrackPointerDown}>
              <div
                ref={detailScrollThumbRef}
                className="calendar-detail-scrollbar-thumb"
                role="scrollbar"
                aria-orientation="vertical"
                aria-controls="calendar-detail-scroll"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(detailScroll.value)}
                aria-valuetext={`${Math.round(detailScroll.value)}% through workout details`}
                aria-label="Workout detail scroll position"
                tabIndex={0}
                onPointerDown={onThumbPointerDown}
                onPointerMove={onThumbPointerMove}
                onPointerUp={onThumbPointerEnd}
                onPointerCancel={onThumbPointerEnd}
                onKeyDown={onThumbKeyDown}
              />
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}
