const origin = new URL(process.env.TRACK_MONITOR_ORIGIN ?? "https://trackz.pages.dev");
const requestCount = Math.max(1, Math.min(200, Number(process.env.LOAD_TEST_REQUESTS ?? 24)));
const concurrency = Math.max(1, Math.min(10, Number(process.env.LOAD_TEST_CONCURRENCY ?? 4)));
const maxErrorRate = Math.max(0, Math.min(1, Number(process.env.LOAD_TEST_MAX_ERROR_RATE ?? 0.05)));
const maxP95Ms = Math.max(100, Number(process.env.LOAD_TEST_MAX_P95_MS ?? 1500));
const timeoutMs = 10_000;
const paths = ["/", "/track-release.json"];
const results = [];
let nextRequest = 0;

async function runRequest(index) {
  const path = paths[index % paths.length];
  const startedAt = performance.now();
  try {
    const response = await fetch(new URL(path, origin), {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "User-Agent": "Track-II-production-monitor/1.0" },
    });
    const durationMs = performance.now() - startedAt;
    results.push({ ok: response.ok, status: response.status, durationMs, path });
    await response.body?.cancel();
  } catch (error) {
    results.push({
      ok: false,
      status: 0,
      durationMs: performance.now() - startedAt,
      path,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function worker() {
  while (nextRequest < requestCount) {
    const index = nextRequest++;
    await runRequest(index);
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, requestCount) }, worker));
const durations = results.map(({ durationMs }) => durationMs).sort((left, right) => left - right);
const p50 = durations[Math.max(0, Math.ceil(durations.length * 0.5) - 1)] ?? 0;
const p95 = durations[Math.max(0, Math.ceil(durations.length * 0.95) - 1)] ?? 0;
const failures = results.filter(({ ok }) => !ok);
const errorRate = failures.length / Math.max(1, results.length);

console.log(
  JSON.stringify(
    {
      origin: origin.origin,
      requests: results.length,
      concurrency,
      failures: failures.length,
      errorRate: Number(errorRate.toFixed(4)),
      p50Ms: Math.round(p50),
      p95Ms: Math.round(p95),
      failedPaths: failures.map(({ path, status, error }) => ({ path, status, error })),
    },
    null,
    2,
  ),
);

if (errorRate > maxErrorRate) {
  console.error(`Production monitor exceeded the error-rate budget (${errorRate} > ${maxErrorRate}).`);
  process.exit(1);
}
if (p95 > maxP95Ms) {
  console.error(`Production monitor exceeded the p95 latency budget (${Math.round(p95)}ms > ${maxP95Ms}ms).`);
  process.exit(1);
}
