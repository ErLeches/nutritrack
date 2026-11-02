const CACHE='nutritrack-v5.6.5';
const files=['./index.html','./style.css?v=5.6.5','./exercises.js?v=5.6.5','./recipes.js?v=5.6.5','./forms.js?v=5.6.5','./screens.js?v=5.6.5','./app.js?v=5.6.5','./manifest.webmanifest','./icon-192-v55.png','./icon-512-v55.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(files.map(p=>new Request(p,{cache:'reload'})))).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('nutritrack-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return;
 if(e.request.mode==='navigate'){e.respondWith(fetch(e.request,{cache:'no-cache'}).catch(()=>caches.match('./index.html')));return}
 e.respondWith(caches.open(CACHE).then(async c=>(await c.match(e.request))||fetch(e.request)));
});
