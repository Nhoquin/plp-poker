const CACHE='plp-2026-v17';
const CORE=['./','./index.html','./manifest.json','./stages.js','./supabase-config.js','./assets/brand-bg.png','./assets/league-logo.png','./assets/app-icon.png','./assets/apple-touch-icon.png','./assets/icon-192.png','./assets/icon-512.png'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)))});
self.addEventListener('activate',e=>{e.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()]))});
self.addEventListener('fetch',e=>{if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(cache=>cache.put('./index.html',c));return r}).catch(()=>caches.match('./index.html')));return;}e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));});
