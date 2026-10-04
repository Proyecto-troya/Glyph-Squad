// Service worker: toda la app (código, modelo, wasm, audio) queda en caché al
// instalar, y después se sirve sin red. `vite build` rellena la lista y la versión.
const VERSION = "__SW_VERSION__";
const PRECACHE = /*__PRECACHE__*/ [];
const CACHE = `leaf-plate-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== location.origin) return;
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(
      (cached) =>
        cached ||
        fetch(request).catch(() =>
          request.mode === "navigate" ? caches.match("./index.html") : Response.error(),
        ),
    ),
  );
});
