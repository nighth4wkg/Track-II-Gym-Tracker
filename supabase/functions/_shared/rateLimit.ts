import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.111.0";

export type RateLimitResult = {
  available: boolean;
  allowed: boolean;
  retryAfterSeconds: number;
};

async function fingerprint(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function consumeRateLimit(
  adminClient: SupabaseClient,
  bucket: string,
  key: string,
  windowSeconds: number,
  maxAttempts: number,
): Promise<RateLimitResult> {
  try {
    const keyHash = await fingerprint(`${bucket}:${key}`);
    const { data, error } = await adminClient.rpc("consume_edge_rate_limit", {
      p_bucket: bucket,
      p_key_hash: keyHash,
      p_window_seconds: windowSeconds,
      p_max_attempts: maxAttempts,
    });
    if (error) return { available: false, allowed: false, retryAfterSeconds: 0 };
    const row = Array.isArray(data) ? data[0] : data;
    return {
      available: Boolean(row),
      allowed: row?.allowed === true,
      retryAfterSeconds: Math.max(0, Number(row?.retry_after_seconds) || 0),
    };
  } catch {
    return { available: false, allowed: false, retryAfterSeconds: 0 };
  }
}
