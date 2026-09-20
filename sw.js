const PLP_BUILD = '48';
const CACHE = `plp-2026-v${PLP_BUILD}`;
const CACHE_PREFIX = 'plp-2026-v';
const PAGE = './index.html';

const SHELL_ASSETS = [
  './',
  PAGE,
  './manifest.json',
  './pwa-update.js',
  './supabase-config.js',
  './stages.js',
  './home-logo-v37.css',
  './home-stable-v35.css',
  './global-background-v36.css',
  './theme-v32.css',
  './v18.css',
  './v19.css',
  './players-v48.css',
  './app-v18.js',
  './app-v19.js',
  './app-v22-fix.js',
  './players-v48.js',
  './clock-v24.js',
  './clock-admin-v24.js',
  './elimination-v25.js',
  './admin-access-v26.js',
  './quick-admin-v27.js',
  './finale-v28.js',
  './stability-v29.js',
  './finance-v30.js',
  './finance-overview-v32.js',
  './finance-ledger-v33.js',
  './assets/plp-logo-v47.png',
  './assets/splash-logo-v47.png',
  './assets/poker-bg-v32.webp',
  './assets/icon-192-v47.png',
  './assets/icon-512-v47.png',
  './assets/icon-maskable-192-v47.png',
  './assets/icon-maskable-512-v47.png',
  './assets/apple-touch-icon-v47.png'
];

async function putIfValid(cache, key, response) {
  if (response && response.ok) await cache.put(key, response.clone());
  return response;
}

self.addEventListener('install', event => {
  // Updates remain waiting until the user taps "Atualizar agora".
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(SHELL_ASSETS.map(async asset => {
      const response = await fetch(asset, { cache: 'reload' });
      await putIfValid(cache, asset, response);
    }));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach(client => client.postMessage({ type: 'PLP_UPDATE_APPLIED', build: PLP_BUILD }));
  })());
});

self.addEventListener('message', event => {
  const type = typeof event.data === 'string' ? event.data : event.data?.type;
  if (type === 'PLP_APPLY_UPDATE' || type === 'SKIP_WAITING') self.skipWaiting();
});

async function networkFirst(request, cacheKey = request) {
  try {
    const response = await fetch(request, { cache: 'no-store' });
    const cache = await caches.open(CACHE);
    await putIfValid(cache, cacheKey, response);
    return response;
  } catch (_) {
    return (await caches.match(cacheKey)) || Response.error();
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, PAGE));
    return;
  }

  if (/\.(?:js|css|json|html|png|webp|jpe?g|svg)$/i.test(url.pathname)) {
    event.respondWith(networkFirst(request));
  }
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const client of list) {
      if ('focus' in client) return client.focus();
    }
    return self.clients.openWindow('https://nhoquin.github.io/plp-poker/');
  }));
});
