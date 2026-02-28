self.addEventListener('install', (e) => {
    // Force the waiting service worker to become the active service worker
    self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    // Only handle same-origin requests — let external APIs (OneSignal, Firebase, etc.) pass through untouched
    if (url.origin !== self.location.origin) {
        return; // Let browser handle external requests normally
    }

    event.respondWith(
        fetch(event.request).catch((err) => {
            console.warn("[SW] Fetch failed for:", event.request.url, err);
            // Return an empty response instead of letting respondWith fail
            return new Response(null, { status: 404 });
        })
    );
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    // Check for button actions
    if (event.action === 'accept') {
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
                for (var i = 0; i < clientList.length; i++) {
                    var client = clientList[i];
                    if (client.url.includes('index.html') && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow('./index.html');
                }
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
                for (var i = 0; i < clientList.length; i++) {
                    var client = clientList[i];
                    if (client.url.includes('index.html') && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow('./index.html');
                }
            })
        );
    }
});
