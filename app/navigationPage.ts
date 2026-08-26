export type ActivePage = "dashboard" | "rank" | "calendar" | "timer" | "workout" | "welcome";

export function activePageFromNavigation({
  active,
  showDashboard,
  showRank,
  showCalendar,
  showTimer,
}: {
  active: boolean;
  showDashboard: boolean;
  showRank: boolean;
  showCalendar: boolean;
  showTimer: boolean;
}): ActivePage {
  if (showDashboard) return "dashboard";
  if (showRank) return "rank";
  if (showCalendar) return "calendar";
  if (showTimer) return "timer";
  return active ? "workout" : "welcome";
}
