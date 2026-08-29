const TRACK_CACHE_PREFIX = "track-ii-shell-";
const TRACK_CACHE_NAME = `${TRACK_CACHE_PREFIX}__TRACK_VERSION__-__TRACK_BUILD_ID__`;
const OFFLINE_URL = "/offline.html";
const SHELL_URLS = [
  "/",
  OFFLINE_URL,
  "/offline.css",
  "/track-loading.css",
  "/track-boot.js",
  "/manifest.webmanifest",
  "/track-icon.svg",
];

function isSameOrigin(request) {
  return new URL(request.url).origin === self.location.origin;
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/assets/") ||
    url.pathname === "/offline.css" ||
    url.pathname === "/track-loading.css" ||
    url.pathname === "/track-boot.js" ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".webmanifest")
  );
}

async function fetchWithTimeout(request, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function cacheShell() {
  const cache = await caches.open(TRACK_CACHE_NAME);
  await Promise.all(
    SHELL_URLS.map(async (url) => {
      try {
        const response = await fetch(url, { cache: "no-cache" });
        if (response.ok) await cache.put(url, response);
      } catch {
        // A partial shell is still useful; the next visit can fill the gap.
      }
    }),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheShell().finally(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(TRACK_CACHE_PREFIX) && key !== TRACK_CACHE_NAME)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "TRACK_SW_SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || !isSameOrigin(request)) return;
  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(
      fetchWithTimeout(request, 3500)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(TRACK_CACHE_NAME);
            await cache.put("/", response.clone());
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match("/");
          return cached ?? caches.match(OFFLINE_URL);
        }),
    );
    return;
  }

  if (!isStaticAsset(url)) return;
  event.respondWith(
    caches.match(request).then(async (cached) => {
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(TRACK_CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        return new Response("Offline", { status: 503, statusText: "Offline" });
      }
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (windows.length) {
        await windows[0].focus();
        return;
      }
      await self.clients.openWindow("/");
    })(),
  );
});
