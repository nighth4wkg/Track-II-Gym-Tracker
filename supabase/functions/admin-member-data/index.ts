import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { checkAdminAccess, loadAdminIds, normalizeUsername } from "../_shared/admin.ts";
import { isAllowedOrigin, responseHeaders } from "../_shared/cors.ts";
import { json } from "../_shared/http.ts";
import { consumeRateLimit } from "../_shared/rateLimit.ts";

// Keep the identity configurable in Supabase instead of exposing an admin
// identifier in the public client bundle. The function fails closed until the
// TRACK_ADMIN_USERNAME and TRACK_ADMIN_USER_ID secrets are configured in the
// Supabase project.
const ADMIN_USER_ID = String(Deno.env.get("TRACK_ADMIN_USER_ID") ?? "").trim();

type DirectoryUser = {
  user_id: string;
  username: string;
  normalized_username: string;
  created_at: string;
  updated_at: string;
  last_seen_at: string | null;
};
type AdminRoster = { ids: Set<string>; ready: boolean; bootstrapFallback: boolean };
const MEMBER_DATA_PAGE_SIZE = 1000;
const MAX_MEMBER_DATA_PAGES = 50;
const MAX_BODY_BYTES = 8 * 1024;
type QueryPageError = { message?: string } | null;
type AdminRequestBody = { action?: unknown; username?: unknown; isAdmin?: unknown };

async function loadAdminRoster(adminClient: SupabaseClient): Promise<AdminRoster> {
  const { ids, ready } = await loadAdminIds(adminClient);
  if (!ready) return { ids: new Set(), ready: false, bootstrapFallback: false };
  const bootstrapFallback = ids.size === 0 && Boolean(ADMIN_USER_ID);
  if (bootstrapFallback) ids.add(ADMIN_USER_ID);
  return { ids, ready: true, bootstrapFallback };
}

function isRosterAdmin(userId: string | undefined, roster: AdminRoster) {
  if (!userId) return false;
  return roster.ids.has(userId);
}

