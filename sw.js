// sw.js
const CACHE_NAME = 'goat-offline-cache-v8'; // 🚀 Версія 8!
const ASSETS = [
  '/offline.html',
  '/grass.png'
];

// Під час встановлення ховаємо нашу гру та картинки в кеш
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' })));
    })
  );
  self.skipWaiting();
});

// Під час активації видаляємо ВСІ старі кеші (щоб не було конфліктів)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Перехоплюємо запити
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      // 🛑 ГОЛОВНИЙ ФІКС: ignoreSearch: true змушує ігнорувати "хвости" типу ?t=12345
      return caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse; // Тепер він знайде і віддасть траву!
        }
        // Якщо користувач намагався зайти на якусь сторінку форуму
        if (event.request.mode === 'navigate') {
          return caches.match('/offline.html', { ignoreSearch: true });
        }
      });
    })
  );
});