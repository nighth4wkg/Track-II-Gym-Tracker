const configuredBaseUrl = String(process.env.PAGES_VERIFY_URL ?? "").trim();
if (!configuredBaseUrl) {
  console.log("Cloudflare header verification skipped; set PAGES_VERIFY_URL to a deployed Pages origin.");
  process.exit(0);
}

const baseUrl = new URL(configuredBaseUrl);
const timeoutMs = 15_000;

async function fetchChecked(url, init = {}) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

function requireStatus(response, expected, label) {
  if (response.status !== expected) throw new Error(`${label} returned HTTP ${response.status}.`);
}

const htmlResponse = await fetchChecked(baseUrl);
requireStatus(htmlResponse, 200, "Pages HTML");
const htmlCache = htmlResponse.headers.get("cache-control") ?? "";
if (!/no-cache/i.test(htmlCache) || !/no-store/i.test(htmlCache)) {
  throw new Error(`Pages HTML must be revalidated; received Cache-Control: ${htmlCache || "(missing)"}`);
}

const html = await htmlResponse.text();
const assetMatch = html.match(/<script[^>]+src=["']([^"']+\/assets\/[^"']+\.js(?:\?[^"']*)?)["']/i);
if (!assetMatch?.[1]) throw new Error("Could not find a hashed JavaScript asset in the Pages HTML.");
const assetUrl = new URL(assetMatch[1], baseUrl);
const assetResponse = await fetchChecked(assetUrl, { headers: { "accept-encoding": "br, gzip" } });
requireStatus(assetResponse, 200, "Hashed asset");
const assetCache = assetResponse.headers.get("cache-control") ?? "";
if (!/public/i.test(assetCache) || !/immutable/i.test(assetCache) || !/max-age=31536000/i.test(assetCache)) {
  throw new Error(`Hashed asset cache policy is too weak: ${assetCache || "(missing)"}`);
}

const encoding = (assetResponse.headers.get("content-encoding") ?? "").toLowerCase();
if (process.env.PAGES_VERIFY_REQUIRE_BROTLI === "1" && encoding !== "br") {
  throw new Error(`Expected Brotli for ${assetUrl.pathname}, received ${encoding || "none"}.`);
}
console.log(`Pages headers verified: HTML no-store, asset immutable, content-encoding=${encoding || "none"}.`);
