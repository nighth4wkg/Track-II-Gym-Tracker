import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.111.0";

export type AdminIdentity = {
  id: string;
  user_metadata?: { username?: string } | null;
};

type AdminAccess = {
  ready: boolean;
  isAdmin: boolean;
};

const BOOTSTRAP_USERNAME = String(Deno.env.get("TRACK_ADMIN_USERNAME") ?? "").trim();
const BOOTSTRAP_USER_ID = String(Deno.env.get("TRACK_ADMIN_USER_ID") ?? "").trim();

export function normalizeUsername(value: string | null | undefined) {
  return (value ?? "").trim().replace(/^@+/, "").replace(/\s+/g, "").toLowerCase();
}

function isBootstrapAdmin(user: AdminIdentity) {
  return Boolean(BOOTSTRAP_USERNAME && BOOTSTRAP_USER_ID)
    && user.id === BOOTSTRAP_USER_ID
    && normalizeUsername(user.user_metadata?.username) === normalizeUsername(BOOTSTRAP_USERNAME);
}

/**
 * Authorize one admin without downloading the complete roster. The count is
 * only used to preserve the first-deployment bootstrap behavior; the normal
 * path uses the indexed primary key lookup on admin_users.user_id.
 */
export async function checkAdminAccess(adminClient: SupabaseClient, user: AdminIdentity): Promise<AdminAccess> {
  const { count, error: countError } = await adminClient
    .from("admin_users")
    .select("user_id", { count: "exact", head: true });
  if (countError) return { ready: false, isAdmin: false };
  if ((count ?? 0) === 0) return { ready: true, isAdmin: isBootstrapAdmin(user) };

  const { data, error } = await adminClient
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  return { ready: !error, isAdmin: !error && Boolean(data?.user_id) };
}

export async function loadAdminIds(adminClient: SupabaseClient) {
  const { data, error } = await adminClient.from("admin_users").select("user_id");
  return {
    ready: !error,
    ids: new Set((data ?? []).map((row) => String(row.user_id)).filter(Boolean)),
  };
}
