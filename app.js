// Import Firebase tools from window (injected in HTML)
const { db, auth, provider, doc, setDoc, getDoc, signInWithPopup, onAuthStateChanged, onSnapshot, collection, query, where, addDoc, updateDoc, deleteDoc, getDocs } = window.firebaseTools;

// UI Elements
const screens = {
    auth: document.getElementById('auth-screen'),
    profile: document.getElementById('profile-screen'),
    success: document.getElementById('success-screen'),
    app: document.getElementById('main-app')
};

const familyOverlay = document.getElementById('family-overlay');

// Global State
let currentUser = null;
let profileData = null;
let map;
let markers = {}; // Store markers for family members
let watchId = null;

// --- Auth State Observer ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        checkUserProfile(user.uid);
    } else {
        showScreen('auth');
        stopLocationTracking();
    }
});

// --- Screen Management ---
function showScreen(screenId) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenId].classList.add('active');
    if (window.lucide) lucide.createIcons();
    if (screenId === 'app' && !map) {
        setTimeout(initMap, 100);
        startLocationTracking();
        setupListeners();
    }
}

// --- Unique ID Generator ---
function generateUniqueID() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// --- Auth Logic ---
async function handleLogin() {
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Login Error:", error);
        alert("Login failed: " + error.message);
    }
}

async function checkUserProfile(uid) {
    try {
        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc.exists()) {
            profileData = userDoc.data();
            document.getElementById('current-user-id').innerText = "#" + profileData.accountId;
            showScreen('app');
        } else {
            showScreen('profile');
        }
    } catch (error) {
        console.error("Profile Check error:", error);
        showScreen('profile');
    }
}

// --- Real-time Listeners ---
function setupListeners() {
    if (!currentUser) return;

    // 1. Listen for Incoming Requests
    const qRequests = query(collection(db, "requests"), where("toUid", "==", currentUser.uid), where("status", "==", "pending"));
    onSnapshot(qRequests, (snapshot) => {
        const list = document.getElementById('requests-list');
        list.innerHTML = "";
        snapshot.forEach(async (docSnap) => {
            const req = docSnap.data();
            const fromUser = await getDoc(doc(db, "users", req.fromUid));
            const name = fromUser.exists() ? fromUser.data().name : "Unknown";

            const div = document.createElement('div');
            div.className = "user-card glass-card";
            div.innerHTML = `
                <div class="user-info">
                    <h4>${name}</h4>
                    <span>Wants to track you</span>
                </div>
                <div class="req-actions">
                    <button class="btn-accept" onclick="respondRequest('${docSnap.id}', 'accepted', '${req.fromUid}')"><i data-lucide="check"></i></button>
                    <button class="btn-reject" onclick="respondRequest('${docSnap.id}', 'rejected')"><i data-lucide="x"></i></button>
                </div>
            `;
            list.appendChild(div);
            lucide.createIcons();
        });
    });

    // 2. Listen for Connections (Family Members)
    const qConn = query(collection(db, "connections"), where("members", "array-contains", currentUser.uid));
    onSnapshot(qConn, (snapshot) => {
        const connectedList = document.getElementById('connected-list');
        const mapList = document.getElementById('member-list');
        connectedList.innerHTML = "";
        mapList.innerHTML = "";

        // shortcutMembers = []; // Reset tracked members // This line was commented out in the instruction, keeping it commented.

        snapshot.forEach(async (docSnap) => {
            const conn = docSnap.data();
            const otherUid = conn.members.find(id => id !== currentUser.uid);
            const otherUser = await getDoc(doc(db, "users", otherUid));
            if (!otherUser.exists()) return;
            const data = otherUser.data();

            // Add to Family Overlay List
            const div = document.createElement('div');
            div.className = "user-card glass-card";
            div.innerHTML = `
                <div class="user-info">
                    <h4>${data.name}</h4>
                    <span>#${data.accountId}</span>
                </div>
                <button class="icon-btn primary-bg" onclick="focusMember('${otherUid}')"><i data-lucide="map-pin"></i></button>
            `;
            connectedList.appendChild(div);

            // Add to Map Bottom Sheet List
            const sheetDiv = document.createElement('div');
            sheetDiv.className = "user-card";
            sheetDiv.innerHTML = `
                <div class="user-info">
                    <h4>${data.name}</h4>
                    <span id="dist-${otherUid}">Calculating distance...</span>
                </div>
                <button class="primary-btn" style="width:auto" onclick="focusMember('${otherUid}')">Track</button>
            `;
            mapList.appendChild(sheetDiv);

            lucide.createIcons();
            listenToMemberLocation(otherUid, data.name);
        });
    });
}

// --- Connection Actions ---
window.respondRequest = async (reqId, status, fromUid) => {
    try {
        await updateDoc(doc(db, "requests", reqId), { status });
        if (status === 'accepted') {
            await addDoc(collection(db, "connections"), {
                members: [currentUser.uid, fromUid],
                createdAt: new Date().toISOString()
            });
        } else {
            await deleteDoc(doc(db, "requests", reqId));
        }
    } catch (e) {
        alert("Error: " + e.message);
    }
};

