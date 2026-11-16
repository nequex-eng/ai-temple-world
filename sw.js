const CACHE="temple-world-shell-99";
const SHELL=[
 "/","/index.html","/style.css?v=20261116-r17",
 "/src/app.js?v=20261116-r17","/src/world.js?v=20261116-r17",
 "/src/network.js?v=20261116-r3","/src/i18n.js?v=20261116-r8",
 "/src/physics.js?v=20261116-r17","/src/vendor/three.module.js",
 "/manifest.webmanifest","/icons/lotus.svg"
];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=="GET"||url.origin!==self.location.origin||url.pathname.startsWith("/api/"))return;
 event.respondWith(fetch(request,{cache:"no-store"}).then(response=>{
  if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));}
  return response;
 }).catch(async()=>await caches.match(request)||await caches.match("/index.html")));
});