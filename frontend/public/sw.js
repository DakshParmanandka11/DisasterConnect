const CACHE_NAME = "disasterconnect-v2";

self.addEventListener("install", (event) => {
  self.skipWaiting();
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

  // Exclude API/Uploads from static cache
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/uploads")) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({ error: "Offline mode active", offline: true }),
          { headers: { "Content-Type": "application/json" } }
        );
      })
    );
    return;
  }

  // Stale-While-Revalidate Strategy for all static assets & navigation
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

      // Return cached version immediately if offline
      if (cachedResponse) {
        return cachedResponse;
      }

      // If no direct match and offline navigation, return cached index.html
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
              <p>Cell network is down. Tap below to send a zero-data emergency SMS to <strong>911100200</strong>:</p>
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
