// Protocol AI Engine — Service Worker
//
// Three jobs:
//   1. Offline shell — network-first for navigations, cache-first for static
//      assets, never cache API / auth routes.
//   2. Web Push — display notifications dispatched from /api/push/send.
//   3. Notification clicks — focus or open the app on tap.
//
// Bump CACHE_NAME on every deploy that changes cached assets so old clients
// purge their stale caches on next activation.
const CACHE_NAME = 'protocol-v3';
const STATIC_CACHE = ['/', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never cache API calls or auth routes — they need to be live, and they
  // carry session cookies we shouldn't store in the SW cache.
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/auth')) {
    return;
  }

  // Network-first for HTML pages (get fresh content), fall back to cache
  // when offline. The "/" fallback ensures a deep-link still renders the
  // app shell when the user is in the subway with no connection.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match('/')))
    );
    return;
  }

  // Cache-first for static assets (fonts, images, styles).
  if (request.destination === 'image' || request.destination === 'font' || request.destination === 'style') {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached || fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
      )
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Web Push — receive a push event and display a notification.
// ─────────────────────────────────────────────────────────────────────────────
// Payload shape we expect (sent by /api/push/send when wired):
//   { title: string, body: string, url?: string, tag?: string, icon?: string }
// All fields optional except title; body falls back to a generic line.
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    if (event.data) payload = event.data.json();
  } catch (_) {
    payload = { title: 'Protocol', body: event.data ? event.data.text() : 'Ai o actualizare nouă.' };
  }

  const title = payload.title || 'Protocol';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icon.png',
    badge: payload.badge || '/icon.png',
    tag: payload.tag || 'protocol-default',
    // renotify=true means a second push with the same tag re-vibrates the
    // device; useful for repeated retest reminders.
    renotify: !!payload.renotify,
    data: { url: payload.url || '/dashboard' },
    // Action buttons for retest / streak reminders. The default tap behaviour
    // (focus the app) still works without these.
    actions: payload.actions || undefined,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Focus an existing tab if open; otherwise open a new one at the URL the
// push payload specified. Matches the OS-native expectation for clicked
// notifications.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.endsWith(target) && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
      return undefined;
    })
  );
});
