// Оновлений sw.js (Версія 9)
const CACHE_NAME = 'goat-offline-cache-v9'; 

// 🛑 Вказуємо нові шляхи до файлів у папці offline-game
const ASSETS = [
  '/offline-game/offline.html',
  '/offline-game/grass.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' })));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        
        if (event.request.mode === 'navigate') {
          // 🛑 Віддаємо гру з нової папки
          return caches.match('/offline-game/offline.html', { ignoreSearch: true });
        }
      });
    })
  );
});