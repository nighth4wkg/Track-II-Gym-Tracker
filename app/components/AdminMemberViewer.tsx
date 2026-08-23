"use client";

import { useState } from "react";
import { supabase } from "../supabase";
import { InlineLoadingSkeleton } from "./LoadingSkeletons";

type WeightUnit = "kg" | "lb";
type AdminMemberResult = {
  username: string;
  createdAt?: string;
  splits: {
    id: string;
    name: string;
    updatedAt?: string;
    exercises: {
      name: string;
      completed: boolean;
      sets: { weight: number; unit: WeightUnit; reps: number; rir: number }[];
    }[];
  }[];
  sessions: number;
};

export function AdminMemberViewer() {
  const [username, setUsername] = useState("");
  const [member, setMember] = useState<AdminMemberResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function lookup() {
    const target = username.trim().toLowerCase();
    if (!target) return;
    setBusy(true);
    setError("");
    setMember(null);
    const { data, error: invokeError } = await supabase.functions.invoke("admin-member-data", {
      body: { username: target },
    });
    setBusy(false);
    if (invokeError || data?.error) {
      setError(data?.error || "The member viewer is not available yet. Deploy the admin-member-data function first.");
      return;
    }
    setMember(data?.member ?? null);
    if (!data?.member) setError("No member was found for that username.");
  }

  return (
    <div className="admin-card admin-member-viewer">
      <div className="setting-row">
        <div>
          <strong>View member split data</strong>
          <p>Admin-only lookup by username for a member’s splits, exercises, sets, and completed workout count.</p>
        </div>
      </div>
      <div className="admin-member-search">
        <input
          type="text"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void lookup();
          }}
          placeholder="member username"
          aria-label="Member username"
        />
        <button className="admin-action-button" onClick={() => void lookup()} disabled={busy || !username.trim()}>
          {busy ? <InlineLoadingSkeleton label="Loading member" /> : "View member"}
        </button>
      </div>
      {error && (
        <div className="admin-member-error" role="alert">
          {error}
        </div>
      )}
      {member && (
        <div className="admin-member-result">
          <div className="admin-member-summary">
            <strong>@{member.username}</strong>
            <span>
              {member.sessions} completed {member.sessions === 1 ? "workout" : "workouts"}
            </span>
          </div>
          {member.splits.length === 0 ? (
            <p className="admin-member-empty">No splits found.</p>
          ) : (
            <div className="admin-member-splits">
              {member.splits.map((split) => (
                <article key={split.id}>
                  <div>
                    <strong>{split.name}</strong>
                    <span>
                      {split.exercises.length} {split.exercises.length === 1 ? "exercise" : "exercises"}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
