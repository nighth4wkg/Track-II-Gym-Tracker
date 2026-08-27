"use client";

import { createPortal } from "react-dom";
import { useMemo, useRef, useState } from "react";
import { fetchExerciseHistory } from "../data/exerciseHistoryApi";
import {
  buildHistoryTrendPoints,
  collapseHistoryEntries,
  groupHistoryEntries,
  summarizeHistory,
  valueInUnit,
  volumeLoadInKg,
} from "../exerciseHistoryMetrics.ts";
import type { ExerciseHistoryEntry } from "../trackTypes";
import { ExerciseHistoryTrend } from "./ExerciseHistoryTrend";

function formatNumber(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);
}

export function ExerciseHistoryButton({ exerciseId, exerciseName }: { exerciseId: string; exerciseName: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [entries, setEntries] = useState<ExerciseHistoryEntry[]>([]);
  const requestRef = useRef(0);

  const openHistory = () => {
    const requestId = ++requestRef.current;
    setOpen(true);
    setBusy(true);
    setMessage("");
    void fetchExerciseHistory(exerciseId, exerciseName)
      .then((next) => {
        if (requestRef.current !== requestId) return;
        setEntries(next);
        if (!next.length) setMessage("No history yet. Finish a set to start this timeline.");
      })
      .catch(() => {
        if (requestRef.current === requestId)
          setMessage("Exercise history is temporarily unavailable. Try again shortly.");
      })
      .finally(() => {
        if (requestRef.current === requestId) setBusy(false);
      });
  };

  const logicalEntries = useMemo(() => collapseHistoryEntries(entries), [entries]);
  const summary = useMemo(() => summarizeHistory(logicalEntries), [logicalEntries]);
  const groupedEntries = useMemo(() => groupHistoryEntries(logicalEntries.slice(0, 60)), [logicalEntries]);
  const trendPoints = useMemo(() => buildHistoryTrendPoints(groupedEntries), [groupedEntries]);
  const close = () => {
    requestRef.current += 1;
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className="exercise-history-trigger"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          openHistory();
        }}
        aria-label={`View ${exerciseName} history`}
      >
        History
      </button>
      {open &&
        globalThis.document &&
        createPortal(
          <div className="exercise-history-backdrop" onMouseDown={close}>
            <section
              className="exercise-history-modal ui-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="exercise-history-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="exercise-history-heading">
                <div>
                  <span className="settings-kicker">EXERCISE HISTORY</span>
                  <h2 id="exercise-history-title">{exerciseName}</h2>
                </div>
                <button type="button" className="exercise-history-close" onClick={close} aria-label="Close history">
                  ×
                </button>
              </div>
              {busy ? (
                <p className="exercise-history-state">Loading your progression…</p>
              ) : message && !entries.length ? (
                <p className="exercise-history-state">{message}</p>
              ) : (
                <>
                  <div className="exercise-history-summary">
                    <div>
                      <span>Sessions</span>
                      <strong>{summary.sessionCount}</strong>
                    </div>
                    <div>
                      <span>Best weight</span>
                      <strong>
                        {formatNumber(valueInUnit(summary.bestWeightKg, summary.displayUnit))} {summary.displayUnit}
                      </strong>
                    </div>
                    <div>
                      <span>Best volume load</span>
                      <strong>
                        {formatNumber(valueInUnit(summary.bestVolumeKg, summary.displayUnit))} {summary.displayUnit}
                        ·reps
                      </strong>
                    </div>
                  </div>
                  <ExerciseHistoryTrend points={trendPoints} unit={summary.displayUnit} />
                  <div className="exercise-history-list">
                    {groupedEntries.map((group) => (
                      <section className="exercise-history-group" key={group.key}>
                        <div className="exercise-history-group-heading">
                          <time dateTime={group.dateTime}>{group.dateLabel}</time>
                          <span>
                            {group.entries.length} {group.entries.length === 1 ? "set" : "sets"}
                          </span>
                        </div>
                        {group.entries.map((entry) => (
                          <div className="exercise-history-row" key={entry.id}>
                            <strong>
                              {formatNumber(entry.weight)} {entry.unit} × {formatNumber(entry.reps)}
                            </strong>
                            <span>
                              {formatNumber(valueInUnit(volumeLoadInKg(entry), entry.unit))} {entry.unit} ·{" "}
                              {formatNumber(entry.rir)} RIR
                            </span>
                          </div>
                        ))}
                      </section>
                    ))}
                  </div>
                </>
              )}
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
