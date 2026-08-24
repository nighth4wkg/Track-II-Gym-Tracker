"use client";

import { useId, useState, type FormEvent, type KeyboardEvent, type RefObject } from "react";
import { ConnectedTaskCard } from "./TaskCard";
import { FILTER_LABELS, FILTER_OPTIONS, TRACK_INTERACTION } from "../trackConstants";
import type { Checklist, Filter, Task } from "../trackTypes";

type WorkoutPageProps = {
  active: Checklist;
  completionEnabled: boolean;
  composerRef: RefObject<HTMLFormElement | null>;
  exerciseSuggestions: string[];
  filter: Filter;
  inputRef: RefObject<HTMLInputElement | null>;
  openCount: number;
  progressFading: boolean;
  searchQueryActive: boolean;
  showSuggestions: boolean;
  quickPickExercises: readonly string[];
  tasks: Task[];
  value: string;
  visible: Task[];
  onAddExercise: (name: string) => void;
  onAddTask: (event: FormEvent<HTMLFormElement>) => void;
  onFilterChange: (filter: Filter) => void;
  onSearchValueChange: (value: string) => void;
  onShowSuggestionsChange: (show: boolean) => void;
};

export function WorkoutPage({
  active,
  completionEnabled,
  composerRef,
  exerciseSuggestions,
  filter,
  inputRef,
  openCount,
  progressFading,
  quickPickExercises,
  searchQueryActive,
  showSuggestions,
  tasks,
  value,
  visible,
  onAddExercise,
  onAddTask,
  onFilterChange,
  onSearchValueChange,
  onShowSuggestionsChange,
}: WorkoutPageProps) {
  const suggestionListId = useId();
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const suggestionsVisible = showSuggestions && searchQueryActive && exerciseSuggestions.length > 0;

  const toggleMobileSearch = () => {
    const nextOpen = !mobileSearchOpen;
    setMobileSearchOpen(nextOpen);
    if (nextOpen) {
      window.requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    setActiveSuggestionIndex(-1);
    onShowSuggestionsChange(false);
  };

  const chooseSuggestion = (index: number) => {
    const suggestion = exerciseSuggestions[index];
    if (!suggestion) return;
    setActiveSuggestionIndex(-1);
    onShowSuggestionsChange(false);
    onAddExercise(suggestion);
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!exerciseSuggestions.length) return;
      event.preventDefault();
      onShowSuggestionsChange(true);
      setActiveSuggestionIndex((current) => {
        if (event.key === "ArrowDown") return current < exerciseSuggestions.length - 1 ? current + 1 : 0;
        return current > 0 ? current - 1 : exerciseSuggestions.length - 1;
      });
      return;
    }
    if (event.key === "Enter" && suggestionsVisible && activeSuggestionIndex >= 0) {
      event.preventDefault();
      chooseSuggestion(activeSuggestionIndex);
      return;
    }
    if (event.key === "Escape" && suggestionsVisible) {
      event.preventDefault();
      setActiveSuggestionIndex(-1);
      onShowSuggestionsChange(false);
    }
  };

  return (
    <div className="workout-page">
      <div className="eyebrow">WORKOUT SPLIT</div>
      <div className="title-row">
        <div>
          <h1>{active.title}</h1>
          <p>
            {tasks.length === 0
              ? "Add an exercise to start."
              : `${tasks.length} ${tasks.length === 1 ? "exercise" : "exercises"}`}
          </p>
        </div>
        <button
          type="button"
          className="mobile-search-toggle"
          aria-label={mobileSearchOpen ? "Hide exercise search" : "Search exercises"}
          aria-expanded={mobileSearchOpen}
          onClick={toggleMobileSearch}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="10.8" cy="10.8" r="6.4" />
            <path d="m15.6 15.6 4.2 4.2" />
          </svg>
        </button>
      </div>
      <form
        ref={composerRef}
        className={`composer exercise-composer${mobileSearchOpen ? " is-mobile-search-open" : ""}`}
        onSubmit={onAddTask}
      >
        <div className="exercise-search">
          <span className="search-icon">⌕</span>
          <input
            ref={inputRef}
            value={value}
            onChange={(event) => {
              const nextValue = event.target.value;
              setActiveSuggestionIndex(-1);
              onSearchValueChange(nextValue);
              onShowSuggestionsChange(Boolean(nextValue.trim()));
            }}
            onFocus={() => {
              setMobileSearchOpen(true);
              if (searchQueryActive) onShowSuggestionsChange(true);
            }}
            onBlur={() =>
              window.setTimeout(() => {
                setActiveSuggestionIndex(-1);
                onShowSuggestionsChange(false);
              }, TRACK_INTERACTION.focusDelayMs)
            }
            onKeyDown={handleSearchKeyDown}
            placeholder="Search exercises…"
            aria-label="Search exercise library"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={suggestionsVisible}
            aria-controls={suggestionsVisible ? suggestionListId : undefined}
            aria-activedescendant={
              activeSuggestionIndex >= 0 ? `${suggestionListId}-option-${activeSuggestionIndex}` : undefined
            }
            autoComplete="off"
          />
        </div>
        {suggestionsVisible && (
          <div className="suggestions" role="listbox" id={suggestionListId} aria-label="Exercise suggestions">
            {exerciseSuggestions.map((name, index) => (
              <button
                type="button"
                key={name}
                id={`${suggestionListId}-option-${index}`}
                role="option"
                aria-selected={activeSuggestionIndex === index}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveSuggestionIndex(index)}
                onClick={() => chooseSuggestion(index)}
              >
                <span className="suggestion-icon" aria-hidden="true">
                  +
                </span>
                <span>{name}</span>
              </button>
            ))}
          </div>
        )}
        <button
          type="submit"
          className="search-add-button ui-button ui-button-primary"
          aria-label="Add exercise"
          disabled={!value.trim()}
        >
          ＋ Add
        </button>
      </form>
      {completionEnabled && (
        <nav className="desktop-filters" aria-label="Exercise filters">
          {FILTER_OPTIONS.map((name) => (
            <button
              key={name}
              className={filter === name ? "nav-item active" : "nav-item"}
              onClick={() => onFilterChange(name)}
            >
              <span>{name === "all" ? "☷" : name === "open" ? "○" : "✓"}</span> {FILTER_LABELS[name]}{" "}
              <b>{name === "all" ? tasks.length : name === "open" ? openCount : tasks.length - openCount}</b>
            </button>
          ))}
        </nav>
      )}
      {completionEnabled && (
        <div className="mobile-filters">
          {FILTER_OPTIONS.map((name) => (
            <button key={name} className={filter === name ? "selected" : ""} onClick={() => onFilterChange(name)}>
              {FILTER_LABELS[name]}
            </button>
          ))}
        </div>
      )}
      <div className={progressFading ? "task-list progress-fading" : "task-list"} aria-live="polite">
        {visible.map((task) => (
          <ConnectedTaskCard key={task.id} task={task} />
        ))}
        {visible.length === 0 && (
          <div className="empty ui-empty">
            <div className="empty-mark">
              <span className="dumbbell-icon" />
            </div>
            <h2>
              {tasks.length === 0
                ? "Your first exercise starts here"
                : filter === "done"
                  ? "No completed exercises yet"
                  : "All exercises are complete"}
            </h2>
            <p>
              {tasks.length === 0
                ? "Search the exercise library above to build this split."
                : filter === "done"
                  ? "Finish an exercise to see it appear in this view."
                  : "Switch to All exercises to review the full split."}
            </p>
            {tasks.length === 0 && (
              <ol className="workout-start-steps" aria-label="How to start this workout">
                <li className="is-complete">
                  <span className="workout-start-step-index" aria-hidden="true">
                    ✓
                  </span>
                  <span>
                    <strong>Create a split</strong>
                    <small>Done</small>
                  </span>
                </li>
                <li className="is-current">
                  <span className="workout-start-step-index" aria-hidden="true">
                    2
                  </span>
                  <span>
                    <strong>Add an exercise</strong>
                    <small>Search above or choose a quick pick.</small>
                  </span>
                </li>
                <li>
                  <span className="workout-start-step-index" aria-hidden="true">
                    3
                  </span>
                  <span>
                    <strong>Log your first set</strong>
                    <small>Enter weight, reps, and RIR.</small>
                  </span>
                </li>
              </ol>
            )}
            {tasks.length === 0 && quickPickExercises.length > 0 && (
              <div className="empty-quick-picks" aria-label="Quick add exercises">
                <span className="empty-quick-picks-label">Quick add</span>
                <div className="empty-quick-picks-list">
                  {quickPickExercises.map((name) => (
                    <button type="button" className="quick-pick-chip" key={name} onClick={() => onAddExercise(name)}>
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button
              type="button"
              className="empty-action ui-button ui-button-secondary"
              onClick={() => {
                if (tasks.length === 0) {
                  setMobileSearchOpen(true);
                  window.requestAnimationFrame(() => {
                    inputRef.current?.focus();
                    onShowSuggestionsChange(true);
                  });
                } else onFilterChange("all");
              }}
            >
              {tasks.length === 0 ? "Browse exercise library" : "Show all exercises"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
