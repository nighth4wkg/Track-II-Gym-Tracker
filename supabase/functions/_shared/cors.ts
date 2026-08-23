export const DEFAULT_ALLOWED_ORIGINS = [
  "capacitor://localhost",
  "ionic://localhost",
  "https://localhost",
  "http://localhost",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:4173",
];

const NATIVE_APP_ORIGINS = new Set(["capacitor://localhost", "ionic://localhost", "https://localhost", "http://localhost"]);

type ResponseHeaders = {
  "Access-Control-Allow-Headers": string;
  "Access-Control-Allow-Methods": string;
  "Access-Control-Allow-Origin"?: string;
  "Cache-Control": string;
  "Content-Type": string;
  Vary: string;
};

function configuredOrigins() {
  return new Set(`${DEFAULT_ALLOWED_ORIGINS.join(",")},${Deno.env.get("TRACK_ALLOWED_ORIGINS") ?? ""}`
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean));
}

export function isAllowedOrigin(origin: string) {
  if (!origin) return true;
  if (NATIVE_APP_ORIGINS.has(origin)) return true;
  if (configuredOrigins().has(origin)) return true;
  return false;
}

export function responseHeaders(request: Request) {
  const origin = request.headers.get("Origin") ?? "";
  const headers: ResponseHeaders = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
    Vary: "Origin",
  };

  if (origin && isAllowedOrigin(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}
