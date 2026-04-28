const STATIC_CACHE = 'breedlog-static-v2';
const API_CACHE = 'breedlog-api-v2';
const APP_SHELL_CACHE = 'breedlog-shell-v2';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png'
];

const API_ROUTES = [
  '/api/animals',
  '/api/breeding-events',
  '/api/mating-groups',
  '/api/performance-records',
  '/api/health-records',
  '/api/farm-settings',
  '/api/documents',
  '/api/exported-documents',
  '/api/beta/access',
  '/api/auth/user'
];

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  const validCaches = [STATIC_CACHE, API_CACHE, APP_SHELL_CACHE];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => !validCaches.includes(name))
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // Keep selected data APIs network-first with cached fallback for offline continuity.
  // Sensitive/auth/admin/version endpoints are always network-only.
  if (url.pathname.startsWith('/api/')) {
    const isOfflineCapableApi = API_ROUTES.some((route) => (
      url.pathname === route || url.pathname.startsWith(`${route}/`)
    ));

    if (isOfflineCapableApi) {
      event.respondWith(networkFirstStrategy(request, API_CACHE, true));
    } else {
      event.respondWith(fetch(request));
    }
    return;
  }

  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  if (url.pathname.match(/\.(js|css|woff2?|ttf|eot)$/)) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

async function networkFirstStrategy(request, cacheName = API_CACHE, shouldCache = true) {
  try {
    const networkResponse = await fetch(request);
    if (shouldCache && networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache for:', request.url);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    return new Response(JSON.stringify({ error: 'Offline', offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    console.log('[SW] Cache first failed for:', request.url);
    return new Response('', { status: 408 });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => cachedResponse);

  return cachedResponse || fetchPromise;
}

async function handleNavigationRequest(request) {
  try {
    const networkResponse = await fetch('/index.html', { cache: 'no-store' });
    if (networkResponse.ok) {
      const cache = await caches.open(APP_SHELL_CACHE);
      cache.put('/index.html', networkResponse.clone());
    }
    return networkResponse;
  } catch {
    const appShellCache = await caches.open(APP_SHELL_CACHE);
    const shell = await appShellCache.match('/index.html');
    if (shell) return shell;
    const staticCache = await caches.open(STATIC_CACHE);
    return (await staticCache.match('/')) || new Response('Offline', { status: 503 });
  }
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    console.log('[SW] Background sync triggered');
    event.waitUntil(syncData());
  }
});

async function syncData() {
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({ type: 'SYNC_REQUESTED' });
  });
}
