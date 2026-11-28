// Minimal service worker: lets the site install as an app and show the page shell when offline.
// It never caches /api/* or login pages, so prices and sessions are always live.
const CACHE = 'o24-shell-v2';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  if (u.pathname.startsWith('/api/') || u.pathname === '/login' || u.pathname === '/logout') return;
  e.respondWith(fetch(r).then(res => {
    if (res.ok && res.status === 200 && (r.mode === 'navigate' || u.pathname === '/index.html')) {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put('/', copy));
    }
    return res;
  }).catch(() => caches.match('/').then(m => m || new Response('אין חיבור לאינטרנט', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } }))));
});
