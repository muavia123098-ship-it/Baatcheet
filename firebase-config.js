// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAN0NNuReeVE9iOko3HuzelguN5iZd1ovU",
    authDomain: "baatcheet-5f212.firebaseapp.com",
    projectId: "baatcheet-5f212",
    storageBucket: "baatcheet-5f212.firebasestorage.app",
    messagingSenderId: "448231224685",
    appId: "1:448231224685:web:2b82c11dba9c66bd8f9664"
};

// Initialize Firebase
window.firebase = firebase;
firebase.initializeApp(firebaseConfig);
window.auth = firebase.auth();
window.db = firebase.firestore();
window.storage = firebase.storage();
window.provider = new firebase.auth.GoogleAuthProvider();

// Initialize Firebase Cloud Messaging for background push notifications
try {
    window.messaging = firebase.messaging();
} catch (e) {
    console.warn("FCM Messaging not supported:", e.message);
    window.messaging = null;
}

// Register FCM token and save to Firestore
window.registerFCMToken = async function () {
    if (!window.messaging || !window.auth.currentUser) return;
    try {
        // VAPID key from Firebase Console → Project Settings → Cloud Messaging → Web Push Certificates
        const VAPID_KEY = 'BMn_Pkcf7Y_h35lMBJl1erXd72lnfWpQbmrGe7AAyOakA26noa1u0w_7AWJ1kNs13pt-AQ0-8dKATbbPEl9ujWc';
        const token = await window.messaging.getToken({ vapidKey: VAPID_KEY });
        if (token) {
            await window.db.collection('users').doc(window.auth.currentUser.uid).update({
                fcmToken: token
            });
            console.log("FCM Token registered:", token.substring(0, 20) + "...");
        }
    } catch (err) {
        console.warn("FCM Token registration failed:", err.message);
    }
};

// Handle foreground FCM messages
if (window.messaging) {
    window.messaging.onMessage((payload) => {
        console.log('[FCM] Foreground message:', payload);
        // App is open, so show a custom in-app notification if needed
        const { title, body } = payload.notification || {};
        if (title && Notification.permission === 'granted') {
            new Notification(title, { body, icon: '/logo.png' });
        }
    });
}

// Global User Data (Initially from localStorage for quick UI load, but verified by Auth)
window.userData = JSON.parse(localStorage.getItem('baatcheet_user'));

// Global check for login (only on app pages, not login.html)
if (!window.userData && !window.location.href.includes('login.html')) {
    window.location.href = 'login.html';
}

// Ensure window.userData is refreshed from Firebase Auth as a source of truth
window.auth.onAuthStateChanged(async (user) => {
    if (user) {
        // Double check Firestore for latest user metadata
        try {
            const userDoc = await window.db.collection('users').doc(user.uid).get();
            if (userDoc.exists) {
                window.userData = userDoc.data();
                localStorage.setItem('baatcheet_user', JSON.stringify(window.userData));
                console.log("Auth State: User logic session active for", window.userData.name);
            }
        } catch (e) {
            console.error("Auth State sync error:", e);
        }
    } else if (!window.location.href.includes('login.html')) {
        console.warn("Auth State: No user found, redirecting...");
        localStorage.removeItem('baatcheet_user');
        window.location.href = 'login.html';
    }
});
