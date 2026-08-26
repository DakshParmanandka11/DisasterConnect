const CACHE_NAME = "disasterconnect-v3";

const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/favicon.svg",
  "/manifest.json"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch(() => {});
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // API requests fallback when offline
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/uploads")) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({ error: "Offline mode active", offline: true, reports: [], notifications: [] }),
          { headers: { "Content-Type": "application/json" }, status: 200 }
        );
      })
    );
    return;
  }

  // Static assets & page navigation caching strategy
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(event.request);

      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
            if (event.request.mode === "navigate") {
              cache.put("/index.html", networkResponse.clone());
              cache.put("/", networkResponse.clone());
            }
          }
          return networkResponse;
        })
        .catch(() => null);

      if (cachedResponse) {
        return cachedResponse;
      }

      const networkResult = await fetchPromise;
      if (networkResult) return networkResult;

      if (event.request.mode === "navigate") {
        const indexMatch = (await cache.match("/index.html")) || (await cache.match("/"));
        if (indexMatch) return indexMatch;
      }

      return new Response(
        `<!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>DisasterConnect — Offline Emergency Rescue</title>
            <style>
              body { background: #0f172a; color: #f8fafc; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; text-align: center; }
              .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 24px; max-width: 400px; }
              h2 { color: #f59e0b; margin-top: 0; }
              .btn { display: block; background: #ef4444; color: white; padding: 12px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 12px; }
            </style>
          </head>
          <body>
            <div class="card">
              <h2>📡 Offline Emergency Rescue</h2>
              <p>Cell network is down. Tap below to send a zero-data emergency SMS:</p>
              <a href="sms:911100200?body=SOS%7CFLOOD%7CCRITICAL%7C28.6139,77.2090%7CTRAPPED%20ON%20ROOF" class="btn">🌊 1-Tap Flood Rescue SMS</a>
              <a href="sms:911100200?body=SOS%7CFIRE%7CCRITICAL%7C28.6139,77.2090%7CFIRE%20RESCUE" class="btn" style="background:#d97706">🔥 1-Tap Fire Rescue SMS</a>
              <a href="sms:112?body=SOS" class="btn" style="background:#2563eb">💬 Text SOS to 112</a>
            </div>
          </body>
        </html>`,
        { headers: { "Content-Type": "text/html" } }
      );
    })
  );
});

