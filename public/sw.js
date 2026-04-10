const CACHE_NAME = "dulce-fresita-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Skip non-GET
  if (request.method !== "GET") return;

  // Skip chrome-extension and other non-http
  if (!request.url.startsWith("http")) return;

  event.respondWith(
    // Stale-while-revalidate: serve cache immediately, update in background
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((response) => {
            if (response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => {
            // Offline — if we have cache, it was already returned
            // If not, return offline fallback for navigation
            if (!cached && request.mode === "navigate") {
              return cache.match("/pos") || new Response("Offline", { status: 503, headers: { "Content-Type": "text/html" } });
            }
            return cached || new Response("Offline", { status: 503 });
          });

        // Return cache immediately if available, otherwise wait for network
        return cached || fetchPromise;
      })
    )
  );
});
