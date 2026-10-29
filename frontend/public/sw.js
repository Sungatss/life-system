// Service Worker for Lock In
const CACHE_NAME = 'lock-in-v10';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon-32.png',
  '/lock-in-logo.png',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/fonts/LiberationSerif-Regular.ttf',
  '/fonts/LiberationSerif-Bold.ttf',
  '/fonts/LiberationSerif-Italic.ttf',
  '/fonts/LiberationSerif-BoldItalic.ttf',
  '/fonts/AdwaitaSans-Variable.woff2',
  '/art/zen-sakura-header.webp'
];

// Install: pre-cache core static shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// Activate: clean up ALL old caches immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Purging old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Strategy
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. CRITICAL: Never intercept or cache API requests!
  // All /api/ requests must go directly to the live backend server.
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Only handle GET requests for static assets
  if (request.method !== 'GET') {
    return;
  }

  // 2. Navigation / Page requests: Network-first, fallback to cached index.html if offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match('/index.html');
        })
    );
    return;
  }

  // 3. Static Assets (JS, CSS, images): Stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, networkResponse.clone());
          });
        }
        return networkResponse;
      }).catch(() => null);

      return cachedResponse || fetchPromise;
    })
  );
});

self.addEventListener('push', (event) => {
  let payload;
  try { payload = event.data?.json(); } catch { payload = null; }
  if (!payload || typeof payload.title !== 'string' || typeof payload.body !== 'string') return;
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: '/icon-192.png',
    badge: '/favicon-32.png',
    tag: 'daily-reminder',
    data: { url: '/#today' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const url = new URL('/#today', self.location.origin).href;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      await existing.navigate(url);
      return existing.focus();
    }
    return self.clients.openWindow(url);
  })());
});
