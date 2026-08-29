"use client";

import { useId, useState, type FormEvent, type KeyboardEvent, type RefObject } from "react";
import { WorkoutSetupSteps } from "./WorkoutSetupSteps";
import { PageHeader } from "./PageHeader";
import { VirtualizedTaskList } from "./VirtualizedTaskList";
import { FILTER_LABELS, FILTER_OPTIONS, POPULAR_QUICK_PICK_STARTERS, TRACK_INTERACTION } from "../trackConstants";
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
  draggingTaskId: string | null;
  searchQueryActive: boolean;
  showSuggestions: boolean;
  quickPickExercises: readonly string[];
  tasks: Task[];
  value: string;
  visible: Task[];
  onAddExercise: (name: string) => void;
  onAddTask: (event: FormEvent<HTMLFormElement>) => void;
  onFilterChange: (filter: Filter) => void;
  onOpenAiImport: () => void;
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
  draggingTaskId,
  quickPickExercises,
  searchQueryActive,
  showSuggestions,
  tasks,
  value,
  visible,
  onAddExercise,
  onAddTask,
  onFilterChange,
  onOpenAiImport,
  onSearchValueChange,
  onShowSuggestionsChange,
}: WorkoutPageProps) {
  const suggestionListId = useId();
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const suggestionsVisible = showSuggestions && searchQueryActive && exerciseSuggestions.length > 0;
  const starterCards = POPULAR_QUICK_PICK_STARTERS.filter(({ name }) => quickPickExercises.includes(name));
  const hasLoggedFirstSet = tasks.some((task) => {
    if (task.done || task.lastWeight !== undefined || task.lastReps !== undefined) return true;
    if (task.weight !== undefined && task.weight.trim() !== "0") return true;
    return (task.sets ?? []).some(
      (set) =>
        set.lastWeight !== undefined ||
        set.lastReps !== undefined ||
        set.lastRir !== undefined ||
        set.weight.trim() !== "0" ||
        set.reps.trim() !== "1" ||
        set.rir.trim() !== "0",
    );
  });
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
      <PageHeader
        className="workout-page-header"
        eyebrow="WORKOUT SPLIT"
        title={active.title}
        description={
          tasks.length === 0
            ? "Add an exercise to start."
            : `${tasks.length} ${tasks.length === 1 ? "exercise" : "exercises"}`
        }
        actions={
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
        }
      />
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
      {tasks.length > 0 && !hasLoggedFirstSet && <WorkoutSetupSteps className="workout-start-steps" stage={3} />}
      <div className="task-list-shell" aria-live="polite">
        <VirtualizedTaskList tasks={visible} progressFading={progressFading} draggingTaskId={draggingTaskId} />
        {visible.length === 0 && (
          <div className={`empty ui-empty${tasks.length === 0 ? " empty-split" : " empty-filter"}`}>
            <div className="empty-mark">
              <span className="dumbbell-icon" />
            </div>
            <h2>
              {tasks.length === 0
                ? "Your split is currently empty"
                : filter === "done"
                  ? "No completed exercises yet"
                  : "All exercises are complete"}
            </h2>
            <p>
              {tasks.length === 0
                ? "Add a popular starter, browse the library, or import a split."
                : filter === "done"
                  ? "Finish an exercise to see it appear in this view."
                  : "Switch to All exercises to review the full split."}
            </p>
            {tasks.length === 0 && <WorkoutSetupSteps className="workout-start-steps" stage={2} />}
            {tasks.length === 0 && starterCards.length > 0 && (
              <section className="empty-starters" aria-labelledby="empty-starters-title">
                <div className="empty-starters-heading">
                  <span id="empty-starters-title">Popular starters</span>
                  <small>Tap to add</small>
                </div>
                <div className="empty-starter-grid">
                  {starterCards.map((starter) => (
                    <button
                      type="button"
                      className="empty-starter-card"
                      key={starter.name}
                      onClick={() => onAddExercise(starter.name)}
                      aria-label={`Add ${starter.name}`}
                    >
                      <span className="empty-starter-name">
                        <i aria-hidden="true">+</i>
                        {starter.name}
                      </span>
                      <small>{starter.detail}</small>
                    </button>
                  ))}
                </div>
              </section>
            )}
            <div className={`empty-actions${tasks.length === 0 ? "" : " is-single"}`}>
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
              {tasks.length === 0 && (
                <button
                  type="button"
                  className="empty-action empty-action-ai ui-button ui-button-secondary"
                  onClick={onOpenAiImport}
                >
                  <span aria-hidden="true">✦</span> Import split with AI
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