let foundUser = null;
document.getElementById('search-btn').onclick = async () => {
    const id = document.getElementById('search-member-id').value;
    const q = query(collection(db, "users"), where("accountId", "==", id));
    // Correction:
    const querySnapshot = await getDocs(q);

    const resDiv = document.getElementById('search-result');
    if (!querySnapshot.empty) {
        foundUser = querySnapshot.docs[0].data();
        if (foundUser.uid === currentUser.uid) {
            alert("This is your own ID!");
            return;
        }
        document.getElementById('found-user-name').innerText = foundUser.name;
        document.getElementById('found-user-id').innerText = "#" + foundUser.accountId;
        resDiv.classList.remove('hidden');
    } else {
        alert("User not found!");
        resDiv.classList.add('hidden');
    }
};

document.getElementById('send-request-btn').onclick = async () => {
    if (!foundUser || !currentUser) return;
    try {
        await addDoc(collection(db, "requests"), {
            fromUid: currentUser.uid,
            toUid: foundUser.uid,
            status: "pending",
            timestamp: new Date().toISOString()
        });
        alert("Request Sent!");
        document.getElementById('search-result').classList.add('hidden');
    } catch (e) {
        alert("Error sending request.");
    }
};

// --- Location Tracking ---
function startLocationTracking() {
    if (!navigator.geolocation) return;
    watchId = navigator.geolocation.watchPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        if (currentUser) {
            await setDoc(doc(db, "locations", currentUser.uid), {
                lat: latitude,
                lng: longitude,
                updatedAt: new Date().toISOString()
            });
        }
        updateMyMarker(latitude, longitude);
    }, (err) => console.error(err), { enableHighAccuracy: true });
}

function stopLocationTracking() {
    if (watchId) navigator.geolocation.clearWatch(watchId);
}

function updateMyMarker(lat, lng) {
    if (!map) return;
    if (!markers['me']) {
        markers['me'] = L.marker([lat, lng], {
            icon: L.divIcon({ className: 'my-location-marker', html: '<div class="pulse"></div>' })
        }).addTo(map);
    } else {
        markers['me'].setLatLng([lat, lng]);
    }
}

function listenToMemberLocation(uid, name) {
    onSnapshot(doc(db, "locations", uid), (docSnap) => {
        if (!docSnap.exists() || !map) return;
        const { lat, lng } = docSnap.data();

        if (!markers[uid]) {
            markers[uid] = L.marker([lat, lng]).addTo(map).bindPopup(name);
        } else {
            markers[uid].setLatLng([lat, lng]);
        }
    });
}

window.focusMember = (uid) => {
    if (markers[uid]) {
        map.setView(markers[uid].getLatLng(), 16);
        markers[uid].openPopup();
        familyOverlay.classList.add('hidden');
    } else {
        alert("Member location not available yet.");
    }
};

// --- Navigation ---
document.querySelectorAll('.nav-item').forEach(btn => {
    btn.onclick = () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        if (tab === 'family') {
            familyOverlay.classList.remove('hidden');
        } else {
            familyOverlay.classList.add('hidden');
        }
    };
});

document.querySelector('.close-modal').onclick = () => {
    familyOverlay.classList.add('hidden');
    document.querySelector('.nav-item[data-tab="map"]').click();
};

// --- Form Handling ---
document.getElementById('profile-form').onsubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const profileData = {
        uid: currentUser.uid,
        name: document.getElementById('p-name').value,
        phone: document.getElementById('p-phone').value,
        address: document.getElementById('p-address').value,
        city: document.getElementById('p-city').value,
        accountId: generateUniqueID(),
        createdAt: new Date().toISOString()
    };

    try {
        await setDoc(doc(db, "users", currentUser.uid), profileData);
        document.getElementById('unique-account-id').innerText = profileData.accountId;
        showScreen('success');
    } catch (error) {
        console.error("Save Profile Error:", error);
        alert("Error saving profile. Please check Firestore rules.");
    }
};

// --- UI Event Listeners ---
document.getElementById('google-login-btn').addEventListener('click', handleLogin);

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
    // marker = L.marker(defaultLocation).addTo(map); // This line is now handled by updateMyMarker
}

document.getElementById('google-login-btn').addEventListener('click', handleLogin);

document.getElementById('go-to-map-btn').addEventListener('click', () => {
    showScreen('app');
});

document.getElementById('copy-id-btn').addEventListener('click', () => {
    const id = document.getElementById('unique-account-id').innerText;
    navigator.clipboard.writeText(id);
    alert("ID Copied: " + id);
});

// Initial Call
window.addEventListener('load', () => {
    if (window.lucide) lucide.createIcons();
});
