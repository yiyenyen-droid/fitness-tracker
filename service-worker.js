const CACHE_NAME = 'fitness-tracker-v2';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './exercises.js',
  './storage.js',
  './suggestions.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first：只要能上網就永遠拿最新版本，只有離線時才退回快取版本。
// 這樣之後更新程式碼，使用者下次打開（有網路）就會自動拿到新版，不用手動清除快取。
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
