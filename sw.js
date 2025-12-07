const CACHE_NAME = "mindscan-cache-v1";
const ASSETS = [
  "/mindscan-/",
  "/mindscan-/index.html",
  "/mindscan-/summary.html",
  "/mindscan-/style.css",
  "/mindscan-/app.js",
  "/mindscan-/summary.js",
  "/mindscan-/icon-192.png",
  "/mindscan-/icon-512.png",
  "/mindscan-/manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
