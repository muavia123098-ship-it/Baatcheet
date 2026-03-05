const CACHE_NAME = 'secure-vault-v1';
const ASSETS = [
    './index.html',
    './manifest.json',
    'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((res) => res || fetch(e.request))
    );
});
