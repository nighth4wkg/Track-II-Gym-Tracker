export function TimerScreenSkeleton() {
  return (
    <section className="timer-screen timer-screen-skeleton" role="status" aria-label="Loading timer" aria-busy="true">
      <div className="timer-skeleton-block timer-skeleton-kicker" aria-hidden="true" />
      <div className="timer-skeleton-block timer-skeleton-title" aria-hidden="true" />
      <div className="timer-skeleton-block timer-skeleton-copy" aria-hidden="true" />
      <div className="timer-skeleton-block timer-skeleton-mode" aria-hidden="true" />
      <div className="timer-skeleton-block timer-skeleton-display" aria-hidden="true" />
      <div className="timer-skeleton-controls" aria-hidden="true">
        <span className="timer-skeleton-block" />
        <span className="timer-skeleton-block" />
      </div>
      <div className="timer-skeleton-laps" aria-hidden="true">
        <span className="timer-skeleton-block" />
        <span className="timer-skeleton-block" />
      </div>
    </section>
  );
}
