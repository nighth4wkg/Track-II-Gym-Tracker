import type { TouchEvent } from "react";
import { calendarDateKey } from "../calendarTypes";
import { haptic } from "../haptics";
import { PageHeader } from "./PageHeader";

type CalendarMonthOverviewProps = {
  month: Date;
  monthDirection: "idle" | "next" | "previous";
  workoutDates: Set<string>;
  onMonthDelta: (delta: number) => void;
  onToday: () => void;
  onSelectDate: (dateKey: string) => void;
  onTouchStart: (event: TouchEvent<HTMLDivElement>) => void;
  onTouchEnd: (event: TouchEvent<HTMLDivElement>) => void;
};

function formatSummaryDate(dateKey: string | null) {
  if (!dateKey) return "—";
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function CalendarMonthOverview({
  month,
  monthDirection,
  workoutDates,
  onMonthDelta,
  onToday,
  onSelectDate,
  onTouchStart,
  onTouchEnd,
}: CalendarMonthOverviewProps) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDayOffset = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = Array.from({ length: firstDayOffset + daysInMonth }, (_, index) =>
    index < firstDayOffset ? null : index - firstDayOffset + 1,
  );
  const monthPrefix = `${year}-${String(monthIndex + 1).padStart(2, "0")}-`;
  const monthWorkoutCount = [...workoutDates].filter((dateKey) => dateKey.startsWith(monthPrefix)).length;
  const latestWorkoutDate = [...workoutDates].sort().at(-1) ?? null;
  const today = calendarDateKey(new Date());

  return (
    <>
      <PageHeader
        className="calendar-page-header"
        eyebrow="WORKOUT HISTORY"
        title="Calendar"
        description="Review your completed training sessions."
        actions={
          <button className="calendar-today ui-button ui-button-secondary" onClick={onToday}>
            Today
          </button>
        }
      />
      <section className="calendar-insight-strip" aria-label="Workout history summary">
        <div className="calendar-insight-card">
          <span>This month</span>
          <strong>{monthWorkoutCount}</strong>
          <small>{monthWorkoutCount === 1 ? "workout" : "workouts"}</small>
        </div>
        <div className="calendar-insight-card">
          <span>Total logged</span>
          <strong>{workoutDates.size}</strong>
          <small>{workoutDates.size === 1 ? "session" : "sessions"}</small>
        </div>
        <div className="calendar-insight-card">
          <span>Latest session</span>
          <strong>{formatSummaryDate(latestWorkoutDate)}</strong>
          <small>{latestWorkoutDate ? "completed" : "No sessions yet"}</small>
        </div>
      </section>
      <div className="calendar-card ui-panel" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div key={`${year}-${monthIndex}`} className={`calendar-month-stage ${monthDirection}`}>
          <div className="calendar-heading">
            <button className="calendar-nav" onClick={() => onMonthDelta(-1)} aria-label="Previous month">
              ‹
            </button>
            <strong>{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</strong>
            <button className="calendar-nav" onClick={() => onMonthDelta(1)} aria-label="Next month">
              ›
            </button>
          </div>
          <div className="calendar-weekdays">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {cells.map((day, index) => {
              if (!day) return <span className="calendar-cell empty" key={`empty-${index}`} />;
              const key = calendarDateKey(new Date(year, monthIndex, day));
              const workedOut = workoutDates.has(key);
              return (
                <button
                  className={`${workedOut ? "calendar-cell workout-day" : "calendar-cell"}${key === today ? " today" : ""}`}
                  key={key}
                  title={workedOut ? "View workout details" : undefined}
                  disabled={!workedOut}
                  onClick={() => {
                    if (!workedOut) return;
                    haptic(8);
                    onSelectDate(key);
                  }}
                >
                  <b>{day}</b>
                  {workedOut && <i aria-label="Workout completed" />}
                </button>
              );
            })}
          </div>
          <div className="calendar-legend">
            <span>
              <i /> Completed
            </span>
            <span>
              {workoutDates.size} {workoutDates.size === 1 ? "workout" : "workouts"}
            </span>
          </div>
        </div>
      </div>
      {workoutDates.size === 0 && (
        <div className="calendar-empty-note ui-empty" role="status">
          <strong>Your workout history will appear here.</strong>
          <span>Finish a session to start building your calendar.</span>
        </div>
      )}
    </>
  );
}
