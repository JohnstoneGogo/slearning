// Service worker: immutable build assets and uploaded images are served from cache, so repeat visits are instant and work on weak networks.
// HTML and API calls always go to the network.
const V = 'sl-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || !(u.pathname.startsWith('/_next/static/') || u.pathname.startsWith('/uploads/') || u.pathname === '/icon.svg')) return;
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { if (r.ok) caches.open(V).then(c => c.put(e.request, r.clone())); return r; })));
});
