import { TRACK_BUILD_ID, TRACK_METRICS_URL } from "./trackConfig";

type VitalName = "LCP" | "CLS" | "INP" | "FCP" | "TTFB";
type LayoutShiftEntry = PerformanceEntry & { value?: number; hadRecentInput?: boolean };
type EventTimingEntry = PerformanceEntry & { duration?: number; interactionId?: number };

type VitalPayload = {
  name: VitalName;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  path: string;
  buildId: string;
};

let stopActiveVitals: (() => void) | null = null;

function ratingFor(name: VitalName, value: number): VitalPayload["rating"] {
  const thresholds = {
    LCP: [2500, 4000],
    CLS: [0.1, 0.25],
    INP: [200, 500],
    FCP: [1800, 3000],
    TTFB: [800, 1800],
  } satisfies Record<VitalName, readonly [number, number]>;
  const [good, poor] = thresholds[name];
  return value <= good ? "good" : value <= poor ? "needs-improvement" : "poor";
}

function supportsEntryType(type: string) {
  return Boolean(globalThis.PerformanceObserver?.supportedEntryTypes?.includes(type));
}

function sendMetric(metric: VitalPayload) {
  if (!globalThis.window) return;
  const body = JSON.stringify(metric);
  if (TRACK_METRICS_URL && navigator.sendBeacon) {
    navigator.sendBeacon(TRACK_METRICS_URL, new Blob([body], { type: "application/json" }));
  } else if (TRACK_METRICS_URL) {
    void fetch(TRACK_METRICS_URL, {
      method: "POST",
      body,
      keepalive: true,
      headers: { "content-type": "application/json" },
    }).catch(() => undefined);
  }
  globalThis.dispatchEvent(new CustomEvent("track-web-vital", { detail: metric }));
}

export function startWebVitals() {
  if (!globalThis.window || !globalThis.PerformanceObserver || stopActiveVitals) return () => undefined;
  const pending = new Map<VitalName, number>();
  const observers: PerformanceObserver[] = [];
  const reported = new Set<VitalName>();

  const record = (name: VitalName, value: number) => {
    if (Number.isFinite(value) && value >= 0) pending.set(name, value);
  };
  const reportPending = () => {
    for (const [name, value] of pending) {
      if (reported.has(name)) continue;
      reported.add(name);
      sendMetric({
        name,
        value: Number(value.toFixed(name === "CLS" ? 4 : 2)),
        rating: ratingFor(name, value),
        path: `${window.location.pathname}${window.location.search}`,
        buildId: TRACK_BUILD_ID,
      });
    }
  };
  const observe = (type: string, handler: (entry: PerformanceEntry) => void) => {
    if (!supportsEntryType(type)) return;
    try {
      const observer = new PerformanceObserver((list) => list.getEntries().forEach(handler));
      observer.observe({ type, buffered: true });
      observers.push(observer);
    } catch {
      // Unsupported observers are optional; page rendering must never depend
      // on telemetry availability.
    }
  };

  observe("paint", (entry) => {
    if (entry.name === "first-contentful-paint") record("FCP", entry.startTime);
  });
  observe("largest-contentful-paint", (entry) => record("LCP", entry.startTime));
  observe("layout-shift", (entry) => {
    // SAFETY: this callback is registered only for the browser's layout-shift
    // entry type; the optional fields account for partial browser support.
    const shift = entry as LayoutShiftEntry;
    if (!shift.hadRecentInput) record("CLS", (pending.get("CLS") ?? 0) + (shift.value ?? 0));
  });
  observe("event", (entry) => {
    // SAFETY: this callback is registered only for PerformanceEventTiming
    // entries; the optional fields account for partial browser support.
    const timing = entry as EventTimingEntry;
    if (timing.interactionId && timing.duration) record("INP", Math.max(pending.get("INP") ?? 0, timing.duration));
  });
  // SAFETY: getEntriesByType("navigation") returns PerformanceNavigationTiming
  // entries according to the Performance Timeline contract.
  const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (navigation) record("TTFB", navigation.responseStart - navigation.requestStart);

  const flush = () => {
    if (document.visibilityState === "hidden") reportPending();
  };
  document.addEventListener("visibilitychange", flush);
  window.addEventListener("pagehide", reportPending);
  const stop = () => {
    observers.forEach((observer) => observer.disconnect());
    document.removeEventListener("visibilitychange", flush);
    window.removeEventListener("pagehide", reportPending);
    if (stopActiveVitals === stop) stopActiveVitals = null;
  };
  stopActiveVitals = stop;
  return stop;
}
