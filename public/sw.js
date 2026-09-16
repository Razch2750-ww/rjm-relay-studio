const CACHE="rjm-relay-shell-v1";
const validAsset=url=>url.origin===self.location.origin&&/\.(js|css|woff2?|svg)$/.test(url.pathname)&&!url.pathname.startsWith("/api/");
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(["/","/favicon.svg"])).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("rjm-relay-shell-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("message",event=>{
  if(event.data?.type!=="WARM"||!Array.isArray(event.data.urls))return;
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE),urls=[...new Set(event.data.urls)].slice(0,160).filter(value=>{try{return validAsset(new URL(value,self.location.origin));}catch{return false;}});
    const result=await Promise.allSettled(urls.map(url=>cache.add(url)));
    event.ports[0]?.postMessage({ready:urls.length>0&&result.every(r=>r.status==="fulfilled")});
  })());
});
self.addEventListener("fetch",event=>{
  const req=event.request,url=new URL(req.url);
  if(req.method!=="GET"||url.origin!==self.location.origin||url.pathname.startsWith("/api/")||url.pathname.includes("chatgpt")||url.pathname==="/callback")return;
  if(req.mode==="navigate"&&url.pathname==="/"){
    event.respondWith(fetch(req).then(async response=>{if(response.ok){const cache=await caches.open(CACHE);await cache.put("/",response.clone());return response;}return (await caches.match("/"))||response;}).catch(async()=>await caches.match("/")||new Response("Buka aplikasi sekali saat online untuk menyiapkan mode offline.",{status:503})));
  }else if(validAsset(url))event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(async response=>{if(response.ok){const cache=await caches.open(CACHE);await cache.put(req,response.clone());}return response;})));
});
