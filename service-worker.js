const CACHE_NAME = 'fitness-tracker-v4';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './exercises.js',
  './storage.js',
  './suggestions.js',
  './manifest.json',
  './beep.wav',
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
// 這裡特別用 cache:'no-store' 直接跳過瀏覽器自己的 HTTP 快取，
// 否則瀏覽器可能在我們的程式碼之外，自己偷偷回傳舊版檔案。
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
