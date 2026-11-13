const CACHE='rax-tcg-shell-v3';
const SHELL=['./','./index.html','./scanner-core.js','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin||url.pathname.includes('/api/'))return;
 event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(response=>{
  if(response.ok&&response.type==='basic'){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(req,copy));}
  return response;
 }).catch(()=>cached||caches.match('./index.html'))));
});