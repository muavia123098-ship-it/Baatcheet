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

// Global User Data
window.userData = JSON.parse(localStorage.getItem('baatcheet_user'));

// Global check for login (only on app pages, not login.html)
if (!window.userData && !window.location.href.includes('login.html')) {
    window.location.href = 'login.html';
}
