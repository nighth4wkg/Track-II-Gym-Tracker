"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { supabase } from "../supabase";
import { applyAnimatedStyles } from "../domMotion";
import { AdminDirectorySkeleton } from "./LoadingSkeletons";
import { useModalFocus } from "../hooks/useModalFocus";
import { TRACK_TIMING } from "../trackConstants";

type WeightUnit = "kg" | "lb";
type MemberSet = { weight: number; unit: WeightUnit; reps: number; rir: number };
type MemberExercise = { name: string; completed: boolean; sets: MemberSet[] };
type MemberSplit = { id: string; name: string; updatedAt?: string; exercises: MemberExercise[] };
type AdminMemberResult = { username: string; createdAt?: string; splits: MemberSplit[]; sessions: number };
type DirectoryUser = { id: string; username: string; lastSeenAt?: string; isAdmin?: boolean };
type ContextMenu = { user: DirectoryUser; x: number; y: number };

type AdminUsersPanelProps = {
  open: boolean;
  onClose: () => void;
  currentUserId?: string;
};

export function formatLastSeen(value?: string, now = Date.now(), isCurrentUser = false) {
  if (isMemberOnline(value, now, isCurrentUser)) return "Online now";
  const timestamp = value ? new Date(value).getTime() : Number.NaN;
  if (!Number.isFinite(timestamp)) return "Last seen unavailable";
  const elapsedSeconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) return `Last online ${elapsedMinutes} min${elapsedMinutes === 1 ? "" : "s"} ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `Last online ${elapsedHours} hour${elapsedHours === 1 ? "" : "s"} ago`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  return `Last online ${elapsedDays} day${elapsedDays === 1 ? "" : "s"} ago`;
}

export function isMemberOnline(value?: string, now = Date.now(), isCurrentUser = false) {
  if (isCurrentUser) return true;
  const timestamp = value ? new Date(value).getTime() : Number.NaN;
  if (!Number.isFinite(timestamp)) return false;
  return Math.max(0, Math.floor((now - timestamp) / 1000)) < 60;
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

export function AdminUsersPanel({ open, onClose, currentUserId }: AdminUsersPanelProps) {
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [member, setMember] = useState<AdminMemberResult | null>(null);
  const [selectedSplitId, setSelectedSplitId] = useState("");
  const [view, setView] = useState<"directory" | "preview">("directory");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [directoryNow, setDirectoryNow] = useState(() => Date.now());
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLElement>(null);
  const holdTimer = useRef<number | null>(null);
  const holdStart = useRef<{ x: number; y: number } | null>(null);

  useModalFocus({ open, containerRef: modalRef });

  const selectedSplit = member?.splits.find((split) => split.id === selectedSplitId) ?? member?.splits[0] ?? null;

  async function loadDirectory() {
    setDirectoryNow(Date.now());
    try {
      // Refresh the signed-in administrator's heartbeat before reading the
      // directory so the current account is not shown as recently offline.
      await supabase.functions.invoke("admin-member-data", { body: { action: "heartbeat" } });
      const { data, error: invokeError } = await supabase.functions.invoke("admin-member-data", {
        body: { action: "list-users" },
      });
      setBusy(false);
      if (invokeError || data?.error) {
        setError(data?.error || "Could not load the member directory.");
        return;
      }
      setUsers(Array.isArray(data?.users) ? data.users : []);
    } catch {
      setBusy(false);
      setError("Could not load the member directory.");
    }
  }

  async function loadMember(user: DirectoryUser) {
    setBusy(true);
    setError("");
    setContextMenu(null);
    const { data, error: invokeError } = await supabase.functions.invoke("admin-member-data", {
      body: { action: "member", username: user.username },
    });
    setBusy(false);
    if (invokeError || data?.error || !data?.member) {
      setError(data?.error || "Could not load this member's workout data.");
      return;
    }
    // SAFETY: admin-member-data returns the AdminMemberResult contract after
    // validating the requested member and its nested split data server-side.
    const nextMember = data.member as AdminMemberResult;
    setMember(nextMember);
    setSelectedSplitId(nextMember.splits[0]?.id ?? "");
    setView("preview");
  }

  async function setAdminRole(user: DirectoryUser, shouldBeAdmin: boolean) {
    if (!shouldBeAdmin && user.isAdmin && users.filter((directoryUser) => directoryUser.isAdmin).length <= 1) {
      setContextMenu(null);
      setError("At least one administrator must remain.");
      return;
    }
    setBusy(true);
    setError("");
    setContextMenu(null);
    const { data, error: invokeError } = await supabase.functions.invoke("admin-member-data", {
      body: { action: "set-admin", username: user.username, isAdmin: shouldBeAdmin },
    });
    setBusy(false);
    if (invokeError || data?.error) {
      setError(data?.error || `Could not ${shouldBeAdmin ? "promote" : "demote"} this member.`);
      return;
    }
    setUsers((current) =>
      current.map((directoryUser) =>
        directoryUser.id === user.id ? { ...directoryUser, isAdmin: data?.isAdmin === true } : directoryUser,
      ),
    );
  }

  useEffect(() => {
    if (!open) return;
    const clock = window.setInterval(() => setDirectoryNow(Date.now()), TRACK_TIMING.adminDirectoryClockMs);
    const request = window.setTimeout(() => {
      void loadDirectory();
    }, 0);
    return () => {
      window.clearInterval(clock);
      window.clearTimeout(request);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (contextMenu) setContextMenu(null);
        else if (view !== "directory") setView("directory");
        else onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [contextMenu, onClose, open, view]);

  useEffect(() => {
    if (!contextMenu) return;
    const dismiss = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (contextMenuRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest(".admin-user-more")) return;
      setContextMenu(null);
    };
    document.addEventListener("pointerdown", dismiss, true);
    return () => document.removeEventListener("pointerdown", dismiss, true);
  }, [contextMenu]);

  useLayoutEffect(() => {
    if (!contextMenu) return;
    applyAnimatedStyles(contextMenuRef.current, {
      "--menu-left": `${contextMenu.x}px`,
      "--menu-top": `${contextMenu.y}px`,
    });
  }, [contextMenu]);

  function showMenu(user: DirectoryUser, x: number, y: number) {
    const width = 214;
    const height = 142;
    setContextMenu({
      user,
      x: Math.max(12, Math.min(x, window.innerWidth - width - 12)),
      y: Math.max(12, Math.min(y, window.innerHeight - height - 12)),
    });
  }

  function beginHold(event: ReactPointerEvent<HTMLElement>, user: DirectoryUser) {
    if (event.pointerType === "mouse") return;
    holdStart.current = { x: event.clientX, y: event.clientY };
    holdTimer.current = window.setTimeout(
      () => showMenu(user, event.clientX, event.clientY),
      TRACK_TIMING.adminMemberMenuHoldMs,
    );
  }

  function moveHold(event: ReactPointerEvent<HTMLElement>) {
    const start = holdStart.current;
    if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) < 10) return;
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
  }

  function endHold() {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
    holdStart.current = null;
  }

  function openMenuFromKeyboard(event: ReactKeyboardEvent<HTMLElement>, user: DirectoryUser) {
    if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    showMenu(user, rect.right - 190, rect.bottom + 8);
  }

  if (!open || !globalThis.document) return null;

  return createPortal(
    <div
      className="admin-users-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={modalRef}
        className={view === "preview" ? "admin-users-modal admin-users-preview" : "admin-users-modal"}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-users-title"
        tabIndex={-1}
      >
        <header className="admin-users-header">
          <div>
            <span className="settings-kicker">ADMIN ONLY</span>
            <h2 id="admin-users-title">
              {view === "directory" ? "Track members" : member ? `@${member.username}` : "Member splits"}
            </h2>
            <p>
              {view === "directory"
                ? "Recent activity and member access."
                : "Read-only split preview. Nothing here can be changed."}
            </p>
          </div>
          <div className="admin-users-header-actions">
            {view !== "directory" && (
              <button type="button" className="admin-users-back" onClick={() => setView("directory")}>
                Back
              </button>
            )}
            <button type="button" className="admin-users-close" onClick={onClose} aria-label="Close member directory">
              {"\u00d7"}
            </button>
          </div>
        </header>

        {error && (
          <div className="admin-users-error" role="alert">
            {error}
          </div>
        )}
        {busy && <AdminDirectorySkeleton />}

        {!busy && view === "directory" && (
          <div className="admin-user-directory">
            {users.length === 0 && !error ? (
              <p className="admin-users-empty">No Track members were found.</p>
            ) : (
              users.map((directoryUser) => {
                const online = isMemberOnline(
                  directoryUser.lastSeenAt,
                  directoryNow,
                  directoryUser.id === currentUserId,
                );
                const initial = directoryUser.username.trim().charAt(0).toUpperCase() || "?";
                return (
                  <div
                    key={directoryUser.id}
                    className="admin-user-row"
                    role="button"
                    tabIndex={0}
                    aria-label={`Actions for @${directoryUser.username}`}
                    onClick={(event) =>
                      showMenu(directoryUser, event.clientX || window.innerWidth / 2, event.clientY || 120)
                    }
                    onKeyDown={(event) => openMenuFromKeyboard(event, directoryUser)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      showMenu(directoryUser, event.clientX, event.clientY);
                    }}
                    onPointerDown={(event) => beginHold(event, directoryUser)}
                    onPointerMove={moveHold}
                    onPointerUp={endHold}
                    onPointerCancel={endHold}
                  >
                    <span className="admin-user-avatar" aria-hidden="true">
                      {initial}
                      <i className={online ? "online" : ""} />
                    </span>
                    <span className="admin-user-copy">
                      <span className="admin-user-primary">
                        <strong>@{directoryUser.username}</strong>
                        {directoryUser.isAdmin && <em className="admin-user-role-badge">Admin</em>}
                      </span>
                      <small>
                        {formatLastSeen(directoryUser.lastSeenAt, directoryNow, directoryUser.id === currentUserId)}
                      </small>
                    </span>
                    <button
                      type="button"
                      className="admin-user-more"
                      aria-label={`Actions for @${directoryUser.username}`}
                      aria-haspopup="menu"
                      aria-expanded={contextMenu?.user.id === directoryUser.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        const rect = event.currentTarget.getBoundingClientRect();
                        showMenu(directoryUser, rect.right - 190, rect.bottom + 8);
                      }}
                      onPointerDown={(event) => event.stopPropagation()}
                      onPointerUp={(event) => event.stopPropagation()}
                    >
                      <span aria-hidden="true">•••</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}

        {!busy && view === "preview" && member && !selectedSplit && (
          <p className="admin-users-empty">This member has no splits to preview.</p>
        )}

        {!busy && view === "preview" && member && selectedSplit && (
          <div className="admin-account-preview">
            <aside>
              <span className="admin-preview-label">SPLITS</span>
              {member.splits.map((split) => (
                <button
                  type="button"
                  key={split.id}
                  className={split.id === selectedSplit.id ? "active" : ""}
                  onClick={() => setSelectedSplitId(split.id)}
                >
                  <span>{split.name}</span>
                  <b>{split.exercises.length}</b>
                </button>
              ))}
            </aside>
            <div className="admin-preview-workout">
              <div className="admin-preview-title">
                <span>READ-ONLY SPLIT</span>
                <h3>{selectedSplit.name}</h3>
                <p>
                  {selectedSplit.exercises.length} {selectedSplit.exercises.length === 1 ? "exercise" : "exercises"}
                </p>
              </div>
              <div className="admin-preview-exercises">
                {selectedSplit.exercises.length === 0 ? (
                  <p className="admin-users-empty">No exercises in this split.</p>
                ) : (
                  selectedSplit.exercises.map((exercise, exerciseIndex) => (
                    <article key={`${exercise.name}-${exerciseIndex}`}>
                      <strong>{exercise.name}</strong>
                      <div className="admin-preview-sets">
                        <span>SET</span>
                        <span>WEIGHT</span>
                        <span>REPS</span>
                        <span>RIR</span>
                        {exercise.sets.map((set, setIndex) => (
                          <div className="admin-preview-set" key={`${exercise.name}-${setIndex}`}>
                            <b>{setIndex + 1}</b>
                            <b>
                              {set.weight} {set.unit.toUpperCase()}
                            </b>
                            <b>{set.reps}</b>
                            <b>{set.rir}</b>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </section>
      {contextMenu &&
        createPortal(
          <div
            ref={contextMenuRef}
            className="admin-user-context"
            role="menu"
            aria-label={`Actions for @${contextMenu.user.username}`}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button type="button" role="menuitem" onClick={() => void loadMember(contextMenu.user)}>
              View split
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={Boolean(contextMenu.user.isAdmin) && users.filter((user) => user.isAdmin).length <= 1}
              title={
                contextMenu.user.isAdmin && users.filter((user) => user.isAdmin).length <= 1
                  ? "At least one administrator must remain"
                  : undefined
              }
              onClick={() => void setAdminRole(contextMenu.user, !contextMenu.user.isAdmin)}
            >
              {contextMenu.user.isAdmin ? "Demote from admin" : "Promote to admin"}
            </button>
          </div>,
          document.body,
        )}
    </div>,
    document.body,
  );
}
