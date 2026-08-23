import { createClient } from "https://esm.sh/@supabase/supabase-js@2.111.0";
import { checkAdminAccess } from "../_shared/admin.ts";
import { isAllowedOrigin, responseHeaders } from "../_shared/cors.ts";
import { isJsonObject, json, type JsonValue } from "../_shared/http.ts";
import { consumeRateLimit } from "../_shared/rateLimit.ts";

const MAX_BODY_BYTES = 8 * 1024;
const RATE_WINDOW_SECONDS = 5 * 60;
const MAX_ATTEMPTS = 10;
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
    if (!supabaseUrl || !anonKey || !serviceRoleKey) return json(request, { error: "Announcement service is not configured." }, 500);
    if (!authorization) return json(request, { error: "Authentication required." }, 401);

    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: callerData, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerData.user) return json(request, { error: "Authentication required." }, 401);

    const contentLength = Number(request.headers.get("Content-Length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) return json(request, { error: "Announcement is too large." }, 413);
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) return json(request, { error: "Announcement is too large." }, 413);
    const parsedBody: JsonValue = JSON.parse(rawBody || "null");
    const body = isJsonObject(parsedBody) ? parsedBody : null;
    const message = String(body?.message ?? "").trim();
    if (!message || message.length > 240)
      return json(request, { error: "Write an announcement up to 240 characters." }, 400);

    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const limit = await consumeRateLimit(adminClient, "admin-announcement:user", callerData.user.id, RATE_WINDOW_SECONDS, MAX_ATTEMPTS);
    if (!limit.available) return json(request, { error: "Announcement service is temporarily unavailable." }, 503);
    if (!limit.allowed) return json(request, { error: "Too many announcements. Try again later." }, 429);
    const adminAccess = await checkAdminAccess(adminClient, callerData.user);
    if (!adminAccess.ready) return json(request, { error: "Administrator roster is not configured. Apply the admin_users migration first." }, 503);
    if (!adminAccess.isAdmin) return json(request, { error: "Administrator access required." }, 403);

    const { data, error } = await adminClient.from("track_announcements").insert({ message }).select("id,message,created_at").single();
    if (error || !data) return json(request, { error: "Could not save the announcement." }, 502);
    // Keep the audit trail free of announcement contents and personal data;
    // the action, actor, and message length are sufficient for review.
    const { error: auditError } = await adminClient.from("admin_audit_log").insert({
      actor_user_id: callerData.user.id,
      action: "announcement-created",
      metadata: { messageLength: message.length },
    });
    if (auditError) {
      // The announcement already exists, so do not ask the client to retry and
      // accidentally create duplicates. Surface the audit failure explicitly.
      console.error("admin announcement audit write failed", auditError.message);
      return json(request, {
        id: String(data.id),
        message: String(data.message),
        createdAt: String(data.created_at),
        auditLogged: false,
        warning: "Announcement saved, but its audit record could not be written.",
      });
    }
    return json(request, { id: String(data.id), message: String(data.message), createdAt: String(data.created_at), auditLogged: true });
  } catch {
    return json(request, { error: "Could not save the announcement." }, 400);
  }
});
