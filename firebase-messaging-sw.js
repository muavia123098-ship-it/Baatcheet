// Firebase App (the core Firebase SDK)
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyAN0NNuReeVE9iOko3HuzelguN5iZd1ovU",
    authDomain: "baatcheet-5f212.firebaseapp.com",
    projectId: "baatcheet-5f212",
    storageBucket: "baatcheet-5f212.firebasestorage.app",
    messagingSenderId: "448231224685",
    appId: "1:448231224685:web:2b82c11dba9c66bd8f9664"
});

const messaging = firebase.messaging();

// Background message handler (app is closed or in background)
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message:', payload);

    const { title, body, icon, data } = payload.notification || {};
    const notifData = payload.data || {};

    const notificationTitle = title || 'Baatcheet';
    const notificationOptions = {
        body: body || 'New notification',
        icon: icon || '/logo.png',
        badge: '/logo.png',
        tag: notifData.type || 'baatcheet-notification',
        data: notifData,
        vibrate: [200, 100, 200],
        actions: notifData.type === 'call'
            ? [
                { action: 'accept', title: '📞 Accept' },
                { action: 'decline', title: '❌ Decline' }
            ]
            : []
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'decline') {
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
                clientList.forEach(client => client.postMessage({ type: 'DECLINE_CALL' }));
            })
        );
    } else {
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
                if (clientList.length > 0) return clientList[0].focus();
                return clients.openWindow('./index.html');
            })
        );
    }
});
