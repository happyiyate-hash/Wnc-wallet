
/**
 * WEVINA SERVICE WORKER
 * Version: 1.0.0 (Cache-First Branding Node)
 */

const CACHE_NAME = 'wevina-branding-v1';
const IMAGE_TYPES = ['png', 'jpg', 'jpeg', 'svg', 'webp'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. BRANDING CDN STRATEGY (Cache-First)
  // Intercept all requests to the token logo CDN or storage objects
  const isBrandingRequest = 
    url.pathname.startsWith('/api/cdn/logo/') || 
    url.hostname.includes('supabase.co') && url.pathname.includes('/storage/v1/object/public/token_logos');

  if (isBrandingRequest && event.request.method === 'GET') {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        
        if (cachedResponse) {
          // Revalidate in background (Stale-While-Revalidate)
          fetch(event.request).then((networkResponse) => {
            if (networkResponse.ok) cache.put(event.request, networkResponse);
          }).catch(() => {});
          
          return cachedResponse;
        }

        // Fetch and cache if not found
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse.ok) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        });
      })
    );
  }
});