async function listAllRows<T>(loadPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: QueryPageError }>) {
  const rows: T[] = [];
  for (let page = 0; page < MAX_MEMBER_DATA_PAGES; page += 1) {
    const result = await loadPage(page * MEMBER_DATA_PAGE_SIZE, (page + 1) * MEMBER_DATA_PAGE_SIZE - 1);
    if (result.error) return { rows: [], error: result.error };
    const pageRows = result.data ?? [];
    rows.push(...pageRows);
    if (pageRows.length < MEMBER_DATA_PAGE_SIZE) return { rows, error: null };
  }
  return { rows: [], error: { message: "The member workout data exceeded the safe pagination limit." } };
}

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin") ?? "";
  if (!isAllowedOrigin(origin)) return new Response("Forbidden", { status: 403 });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: responseHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "POST is required." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = request.headers.get("Authorization");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) return json(request, { error: "Member service is not configured." }, 500);
    if (!authorization) return json(request, { error: "Authentication required." }, 401);

    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: callerData, error: callerError } = await callerClient.auth.getUser();
    const contentLength = Number(request.headers.get("Content-Length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) return json(request, { error: "Request is too large." }, 413);
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) return json(request, { error: "Request is too large." }, 413);
    // SAFETY: only these three optional fields are read below, and each use
    // converts or compares the value before it reaches an admin operation.
    const body = JSON.parse(rawBody || "{}") as AdminRequestBody;
    const action = String(body?.action ?? "member");
    if (callerError || !callerData.user) return json(request, { error: "Authentication required." }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const adminAccess = await checkAdminAccess(adminClient, callerData.user);
    const limit = await consumeRateLimit(adminClient, "admin-member-data:user", callerData.user.id, 60, 30);
    if (!limit.available) return json(request, { error: "Member service is temporarily unavailable." }, 503);
    if (!limit.allowed) return json(request, { error: "Too many member requests. Try again shortly." }, 429);
    if (action === "heartbeat") {
      const lastSeenAt = new Date().toISOString();
      const { error: heartbeatError } = await adminClient
        .from("auth_username_directory")
        .update({ last_seen_at: lastSeenAt })
        .eq("user_id", callerData.user.id);
      return heartbeatError ? json(request, { error: "Could not update activity." }, 502) : json(request, { ok: true, isAdmin: adminAccess.ready && adminAccess.isAdmin, lastSeenAt });
    }

    if (!adminAccess.ready) return json(request, { error: "Administrator roster is not configured. Apply the admin_users migration first." }, 503);
    if (!adminAccess.isAdmin) return json(request, { error: "Administrator access required." }, 403);
    const adminRoster = await loadAdminRoster(adminClient);
    if (!adminRoster.ready) return json(request, { error: "Could not read the administrator roster." }, 503);

    if (action === "list-users") {
      const { rows: directory, error: directoryError } = await listAllRows<DirectoryUser>((from, to) => adminClient
        .from("auth_username_directory")
        .select("user_id,username,normalized_username,created_at,updated_at,last_seen_at")
        .order("normalized_username")
        .range(from, to));
      if (directoryError) return json(request, { error: "Could not read the member directory." }, 502);
      const users = directory.map((user) => ({
        id: user.user_id,
        username: user.username || user.normalized_username || "username",
        lastSeenAt: String(user.last_seen_at ?? user.created_at ?? ""),
        isAdmin: isRosterAdmin(user.user_id, adminRoster),
      })).sort((left, right) => left.username.localeCompare(right.username));
      return json(request, { users });
    }

    if (action === "set-admin") {
      const username = normalizeUsername(String(body?.username ?? ""));
      const shouldBeAdmin = body?.isAdmin === true;
      if (!username || !/^[a-z0-9_.-]{2,24}$/.test(username)) return json(request, { error: "Enter a valid member username." }, 400);
      const { data: target, error: targetError } = await adminClient
        .from("auth_username_directory")
        .select("user_id,username,normalized_username")
        .eq("normalized_username", username)
        .maybeSingle();
      if (targetError) return json(request, { error: "Could not read the member directory." }, 502);
      if (!target?.user_id) return json(request, { error: "No member was found for that username." }, 404);
      const targetIsAdmin = adminRoster.ids.has(String(target.user_id));
      if (targetIsAdmin === shouldBeAdmin) return json(request, { ok: true, isAdmin: targetIsAdmin, username });

      const { data: roleChange, error: roleChangeError } = await adminClient.rpc("set_admin_user", {
        target_user_id: target.user_id,
        should_be_admin: shouldBeAdmin,
        actor_user_id: callerData.user.id,
        target_username: target.username || username,
        bootstrap_user_id: adminRoster.bootstrapFallback ? ADMIN_USER_ID || null : null,
      });
      if (roleChangeError) return json(request, { error: "Could not change administrator access." }, 502);
      if (roleChange?.reason === "last-admin") return json(request, { error: "At least one administrator must remain." }, 409);
      if (roleChange?.reason === "not-found") return json(request, { error: "No member was found for that username." }, 404);
      if (roleChange?.ok !== true) return json(request, { error: "Could not change administrator access." }, 502);
      // app_metadata is only written from this protected service-role path.
      // The client may use the signed JWT metadata to shape its UI, but every
      // privileged operation above still verifies the admin roster server-side.
      const authTarget = await adminClient.auth.admin.getUserById(target.user_id);
      if (!authTarget.error && authTarget.data.user) {
        await adminClient.auth.admin.updateUserById(target.user_id, {
          app_metadata: {
            ...(authTarget.data.user.app_metadata ?? {}),
            role: roleChange.isAdmin === true ? "admin" : "user",
            is_admin: roleChange.isAdmin === true,
          },
        });
      }
      return json(request, { ok: true, isAdmin: roleChange.isAdmin === true, username });
    }

    const username = String(body?.username ?? "").trim().toLowerCase();
    if (!username || !/^[a-z0-9_.-]{2,24}$/.test(username)) return json(request, { error: "Enter a valid member username." }, 400);

    const { data: target, error: targetError } = await adminClient
      .from("auth_username_directory")
      .select("user_id,username,normalized_username,created_at")
      .eq("normalized_username", username)
      .maybeSingle();
    if (targetError) return json(request, { error: "Could not read the member directory." }, 502);
    if (!target?.user_id) return json(request, { error: "No member was found for that username." }, 404);

    type SplitRow = { id: string; name: string; updated_at: string };
    type ExerciseRow = { id: string; split_id: string; name: string; completed: boolean };
    type SetRow = { exercise_id: string; set_number: number; weight: number; unit: string; reps: number; rir: number };
    const [splits, exercises, sets, { count: sessionCount, error: sessionError }] = await Promise.all([
      listAllRows<SplitRow>((from, to) => adminClient.from("splits").select("id,name,updated_at").eq("user_id", target.user_id).order("position").range(from, to)),
      listAllRows<ExerciseRow>((from, to) => adminClient.from("exercises").select("id,split_id,name,completed").eq("user_id", target.user_id).order("position").range(from, to)),
      listAllRows<SetRow>((from, to) => adminClient.from("exercise_sets").select("exercise_id,set_number,weight,unit,reps,rir").eq("user_id", target.user_id).order("set_number").range(from, to)),
      adminClient.from("workout_sessions").select("id", { count: "exact", head: true }).eq("user_id", target.user_id),
    ]);
    if (splits.error || exercises.error || sets.error || sessionError) return json(request, { error: "Could not read this member's workout data." }, 502);

    const setsByExercise = new Map<string, { weight: number; unit: "kg" | "lb"; reps: number; rir: number }[]>();
    for (const row of sets.rows) {
      const items = setsByExercise.get(row.exercise_id) ?? [];
      items.push({ weight: Number(row.weight) || 0, unit: row.unit === "lb" ? "lb" : "kg", reps: Number(row.reps) || 0, rir: Number(row.rir) || 0 });
      setsByExercise.set(row.exercise_id, items);
    }
    const exercisesBySplit = new Map<string, { name: string; completed: boolean; sets: { weight: number; unit: "kg" | "lb"; reps: number; rir: number }[] }[]>();
    for (const row of exercises.rows) {
      const items = exercisesBySplit.get(row.split_id) ?? [];
      items.push({ name: row.name, completed: Boolean(row.completed), sets: setsByExercise.get(row.id) ?? [] });
      exercisesBySplit.set(row.split_id, items);
    }

    return json(request, { member: {
      username: String(target.username ?? username),
      createdAt: target.created_at,
      sessions: sessionCount ?? 0,
      splits: splits.rows.map((split) => ({ id: split.id, name: split.name, updatedAt: split.updated_at, exercises: exercisesBySplit.get(split.id) ?? [] })),
    } });
  } catch {
    return json(request, { error: "Could not load member data." }, 500);
  }
});
