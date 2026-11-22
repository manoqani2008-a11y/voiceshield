// Pass-through Service Worker: Hech qanday kesh yo'q, barcha so'rovlar to'g'ridan-to'g'ri serverdan olinadi
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((k) => caches.delete(k)));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // To'g'ridan-to'g'ri tarmoqdan olish
  e.respondWith(fetch(e.request));
});
