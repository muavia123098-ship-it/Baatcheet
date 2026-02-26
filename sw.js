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

self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    // Check for button actions
    if (event.action === 'accept') {
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
                if (clientList.length > 0) {
                    return clientList[0].focus();
                }
                return clients.openWindow('./index.html');
            })
        );
    } else if (event.action === 'decline') {
        // Find the Baatcheet client and send a message to trigger endCall()
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
                clientList.forEach(client => {
                    client.postMessage({ type: 'DECLINE_CALL' });
                });
            })
        );
    } else {
        // Normal click on notification body: just focus
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
                if (clientList.length > 0) {
                    return clientList[0].focus();
                }
                return clients.openWindow('./index.html');
            })
        );
    }
});
