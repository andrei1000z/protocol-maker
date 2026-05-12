// Protocol AI Engine — Service Worker
//
// Three jobs:
//   1. Offline shell — network-first for navigations, cache-first for static
//      assets. Auth-gated routes + redirects are NEVER cached so a stale
//      Set-Cookie / 307 chain can't poison the browser later.
//   2. Web Push — display notifications dispatched from /api/push/send.
//   3. Notification clicks — focus or open the app on tap.
//
// Bump CACHE_NAME on every deploy that changes cached assets so old clients
// purge their stale caches on next activation.
const CACHE_NAME = 'protocol-v4';
const STATIC_CACHE = ['/', '/manifest.webmanifest'];

// Routes that depend on session state — never cache, always go live. Listed
// here so we can grow the list without touching the auth-redirect logic.
const AUTH_GATED_PREFIXES = [
  '/dashboard', '/onboarding', '/tracking', '/statistics',
  '/history', '/chat', '/settings',
];

function isAuthGated(pathname) {
  return AUTH_GATED_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_CACHE))
  );
  self.skipWaiting();
});

// Client-triggered fast-forward — SWRegister posts {type: 'SKIP_WAITING'}
// when it sees a waiting worker, so the new SW activates without users
// having to close every tab.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never intercept anything but same-origin GET requests — extensions,
  // analytics beacons, cross-origin POSTs all stay native.
  if (url.origin !== self.location.origin) return;
  if (request.method !== 'GET') return;

  // Never cache API calls or auth-callback routes — they need to be live,
  // and they carry session cookies we shouldn't store in the SW cache.
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/auth')) {
    return;
  }

  // Auth-gated app routes: always pass through to the network. The proxy
  // middleware may 307 → /login depending on session state; caching that
  // response (including its Set-Cookie + stale Location) is what poisoned
  // the browser when sessions expired. Now we never store these.
  if (isAuthGated(url.pathname)) {
    return;
  }

  // Network-first for HTML pages (get fresh content), fall back to cache
  // when offline. The "/" fallback ensures a deep-link still renders the
  // app shell when the user is in the subway with no connection.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache OK, non-redirect, basic responses. opaqueredirect
          // and 3xx responses MUST NOT enter the cache — they can't be
          // followed cleanly when served back, and they can carry stale
          // headers that confuse the browser. This is the main bug fix.
          if (response && response.ok && response.type === 'basic' && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => undefined);
          }
          return response;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match('/')))
    );
    return;
  }

  // Cache-first for static assets (fonts, images, styles). Same guard:
  // only cache plain 200 OK responses.
  if (request.destination === 'image' || request.destination === 'font' || request.destination === 'style') {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached || fetch(request).then((response) => {
          if (response && response.ok && response.type === 'basic' && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => undefined);
          }
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
    renotify: !!payload.renotify,
    data: { url: payload.url || '/dashboard' },
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
