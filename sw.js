self.addEventListener('install', (e) => {
    // Force the waiting service worker to become the active service worker
    self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
    // Network-first approach or just bypass for a realtime app
    e.respondWith(
        fetch(e.request).catch(() => {
            console.log("Network error, could not fetch " + e.request.url);
        })
    );
});
