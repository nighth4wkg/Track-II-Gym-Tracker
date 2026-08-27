import { readFile } from "node:fs/promises";

const packageData = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const baseUrl = new URL(process.env.PRODUCTION_BASE_URL ?? "https://trackz.pages.dev");
const supabaseUrlValue = process.env.PRODUCTION_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const publishableKey =
  process.env.PRODUCTION_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const timeoutMs = 15_000;

if (!supabaseUrlValue || !publishableKey) {
  console.error("Production smoke requires PRODUCTION_SUPABASE_URL and PRODUCTION_SUPABASE_PUBLISHABLE_KEY.");
  process.exit(1);
}

const supabaseUrl = new URL(supabaseUrlValue);
const origin = baseUrl.origin;
const headers = { apikey: publishableKey, Origin: origin };
const checks = [];

async function request(url, init = {}) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

async function check(name, callback) {
  try {
    await callback();
    checks.push({ name, ok: true });
  } catch (error) {
    checks.push({ name, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

function requireStatus(response, expected, label) {
  if (response.status !== expected) throw new Error(`${label} returned HTTP ${response.status}.`);
}

async function readJson(response, label) {
  try {
    return await response.json();
  } catch {
    throw new Error(`${label} returned invalid JSON.`);
  }
}

await check("Cloudflare site loads", async () => {
  const response = await request(baseUrl);
  requireStatus(response, 200, "Cloudflare site");
  const html = await response.text();
  if (!/<title>Track II<\/title>/i.test(html)) throw new Error("Track II title is missing.");
  if (/example\.supabase\.co|sb_publishable_ci_placeholder/i.test(html))
    throw new Error("Placeholder configuration is live.");
});

await check("Update manifest is available", async () => {
  const response = await request(new URL("/track-release.json", baseUrl));
  requireStatus(response, 200, "Update manifest");
  const manifest = await readJson(response, "Update manifest");
  if (manifest.version !== packageData.version)
    throw new Error(`Manifest version ${manifest.version} does not match package ${packageData.version}.`);
  if (!manifest.buildId) throw new Error("Update manifest has no build id.");
});

await check("Supabase connectivity and CORS", async () => {
  const response = await request(new URL("/auth/v1/settings", supabaseUrl), { headers });
  requireStatus(response, 200, "Supabase Auth settings");
  if (response.headers.get("access-control-allow-origin") !== origin)
    throw new Error("Supabase did not allow the production origin.");
});

const usernameAuthUrl = new URL("/functions/v1/username-auth", supabaseUrl);
await check("Username auth preflight", async () => {
  const response = await request(usernameAuthUrl, {
    method: "OPTIONS",
    headers: {
      ...headers,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization,content-type,apikey",
    },
  });
  requireStatus(response, 204, "Username auth preflight");
  if (response.headers.get("access-control-allow-origin") !== origin)
    throw new Error("Username auth CORS origin is incorrect.");
});

await check("Email login endpoint responds safely", async () => {
  const response = await request(new URL("/auth/v1/token?grant_type=password", supabaseUrl), {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "track-ii-smoke-invalid@example.invalid", password: "not-a-real-password" }),
  });
  if (response.status < 400 || response.status >= 500)
    throw new Error(`Email login returned unexpected HTTP ${response.status}.`);
});

await check("Username login endpoint responds safely", async () => {
  const response = await request(usernameAuthUrl, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "sign-in", username: "track-ii-smoke-invalid", password: "not-a-real-password" }),
  });
  if (response.status < 400 || response.status >= 500)
    throw new Error(`Username login returned unexpected HTTP ${response.status}.`);
});

const smokeIdentifier = String(process.env.PRODUCTION_SMOKE_USERNAME ?? "").trim();
const smokePassword = String(process.env.PRODUCTION_SMOKE_PASSWORD ?? "");
if (smokeIdentifier && smokePassword) {
  await check("Production login succeeds with protected smoke credentials", async () => {
    let response;
    if (smokeIdentifier.includes("@")) {
      response = await request(new URL("/auth/v1/token?grant_type=password", supabaseUrl), {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ email: smokeIdentifier, password: smokePassword }),
      });
    } else {
      response = await request(usernameAuthUrl, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sign-in", username: smokeIdentifier, password: smokePassword }),
      });
    }
    requireStatus(response, 200, "Production login");
    const payload = await readJson(response, "Production login");
    const accessToken = payload.access_token ?? payload.session?.access_token;
    if (!accessToken) throw new Error("Production login returned no access token.");
    await request(new URL("/auth/v1/logout", supabaseUrl), {
      method: "POST",
      headers: { ...headers, Authorization: `Bearer ${accessToken}` },
    });
  });
} else {
  console.log(
    "Protected credential check skipped; set PRODUCTION_SMOKE_USERNAME and PRODUCTION_SMOKE_PASSWORD to enable it.",
  );
}

for (const result of checks)
  console.log(`${result.ok ? "PASS" : "FAIL"}  ${result.name}${result.ok ? "" : ` — ${result.error}`}`);
if (checks.some((result) => !result.ok)) process.exit(1);
console.log("Production smoke checks passed.");
