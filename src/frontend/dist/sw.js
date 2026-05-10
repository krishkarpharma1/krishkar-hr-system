/**
 * Krishkar HR System — Service Worker
 *
 * IMPORTANT: The Geolocation API is NOT available in service worker context.
 * Background GPS capture is handled entirely via setInterval in the foreground
 * (see src/hooks/useGps.ts → useBackgroundGpsCapture). The service worker
 * cannot access navigator.geolocation.
 *
 * This file handles PWA caching strategies only.
 */

const CACHE_VERSION = 'v5';
const SHELL_CACHE = `krishkar-shell-${CACHE_VERSION}`;
const STATIC_CACHE = `krishkar-static-${CACHE_VERSION}`;

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/favicon.svg',
];

// Install: precache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      return cache.addAll(APP_SHELL).catch(() => {
        // Non-fatal: shell cache may fail in dev
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches, claim clients, then notify them an update is available
self.addEventListener('activate', (event) => {
  const allowedCaches = [SHELL_CACHE, STATIC_CACHE];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => !allowedCaches.includes(name))
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim()).then(() => {
      // Broadcast SW_UPDATED to all controlled clients so they can show the update popup
      return self.clients.matchAll({ type: 'window' }).then((clients) => {
        for (const client of clients) {
          client.postMessage({ type: 'SW_UPDATED' });
        }
      });
    })
  );
});

/**
 * Message event listener — receives GPS coordinate messages from the main thread.
 *
 * IMPORTANT: The Geolocation API (navigator.geolocation) is NOT available inside
 * a service worker. GPS location is captured exclusively in the main thread by
 * useBackgroundGpsCapture (setInterval, every 3 minutes). These coords are then
 * posted here for potential future background sync use.
 *
 * Supported message types:
 *  - { type: 'GPS_UPDATE', lat, lng, timestamp } — periodic background capture
 *  - { type: 'GPS_CAPTURE', lat, lng, accuracy, timestamp } — legacy/alias
 */
self.addEventListener('message', (event) => {
  if (!event.data || !event.data.type) return;

  // Frontend requests the waiting SW to take control immediately
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (event.data.type === 'GPS_UPDATE' || event.data.type === 'GPS_CAPTURE') {
    // Coordinates sent from the main thread for potential future background sync.
    // Actual backend submission is done directly from the main thread in useGps.ts.
    // Store for future background sync if the Background Sync API becomes available.
    const { lat, lng, accuracy, timestamp } = event.data;
    console.debug('[SW] GPS data received from main thread:', { lat, lng, accuracy, timestamp });

    // Acknowledge receipt if a MessageChannel port was provided
    if (event.ports?.[0]) {
      event.ports[0].postMessage({ type: 'GPS_ACK', lat, lng, timestamp });
    }
  }
});

// Fetch: routing strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Skip API/backend calls — network only
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/call/') ||
    url.hostname.endsWith('.icp0.io') ||
    url.hostname.endsWith('.ic0.app')
  ) {
    return;
  }

  // Static assets (JS, CSS, fonts, images) — cache first
  if (
    /\.(js|css|woff2?|ttf|eot|png|jpg|jpeg|gif|svg|ico|webp)(\?.*)?$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) => {
        return cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            if (response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          }).catch(() => cached || new Response('', { status: 503 }));
        });
      })
    );
    return;
  }

  // HTML navigation — network first, fall back to cached shell
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const cloned = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, cloned));
          }
          return response;
        })
        .catch(() => {
          return caches.match('/index.html').then(
            (cached) => cached || new Response('Offline', { status: 503 })
          );
        })
    );
    return;
  }

  // Default: network first
  event.respondWith(
    fetch(request).catch(() => caches.match(request).then(
      (cached) => cached || new Response('', { status: 503 })
    ))
  );
});
