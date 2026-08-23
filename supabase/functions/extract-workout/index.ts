import { createClient } from "https://esm.sh/@supabase/supabase-js@2.111.0";
import { isAllowedOrigin, responseHeaders } from "../_shared/cors.ts";
import { isBooleanValue, isFiniteNumberValue, isIntegerValue, isJsonObject, isStringValue, json, type JsonValue } from "../_shared/http.ts";
import { consumeRateLimit } from "../_shared/rateLimit.ts";

const MAX_BODY_BYTES = 12 * 1024 * 1024;
const MAX_IMAGE_CHARS = 11 * 1024 * 1024;
const RATE_WINDOW_SECONDS = 10 * 60;
const MAX_ATTEMPTS = 8;
const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
type AiExercise = {
  name: string;
  needsReview: boolean;
  sets: { weight: number; unit: "kg" | "lb"; reps: number; rir: number }[];
};

function geminiText(value: JsonValue): string | null {
  if (!isJsonObject(value) || !Array.isArray(value.candidates)) return null;
  const candidate = value.candidates[0];
  if (!isJsonObject(candidate) || !isJsonObject(candidate.content) || !Array.isArray(candidate.content.parts)) return null;
  for (const part of candidate.content.parts) {
    if (isJsonObject(part) && isStringValue(part.text)) return part.text;
  }
  return null;
}

function sanitizeExercises(value: JsonValue): AiExercise[] | null {
  if (!isJsonObject(value) || !Array.isArray(value.exercises) || value.exercises.length === 0 || value.exercises.length > 50) return null;
  const exercises: AiExercise[] = [];
  for (const exerciseValue of value.exercises) {
    if (!isJsonObject(exerciseValue)) return null;
    const name = exerciseValue.name;
    const needsReview = exerciseValue.needsReview;
    const rawSets = exerciseValue.sets;
    if (!isStringValue(name) || name.trim().length === 0 || name.trim().length > 160 || !isBooleanValue(needsReview) || !Array.isArray(rawSets) || rawSets.length === 0 || rawSets.length > 50) return null;
    const sets: AiExercise["sets"] = [];
    for (const setValue of rawSets) {
      if (!isJsonObject(setValue)) return null;
      const weight = setValue.weight;
      const unit = setValue.unit;
      const reps = setValue.reps;
      const rir = setValue.rir;
      if (!isFiniteNumberValue(weight) || weight < 0 || weight > 100000 || (unit !== "kg" && unit !== "lb") || !isIntegerValue(reps) || reps < 0 || reps > 1000 || !isIntegerValue(rir) || rir < 0 || rir > 10) return null;
      sets.push({ weight, unit, reps, rir });
    }
    exercises.push({ name: name.trim(), needsReview: needsReview === true, sets });
  }
  return exercises;
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
    const geminiModel = String(Deno.env.get("TRACK_GEMINI_MODEL") ?? DEFAULT_GEMINI_MODEL).trim();
    const authorization = request.headers.get("Authorization");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) return json(request, { error: "AI import is not configured." }, 500);
    if (!authorization) return json(request, { error: "Authentication required." }, 401);
    if (!/^[a-zA-Z0-9._-]{1,80}$/.test(geminiModel))
      return json(request, { error: "AI import model configuration is invalid." }, 500);

    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: callerData, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerData.user) return json(request, { error: "Authentication required." }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const limit = await consumeRateLimit(adminClient, "extract-workout:user", callerData.user.id, RATE_WINDOW_SECONDS, MAX_ATTEMPTS);
    if (!limit.available) return json(request, { error: "AI import is temporarily unavailable." }, 503);
    if (!limit.allowed) return json(request, { error: "Too many AI imports. Try again in a few minutes." }, 429);

    const contentLength = Number(request.headers.get("Content-Length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) return json(request, { error: "That image is too large." }, 413);
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) return json(request, { error: "That image is too large." }, 413);
    const parsedBody: JsonValue = JSON.parse(rawBody || "null");
    const body = isJsonObject(parsedBody) ? parsedBody : null;
    const apiKey = String(body?.apiKey ?? "").trim();
    const imageBase64 = String(body?.imageBase64 ?? "");
    const mimeType = String(body?.mimeType ?? "").toLowerCase();
    if (apiKey.length < 10 || apiKey.length > 256 || imageBase64.length < 100 || imageBase64.length > MAX_IMAGE_CHARS || !ALLOWED_IMAGE_TYPES.has(mimeType)) {
      return json(request, { error: "Missing API key or a supported image." }, 400);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    let geminiResponse: Response;
    try {
      const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent`;
      geminiResponse = await fetch(geminiEndpoint, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: [
            { inlineData: { mimeType, data: imageBase64 } },
            { text: "Read this workout image. Extract only exercises that are visibly written. For every exercise, extract each visible set with weight, unit, reps and RIR. Expand prescriptions like 3 x 8 into three identical sets. Use 0 for missing weight and RIR, 1 for missing reps, and kg when no unit is visible. Never invent an exercise. Return an empty exercises array if the image is not a workout or no exercise can be read." },
          ] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              required: ["exercises"],
              properties: {
                exercises: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    required: ["name", "sets", "needsReview"],
                    properties: {
                      name: { type: "STRING" },
                      needsReview: { type: "BOOLEAN" },
                      sets: {
                        type: "ARRAY",
                        items: {
                          type: "OBJECT",
                          required: ["weight", "unit", "reps", "rir"],
                          properties: {
                            weight: { type: "NUMBER" },
                            unit: { type: "STRING", enum: ["kg", "lb"] },
                            reps: { type: "INTEGER" },
                            rir: { type: "INTEGER" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        }),
      });
    } finally {
      clearTimeout(timeout);
    }

    const payload: JsonValue = await geminiResponse.json();
    if (!geminiResponse.ok) return json(request, { error: "Gemini could not process the image." }, geminiResponse.status === 429 ? 429 : 502);
    const text = geminiText(payload);
    if (!text) return json(request, { error: "We couldn't identify exercises in this image." }, 422);
    // SAFETY: Gemini text is parsed as a JSON value only; sanitizeExercises validates the complete shape and ranges before returning it.
    const exercises = sanitizeExercises(JSON.parse(text) as JsonValue);
    if (!exercises) {
      return json(request, { error: "We couldn't identify exercises in this image. Try a clearer or closer photo." }, 422);
    }
    return json(request, { exercises });
  } catch {
    return json(request, { error: "We couldn't figure out what was in that image. Try a clearer photo." }, 502);
  }
});
