const CACHE_NAME = 'secure-vault-v1';

self.addEventListener('install', (e) => {
    // Only cache local files — external CDN URLs cause install failure
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll([
            './index.html',
            './manifest.json'
        ]))
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(clients.claim());
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((res) => res || fetch(e.request))
    );
});
