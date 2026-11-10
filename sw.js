// Deja la app disponible sin conexión. Sirve primero la copia guardada y la
// renueva en segundo plano: una versión nueva se ve al abrir la app otra vez.
const CACHE = 'mivida-v2';
const SHELL = ['./', 'index.html', 'config.js', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/store.js', 'js/parser.js', 'js/lock.js', 'js/google.js', 'js/notify.js', 'js/timer.js', 'js/demo.js',
  'fonts/geist.woff2', 'fonts/geist-mono.woff2', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Google va directo a la red
  e.respondWith(caches.open(CACHE).then(async cache => {
    const hit = await cache.match(e.request, { ignoreSearch: true });
    const fresh = fetch(e.request).then(res => { if (res.ok) cache.put(e.request, res.clone()); return res; }).catch(() => hit);
    return hit || fresh;
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return self.clients.openWindow('./');
  }));
});
