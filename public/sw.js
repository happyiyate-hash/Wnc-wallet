/**
 * WEVINA SECURE SERVICE WORKER
 * Minimal logic to enable PWA installation eligibility.
 */

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Pass-through for standard network requests
  // Can be extended for balance caching strategies later
});