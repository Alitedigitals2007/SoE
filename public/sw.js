const CACHE_NAME = "soe-v2";
const STATIC_ASSETS = ["/", "/manifest.json", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API calls, admin pages and Next.js internals must always hit the network
  // (or fail naturally) — never serve them stale from cache.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/admin/") ||
    url.pathname.startsWith("/_next/") ||
    request.headers.get("RSC") === "1"
  ) {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const clone = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(request, clone))
            .catch(() => {});
        }
        return response;
      } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") {
          return new Response(
            "<!doctype html><html lang=en><meta charset=utf-8><meta name=viewport content=\"width=device-width,initial-scale=1\"><title>Offline</title><body style=\"font-family:system-ui;display:grid;place-content:center;min-height:100vh;margin:0;background:#f4f1e9;color:#17211c;text-align:center\"><div><h1 style=\"font-size:1.25rem\">You&rsquo;re offline</h1><p>This page isn&rsquo;t cached yet. Check your connection and try again.</p><p><button onclick=\"location.reload()\" style=\"padding:.6rem 1.2rem;border:0;border-radius:.6rem;background:#087a55;color:#fff;font-size:1rem\">Retry</button></p></div></body></html>",
            { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
          );
        }
        return Response.error();
      }
    })(),
  );
});
