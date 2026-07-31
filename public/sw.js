// Minimal service worker: no offline caching yet (that's Phase D polish).
// A registered SW with a fetch handler is what makes the app installable.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Pass-through: no caching strategy in Phase A.
});
