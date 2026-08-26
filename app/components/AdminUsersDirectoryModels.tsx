export type WeightUnit = "kg" | "lb";
export type MemberSet = { weight: number; unit: WeightUnit; reps: number; rir: number };
export type MemberExercise = { name: string; completed: boolean; sets: MemberSet[] };
export type MemberSplit = { id: string; name: string; updatedAt?: string; exercises: MemberExercise[] };
export type AdminMemberResult = { username: string; createdAt?: string; splits: MemberSplit[]; sessions: number };
export type DirectoryUser = { id: string; username: string; lastSeenAt?: string; isAdmin?: boolean };
export type ContextMenu = { user: DirectoryUser; x: number; y: number };
export type AdminUsersPanelProps = { open: boolean; onClose: () => void; currentUserId?: string };

export function isMemberOnline(value?: string, now = Date.now(), isCurrentUser = false) {
  if (isCurrentUser) return true;
  const timestamp = value ? new Date(value).getTime() : Number.NaN;
  if (!Number.isFinite(timestamp)) return false;
  return Math.max(0, Math.floor((now - timestamp) / 1000)) < 60;
}

export function formatLastSeen(value?: string, now = Date.now(), isCurrentUser = false) {
  if (isMemberOnline(value, now, isCurrentUser)) return "Online now";
  const timestamp = value ? new Date(value).getTime() : Number.NaN;
  if (!Number.isFinite(timestamp)) return "Last seen unavailable";
  const elapsedMinutes = Math.floor(Math.max(0, now - timestamp) / 60_000);
  if (elapsedMinutes < 60) return `Last online ${elapsedMinutes} min${elapsedMinutes === 1 ? "" : "s"} ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `Last online ${elapsedHours} hour${elapsedHours === 1 ? "" : "s"} ago`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  return `Last online ${elapsedDays} day${elapsedDays === 1 ? "" : "s"} ago`;
}

function PeopleIcon() {
  return (
    <span className="admin-people-glyph" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

export function AdminUsersButton({
  onClick,
  label = "Open member directory",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button type="button" className="admin-users-button" onClick={onClick} aria-label={label} title="Member directory">
      <PeopleIcon />
    </button>
  );
}
