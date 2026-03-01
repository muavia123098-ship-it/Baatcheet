// Import Firebase tools from window (injected in HTML)
const { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, doc, setDoc, getDoc } = window.firebaseTools;

// UI Elements
const screens = {
    auth: document.getElementById('auth-screen'),
    profile: document.getElementById('profile-screen'),
    success: document.getElementById('success-screen'),
    app: document.getElementById('main-app')
};

// Global State
let currentUser = null;
let map;
let marker;

// --- Screen Management ---
function showScreen(screenId) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenId].classList.add('active');

    // Re-create icons for the new screen
    if (window.lucide) lucide.createIcons();

    // Auto-init map if showing app screen
    if (screenId === 'app' && !map) {
        setTimeout(initMap, 100);
    }
}

// --- Unique ID Generator ---
function generateUniqueID() {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit ID
}

// --- Auth Logic ---
async function handleLogin() {
    // Note: Firebase config must be initialized in index.html for this to work
    alert("Please replace the Firebase Config in index.html to enable Google Login.");

    // For Demo / Development (Mocking the flow)
    console.log("Mocking login flow...");
    currentUser = { uid: "test-user-id", email: "user@example.com" };
    checkUserProfile(currentUser.uid);
}

async function checkUserProfile(uid) {
    // Mocking Firestore check
    const isNewUser = true; // In real app: getDoc from Firestore

    if (isNewUser) {
        showScreen('profile');
    } else {
        showScreen('app');
    }
}

// --- Form Handling ---
document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const profileData = {
        name: document.getElementById('p-name').value,
        phone: document.getElementById('p-phone').value,
        address: document.getElementById('p-address').value,
        city: document.getElementById('p-city').value,
        accountId: generateUniqueID(),
        createdAt: new Date()
    };

    console.log("Saving Profile:", profileData);

    // Show Success
    document.getElementById('unique-account-id').innerText = profileData.accountId;
    showScreen('success');
});

// --- UI Event Listeners ---
document.getElementById('google-login-btn').addEventListener('click', handleLogin);

document.getElementById('go-to-map-btn').addEventListener('click', () => {
    showScreen('app');
});

document.getElementById('copy-id-btn').addEventListener('click', () => {
    const id = document.getElementById('unique-account-id').innerText;
    navigator.clipboard.writeText(id);
    alert("ID Copied: " + id);
});

// --- Map Logic (Same as before but wrapped) ---
function initMap() {
    if (map) return;

    const defaultLocation = [24.8607, 67.0011];
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView(defaultLocation, 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);
    marker = L.marker(defaultLocation).addTo(map);
}

// Initial Call
window.addEventListener('load', () => {
    if (window.lucide) lucide.createIcons();
});
