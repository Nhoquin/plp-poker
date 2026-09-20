const CACHE='plp-2026-v45';
const PAGE='./index.html';

// V45: uma nova versão fica aguardando até o usuário aplicar ou todos os clientes
// antigos serem fechados. Isto evita recarregar o aplicativo durante uma partida.
self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil((async()=>{
    try{
      const cache=await caches.open(CACHE);
      const response=await fetch(PAGE,{cache:'reload'});
      if(response.ok) await cache.put(PAGE,response.clone());
    }catch(_){ }
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message',event=>{
  if(event.data==='PLP_APPLY_UPDATE') self.skipWaiting();
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET') return;

  const url=new URL(req.url);
  if(url.origin!==self.location.origin){
    event.respondWith(fetch(req));
    return;
  }

  const isNavigation=req.mode==='navigate';
  const isCode=/\.(?:js|css|json|html)$/i.test(url.pathname);
  const isVersionedAsset=/\/assets\//i.test(url.pathname);

  if(isNavigation || isCode || isVersionedAsset){
    event.respondWith((async()=>{
      try{
        const net=await fetch(req,{cache:'no-store'});
        if(net && net.ok){
          const cache=await caches.open(CACHE);
          await cache.put(isNavigation?PAGE:req,net.clone());
        }
        return net;
      }catch(_){
        return (await caches.match(isNavigation?PAGE:req)) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async()=>{
    const cached=await caches.match(req);
    const refresh=fetch(req).then(async net=>{
      if(net && net.ok){
        const cache=await caches.open(CACHE);
        await cache.put(req,net.clone());
      }
      return net;
    }).catch(()=>null);
    return cached || (await refresh) || Response.error();
  })());
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const client of list){ if('focus' in client) return client.focus(); }
    return self.clients.openWindow('https://nhoquin.github.io/plp-poker/');
  }));
});
