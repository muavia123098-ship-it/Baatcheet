// --- Global State ---
let currentUser = null;
let profileData = null;
let map;
let markers = {};
let watchId = null;
let fbTools = null;

// --- UI Elements ---
const screens = {
    auth: document.getElementById('auth-screen'),
    profile: document.getElementById('profile-screen'),
    success: document.getElementById('success-screen'),
    app: document.getElementById('main-app')
};
const familyOverlay = document.getElementById('family-overlay');

// --- Helper: Get Firebase Tools Safely ---
function getFB() {
    if (window.firebaseTools) return window.firebaseTools;
    return null;
}

// --- Screen Management ---
function showScreen(screenId) {
    Object.values(screens).forEach(s => s?.classList.remove('active'));
    screens[screenId]?.classList.add('active');

    // Show/Hide bottom nav based on screen
    if (screenId === 'app' || screenId === 'main-app') {
        document.body.classList.add('app-active');
    } else {
        document.body.classList.remove('app-active');
    }

    if (window.lucide) lucide.createIcons();

    if (screenId === 'app' && !map) {
        setTimeout(initMap, 100);
        startLocationTracking();
        setupListeners();
    }
}

// --- Auth State ---
function initAuth() {
    const tools = getFB();
    if (!tools) {
        setTimeout(initAuth, 100);
        return;
    }
    fbTools = tools;

    fbTools.onAuthStateChanged(fbTools.auth, (user) => {
        console.log("Auth State Changed:", user ? user.email : "Logged Out");
        if (user) {
            currentUser = user;
            checkUserProfile(user.uid);
        } else {
            showScreen('auth');
            stopLocationTracking();
        }
    });
}

async function handleLogin() {
    console.log("Login button clicked");
    const tools = getFB();
    if (!tools) {
        alert("System loading, please try again in a moment.");
        return;
    }
    try {
        await tools.signInWithPopup(tools.auth, tools.provider);
    } catch (error) {
        console.error("Login Error:", error);
        alert("Login Error: " + error.message);
    }
}

