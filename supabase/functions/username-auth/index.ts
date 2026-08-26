import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { normalizeUsername } from "../_shared/admin.ts";
import { isAllowedOrigin, responseHeaders } from "../_shared/cors.ts";
import { isJsonObject, json, type JsonObject, type JsonValue } from "../_shared/http.ts";
import { consumeRateLimit } from "../_shared/rateLimit.ts";

const RATE_WINDOW_SECONDS = 5 * 60;
const MAX_ATTEMPTS = 10;
const MAX_BODY_BYTES = 16 * 1024;
function validUsername(username: string) {
  return /^[a-z0-9_.-]{2,24}$/.test(username);
}

function genericFailure() {
  return "We couldn't sign you in with those details.";
}

function clientAddress(request: Request) {
  // Only trust Cloudflare's connection header. Client-controlled forwarding
  // headers must not be accepted as an IP identity for rate limiting.
  return request.headers.get("cf-connecting-ip")?.trim() || "unknown";
}

async function findUser(adminClient: SupabaseClient, username: string) {
  // Usernames are resolved through an indexed directory populated by the
  // database trigger. This avoids an O(number of Auth users) scan on every
  // login and does not expose whether a username exists to the caller.
  const { data: directoryRow, error: directoryError } = await adminClient
    .from("auth_username_directory")
    .select("user_id")
    .eq("normalized_username", username)
    .maybeSingle();
  if (directoryError || !directoryRow?.user_id) return null;
  const { data, error } = await adminClient.auth.admin.getUserById(String(directoryRow.user_id));
  if (error) return null;
  // SAFETY: Supabase's successful getUserById response contains the Auth User
  // object; the explicit null fallback preserves the failure contract.
  return data.user as User | null;
}

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin") ?? "";
  if (!isAllowedOrigin(origin)) return new Response("Forbidden", { status: 403 });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: responseHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "POST is required." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
      ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")
      ?? Deno.env.get("SB_PUBLISHABLE_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) return json(request, { error: "Authentication service is not configured." }, 500);

    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const ipLimit = await consumeRateLimit(adminClient, "username-auth:ip", clientAddress(request), RATE_WINDOW_SECONDS, MAX_ATTEMPTS);
    if (!ipLimit.available) return json(request, { error: "Authentication service is temporarily unavailable." }, 503);
    if (!ipLimit.allowed) return json(request, { error: "Too many attempts. Try again in a few minutes." }, 429);

    const contentLength = Number(request.headers.get("Content-Length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) return json(request, { error: genericFailure() }, 413);
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) return json(request, { error: genericFailure() }, 413);
    const parsedBody: JsonValue = JSON.parse(rawBody || "null");
    const body = isJsonObject(parsedBody) ? parsedBody : null;
    const action = body?.action === "reset" ? "reset" : body?.action === "sign-in" ? "sign-in" : "";
    const username = normalizeUsername(String(body?.username ?? ""));
    if (!action || !validUsername(username)) return json(request, { error: genericFailure() }, 400);
    const usernameLimit = await consumeRateLimit(adminClient, "username-auth:username", username, RATE_WINDOW_SECONDS, MAX_ATTEMPTS);
    if (!usernameLimit.available) return json(request, { error: "Authentication service is temporarily unavailable." }, 503);
    if (!usernameLimit.allowed) return json(request, { error: "Too many attempts. Try again in a few minutes." }, 429);

    const target = await findUser(adminClient, username);
    if (!target?.email) {
      if (action === "reset") return json(request, { message: "If an account exists, a reset link is on its way." });
      return json(request, { error: genericFailure() }, 401);
    }

    const publicClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    if (action === "reset") {
      let redirectTo: string | undefined;
      try {
        const parsed = new URL(String(body?.redirectTo ?? ""));
        if (isAllowedOrigin(parsed.origin)) redirectTo = parsed.toString();
      } catch {
        redirectTo = undefined;
      }
      await publicClient.auth.resetPasswordForEmail(target.email, redirectTo ? { redirectTo } : undefined);
      return json(request, { message: "If an account exists, a reset link is on its way." });
    }

    const password = String(body?.password ?? "");
    if (password.length < 6 || password.length > 256) return json(request, { error: genericFailure() }, 401);
    const { data, error } = await publicClient.auth.signInWithPassword({ email: target.email, password });
    if (error || !data.session) return json(request, { error: genericFailure() }, 401);
    const session: JsonObject = {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
      token_type: data.session.token_type,
    };
    if (data.session.expires_at !== undefined) session.expires_at = data.session.expires_at;
    return json(request, { session });
  } catch {
    return json(request, { error: genericFailure() }, 401);
  }
});
