const CACHE='plp-2026-v19';
const CORE=['./','./index.html','./manifest.json','./stages.js','./supabase-config.js','./app-v18.js','./v18.css','./app-v19.js','./v19.css','./assets/brand-bg.png','./assets/league-logo.png','./assets/app-icon.png','./assets/apple-touch-icon.png','./assets/icon-192.png','./assets/icon-512.png'];

self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)));
});

self.addEventListener('activate',e=>{
  e.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))),
    self.clients.claim()
  ]));
});

self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.mode==='navigate'){
    e.respondWith(fetch(req).then(r=>{
      const c=r.clone();
      caches.open(CACHE).then(cache=>cache.put('./index.html',c));
      return r;
    }).catch(()=>caches.match('./index.html')));
    return;
  }

  const url=new URL(req.url);
  const isAppAsset=url.origin===self.location.origin && /\.(?:js|css|json)$/i.test(url.pathname);
  if(isAppAsset){
    e.respondWith(fetch(req).then(r=>{
      const c=r.clone();
      caches.open(CACHE).then(cache=>cache.put(req,c));
      return r;
    }).catch(()=>caches.match(req)));
    return;
  }

  e.respondWith(caches.match(req).then(r=>r||fetch(req).then(net=>{
    if(req.method==='GET' && net.ok){
      const c=net.clone();
      caches.open(CACHE).then(cache=>cache.put(req,c));
    }
    return net;
  })));
});

self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const c of list){if('focus' in c)return c.focus()}
    return clients.openWindow('https://nhoquin.github.io/plp-poker/');
  }));
});