async function checkUserProfile(uid) {
    const tools = getFB();
    try {
        const userDoc = await tools.getDoc(tools.doc(tools.db, "users", uid));
        if (userDoc.exists()) {
            profileData = userDoc.data();
            const displayId = document.getElementById('current-user-id');
            if (displayId) displayId.innerText = "#" + profileData.accountId;
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
    if (!currentUser || !fbTools) return;
    const { db, collection, query, where, onSnapshot, doc, getDoc } = fbTools;

    // 1. Listen for Incoming Requests
    const qRequests = query(collection(db, "requests"), where("toUid", "==", currentUser.uid), where("status", "==", "pending"));
    onSnapshot(qRequests, (snapshot) => {
        const list = document.getElementById('requests-list');
        if (!list) return;
        list.innerHTML = "";
        snapshot.forEach(async (docSnap) => {
            const req = docSnap.data();
            const fromUser = await getDoc(doc(db, "users", req.fromUid));
            const name = fromUser.exists() ? fromUser.data().name : "Unknown Member";

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

    // 2. Listen for Connections
    const qConn = query(collection(db, "connections"), where("members", "array-contains", currentUser.uid));
    onSnapshot(qConn, (snapshot) => {
        const connectedList = document.getElementById('connected-list');
        const mapList = document.getElementById('member-list');
        if (connectedList) connectedList.innerHTML = "";
        if (mapList) mapList.innerHTML = "";

        snapshot.forEach(async (docSnap) => {
            const conn = docSnap.data();
            const otherUid = conn.members.find(id => id !== currentUser.uid);
            const otherUser = await getDoc(doc(db, "users", otherUid));
            if (!otherUser.exists()) return;
            const data = otherUser.data();

            if (connectedList) {
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
            }

            if (mapList) {
                const sheetDiv = document.createElement('div');
                sheetDiv.className = "user-card";
                sheetDiv.innerHTML = `
                    <div class="user-info">
                        <h4>${data.name}</h4>
                        <span id="dist-${otherUid}">Shared their location</span>
                    </div>
                    <button class="primary-btn" style="width:auto" onclick="focusMember('${otherUid}')">Track</button>
                `;
                mapList.appendChild(sheetDiv);
            }

            lucide.createIcons();
            listenToMemberLocation(otherUid, data.name);
        });
    });
}

// --- Actions ---
window.respondRequest = async (reqId, status, fromUid) => {
    const { doc, updateDoc, addDoc, collection, deleteDoc, db } = fbTools;
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
        console.error(e);
    }
};

document.getElementById('search-btn').onclick = async () => {
    const { collection, query, where, getDocs, db } = fbTools;
    const id = document.getElementById('search-member-id').value;
    if (!id) return;

    const q = query(collection(db, "users"), where("accountId", "==", id));
    const querySnapshot = await getDocs(q);

    const resDiv = document.getElementById('search-result');
    if (!querySnapshot.empty) {
        const found = querySnapshot.docs[0].data();
        if (found.uid === currentUser.uid) {
            alert("This is your ID!");
            return;
        }
        window.foundUser = found;
        document.getElementById('found-user-name').innerText = found.name;
        document.getElementById('found-user-id').innerText = "#" + found.accountId;
        resDiv.classList.remove('hidden');
    } else {
        alert("User not found!");
        resDiv.classList.add('hidden');
    }
};

document.getElementById('send-request-btn').onclick = async () => {
    if (!window.foundUser || !currentUser) return;
    const { addDoc, collection, db } = fbTools;
    try {
        await addDoc(collection(db, "requests"), {
            fromUid: currentUser.uid,
            toUid: window.foundUser.uid,
            status: "pending",
            timestamp: new Date().toISOString()
        });
        alert("Request Sent!");
        document.getElementById('search-result').classList.add('hidden');
    } catch (e) {
        alert("Error sending request.");
    }
};

function startLocationTracking() {
    if (!navigator.geolocation) return;
    watchId = navigator.geolocation.watchPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        if (currentUser && fbTools) {
            const { doc, setDoc, db } = fbTools;
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
    const { doc, onSnapshot, db } = fbTools;
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
        familyOverlay?.classList.add('hidden');
    } else {
        alert("Location not available yet.");
    }
};

// --- Utils ---
function generateUniqueID() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function initMap() {
    if (map) return;
    const defaultLocation = [24.8607, 67.0011];
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView(defaultLocation, 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);
}

// --- Event Listeners ---
document.getElementById('profile-form').onsubmit = async (e) => {
    e.preventDefault();
    if (!currentUser || !fbTools) return;
    const { doc, setDoc, db } = fbTools;
    const pData = {
        uid: currentUser.uid,
        name: document.getElementById('p-name').value,
        phone: document.getElementById('p-phone').value,
        address: document.getElementById('p-address').value,
        city: document.getElementById('p-city').value,
        accountId: generateUniqueID(),
        createdAt: new Date().toISOString()
    };
    try {
        await setDoc(doc(db, "users", currentUser.uid), pData);
        profileData = pData;
        const successId = document.getElementById('unique-account-id');
        if (successId) successId.innerText = pData.accountId;
        showScreen('success');
    } catch (err) {
        alert("Save error: " + err.message);
    }
};

document.getElementById('google-login-btn')?.addEventListener('click', handleLogin);
document.getElementById('go-to-map-btn')?.addEventListener('click', () => showScreen('app'));
document.getElementById('copy-id-btn')?.addEventListener('click', () => {
    const id = document.getElementById('unique-account-id').innerText;
    navigator.clipboard.writeText(id);
    alert("Copied!");
});

document.querySelectorAll('.nav-item').forEach(btn => {
    btn.onclick = () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (tab === 'family') familyOverlay?.classList.remove('hidden');
        else familyOverlay?.classList.add('hidden');
    };
});

document.querySelector('.close-modal')?.addEventListener('click', () => {
    familyOverlay?.classList.add('hidden');
    document.querySelector('.nav-item[data-tab="map"]')?.click();
});

// --- Start ---
window.addEventListener('load', () => {
    initAuth();
});
