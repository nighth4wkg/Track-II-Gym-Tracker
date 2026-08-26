function SkeletonBlock({ className = "" }: { className?: string }) {
  return <span className={`loading-skeleton-block ${className}`.trim()} aria-hidden="true" />;
}

function SkeletonPage({ className, label, children }: { className: string; label: string; children: React.ReactNode }) {
  return (
    <section className={className} role="status" aria-label={label} aria-busy="true">
      {children}
    </section>
  );
}

export function AppLoadingSkeleton() {
  return (
    <SkeletonPage className="app-loading-skeleton" label="Loading Track II">
      <div className="app-loading-skeleton-card">
        <div className="app-loading-skeleton-brand">
          <SkeletonBlock className="app-loading-skeleton-mark" />
          <SkeletonBlock className="app-loading-skeleton-brand-name" />
        </div>
        <SkeletonBlock className="app-loading-skeleton-title" />
        <SkeletonBlock className="app-loading-skeleton-copy" />
        <SkeletonBlock className="app-loading-skeleton-field" />
        <SkeletonBlock className="app-loading-skeleton-button" />
      </div>
    </SkeletonPage>
  );
}

export function SettingsScreenSkeleton() {
  return (
    <SkeletonPage className="settings-screen-skeleton" label="Loading settings">
      <SkeletonBlock className="settings-skeleton-heading" />
      <SkeletonBlock className="settings-skeleton-copy" />
      <div className="settings-skeleton-card">
        <SkeletonBlock className="settings-skeleton-card-title" />
        <SkeletonBlock className="settings-skeleton-card-copy" />
        <SkeletonBlock className="settings-skeleton-row" />
        <SkeletonBlock className="settings-skeleton-row" />
      </div>
    </SkeletonPage>
  );
}

export function WorkoutScreenSkeleton() {
  return (
    <SkeletonPage className="workout-screen-skeleton" label="Loading workout">
      <SkeletonBlock className="skeleton-page-eyebrow" />
      <SkeletonBlock className="workout-skeleton-title" />
      <SkeletonBlock className="workout-skeleton-copy" />
      <SkeletonBlock className="workout-skeleton-search" />
      <div className="workout-skeleton-list">
        {[0, 1, 2].map((index) => (
          <div className="workout-skeleton-card" key={index}>
            <div className="workout-skeleton-card-heading">
              <SkeletonBlock className="workout-skeleton-card-title" />
              <SkeletonBlock className="workout-skeleton-menu" />
            </div>
            <SkeletonBlock className="workout-skeleton-divider" />
            <div className="workout-skeleton-sets">
              <SkeletonBlock />
              <SkeletonBlock />
              <SkeletonBlock />
            </div>
            <SkeletonBlock className="workout-skeleton-add" />
          </div>
        ))}
      </div>
    </SkeletonPage>
  );
}

export function CalendarScreenSkeleton() {
  return (
    <SkeletonPage className="calendar-screen-skeleton" label="Loading calendar">
      <SkeletonBlock className="skeleton-page-eyebrow" />
      <SkeletonBlock className="calendar-skeleton-title" />
      <div className="calendar-skeleton-card">
        <div className="calendar-skeleton-heading">
          <SkeletonBlock />
          <SkeletonBlock />
          <SkeletonBlock />
        </div>
        <SkeletonBlock className="calendar-skeleton-weekdays" />
        <div className="calendar-skeleton-grid">
          {Array.from({ length: 35 }, (_, index) => (
            <SkeletonBlock key={index} />
          ))}
        </div>
        <SkeletonBlock className="calendar-skeleton-legend" />
      </div>
    </SkeletonPage>
  );
}

export function RankScreenSkeleton() {
  return (
    <SkeletonPage className="rank-screen-skeleton" label="Loading rank">
      <SkeletonBlock className="skeleton-page-eyebrow" />
      <SkeletonBlock className="rank-skeleton-title" />
      <SkeletonBlock className="rank-skeleton-copy" />
      <SkeletonBlock className="rank-skeleton-body-map" />
      <SkeletonBlock className="skeleton-page-eyebrow rank-skeleton-groups" />
      <SkeletonBlock className="rank-skeleton-subtitle" />
      <div className="rank-skeleton-cards">
        {[0, 1, 2, 3].map((index) => (
          <div className="rank-skeleton-card" key={index}>
            <SkeletonBlock />
            <SkeletonBlock />
            <SkeletonBlock />
          </div>
        ))}
      </div>
    </SkeletonPage>
  );
}

export function DashboardScreenSkeleton() {
  return (
    <SkeletonPage className="dashboard-screen-skeleton" label="Loading dashboard">
      <SkeletonBlock className="skeleton-page-eyebrow" />
      <SkeletonBlock className="dashboard-skeleton-title" />
      <SkeletonBlock className="dashboard-skeleton-copy" />
      <div className="dashboard-skeleton-stats">
        {[0, 1, 2, 3].map((index) => (
          <SkeletonBlock key={index} />
        ))}
      </div>
      <div className="dashboard-skeleton-cards">
        <SkeletonBlock />
        <SkeletonBlock />
      </div>
    </SkeletonPage>
  );
}

export function CalendarDetailSkeleton() {
  return (
    <div className="calendar-detail-skeleton" role="status" aria-label="Loading workout details" aria-busy="true">
      <SkeletonBlock className="calendar-detail-skeleton-stats" />
      <SkeletonBlock className="calendar-detail-skeleton-label" />
      <div className="calendar-detail-skeleton-list">
        {[0, 1, 2, 3].map((index) => (
          <div key={index}>
            <SkeletonBlock />
            <SkeletonBlock />
          </div>
        ))}
      </div>
      <SkeletonBlock className="calendar-detail-skeleton-section" />
      <SkeletonBlock className="calendar-detail-skeleton-note" />
    </div>
  );
}

export function AdminToolsSkeleton() {
  return (
    <div className="admin-tools-skeleton" role="status" aria-label="Loading admin tools" aria-busy="true">
      <SkeletonBlock className="admin-skeleton-heading" />
      <SkeletonBlock className="admin-skeleton-copy" />
      {[0, 1].map((index) => (
        <div className="admin-skeleton-card" key={index}>
          <div>
            <SkeletonBlock />
            <SkeletonBlock />
          </div>
          <SkeletonBlock className="admin-skeleton-button" />
        </div>
      ))}
    </div>
  );
}

export function AdminDirectorySkeleton() {
  return (
    <div className="admin-directory-skeleton" role="status" aria-label="Loading member directory" aria-busy="true">
      {Array.from({ length: 6 }, (_, index) => (
        <div className="admin-directory-skeleton-row" key={index}>
          <SkeletonBlock className="admin-directory-skeleton-dot" />
          <div>
            <SkeletonBlock />
            <SkeletonBlock />
          </div>
          <SkeletonBlock className="admin-directory-skeleton-menu" />
        </div>
      ))}
    </div>
  );
}

export function InlineLoadingSkeleton({ label = "Loading" }: { label?: string }) {
  return <span className="inline-loading-skeleton" role="status" aria-label={label} />;
}
