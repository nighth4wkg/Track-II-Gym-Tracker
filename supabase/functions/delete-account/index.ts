import { createClient } from "@supabase/supabase-js";
import { isAllowedOrigin, responseHeaders } from "../_shared/cors.ts";
import { json } from "../_shared/http.ts";

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin") ?? "";
  if (!isAllowedOrigin(origin)) return new Response("Forbidden", { status: 403 });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: responseHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "POST is required." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json(request, { error: "Account service is not configured." }, 500);
  if (!authorization) return json(request, { error: "Authentication required." }, 401);

  try {
    const callerClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: authorization } },
    });
    const { data: caller, error: callerError } = await callerClient.auth.getUser();
    const userId = caller.user?.id;
    if (callerError || !userId) return json(request, { error: "Authentication required." }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    // The SQL function keeps all public-table deletion in one transaction. Auth
    // is deleted only after that transaction succeeds.
    const { error: dataDeleteError } = await adminClient.rpc("delete_account_data", { target_user_id: userId });
    if (dataDeleteError) return json(request, { error: "Your account could not be deleted. Nothing was removed." }, 502);

    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteUserError) return json(request, { error: "Your workout data was removed, but the account could not be closed. Contact support." }, 502);
    return json(request, { ok: true });
  } catch {
    return json(request, { error: "Your account could not be deleted. Nothing was removed." }, 500);
  }
});
