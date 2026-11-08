// Keeps the app working without internet. Change VERSION after each update.
const VERSION = "sivani-v4";
const FILES = [
  "./", "index.html", "styles.css", "schema.js", "parser.js", "files.js", "app.js",
  "vendor/html2pdf.bundle.min.js", "vendor/pdf.min.js", "vendor/pdf.worker.min.js", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first, so updates arrive at once. The cache is used when there is no internet.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
