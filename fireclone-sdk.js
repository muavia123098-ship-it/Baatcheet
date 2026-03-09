/**
 * FireClone Compatibility SDK
 * Replicates Firebase v9+ Modular API for easy migration.
 */

let socket;
let currentProjectId;
let socketPromise;

export function initializeApp(config) {
    currentProjectId = config.projectId;
    // Load Socket.IO if not present
    if (typeof io === 'undefined' && !socketPromise) {
        socketPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = "https://cdn.socket.io/4.7.2/socket.io.min.js";
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Failed to load Socket.io"));
            document.head.appendChild(script);
        });
    } else if (typeof io !== 'undefined') {
        socketPromise = Promise.resolve();
    }
    return { config };
}

export function getFirestore(app) {
    const apiBase = 'https://malikmuavia-fireclone-backend.hf.space/api';

    // Initialize Socket
    if (!socket && socketPromise) {
        socketPromise.then(() => {
            if (typeof io !== 'undefined') {
                socket = io('https://malikmuavia-fireclone-backend.hf.space');
                socket.emit('subscribe', currentProjectId);
            }
        });
    }

    return { apiBase, projectId: currentProjectId };
}

export function collection(db, collectionName) {
    return { db, name: collectionName };
}

export function doc(dbOrCol, ...path) {
    let collectionName, docId;
    if (dbOrCol.name) {
        collectionName = dbOrCol.name;
        docId = path[0];
    } else {
        collectionName = path[0];
        docId = path[1];
    }
    return { db: dbOrCol.db || dbOrCol, collectionName, id: docId };
}

export async function addDoc(col, data) {
    const res = await fetch(`${col.db.apiBase}/projects/${col.db.projectId}/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionName: col.name, data })
    });
    return res.json();
}

export async function getDocs(q) {
    const col = q.col || q;
    const res = await fetch(`${col.db.apiBase}/projects/${col.db.projectId}/data/${col.name}`);
    const items = await res.json();
    return {
        forEach: (callback) => items.forEach(item => callback({ id: item._id, data: () => item })),
        docs: items.map(item => ({ id: item._id, data: () => item })),
        size: items.length,
        empty: items.length === 0
    };
}

export async function getDoc(docRef) {
    const res = await fetch(`${docRef.db.apiBase}/projects/${docRef.db.projectId}/data/${docRef.collectionName}/${docRef.id}`);
    if (!res.ok) return { exists: () => false };
    const data = await res.json();
    return {
        exists: () => true,
        id: data._id,
        data: () => data
    };
}

export async function setDoc(docRef, data, options = {}) {
    return updateDoc(docRef, data);
}

export async function updateDoc(docRef, data) {
    const res = await fetch(`${docRef.db.apiBase}/projects/${docRef.db.projectId}/data/${docRef.collectionName}/${docRef.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return res.json();
}

export async function deleteDoc(docRef) {
    const res = await fetch(`${docRef.db.apiBase}/projects/${docRef.db.projectId}/data/${docRef.collectionName}/${docRef.id}`, {
        method: 'DELETE'
    });
    return res.json();
}

export function onSnapshot(q, callback) {
    const col = q.col || q;

    // Initial load
    getDocs(col).then(snapshot => callback(snapshot));

    // Listen for updates
    if (socketPromise) {
        socketPromise.then(() => {
            if (typeof io !== 'undefined') {
                if (!socket) {
                    socket = io('https://malikmuavia-fireclone-backend.hf.space');
                    socket.emit('subscribe', currentProjectId);
                }
                socket.on('dataUpdate', (update) => {
                    if (update.collectionName === col.name || update.collectionName === col.collectionName) {
                        getDocs(col).then(snapshot => callback(snapshot));
                    }
                });
            }
        });
    }
}

export function increment(value) {
    return { _type: 'increment', value };
}

export function query(col, ...constraints) {
    return { col, constraints };
}

export function orderBy(field, direction) { return { type: 'orderBy', field, direction }; }
export function where(field, operator, value) { return { type: 'where', field, operator, value }; }

// Auth Mock (Minimal)
export function getAuth(app) { return { app }; }
export function GoogleAuthProvider() { return class { constructor() { this.params = {}; } setCustomParameters(p) { this.params = p; } }; }
export async function signInWithPopup() { return { user: { email: 'malikmaaz815@gmail.com', displayName: 'Admin User' } }; }
export async function signOut() { sessionStorage.removeItem('adminPinVerified'); return Promise.resolve(); }
export function onAuthStateChanged(auth, callback) {
    const mockUser = { email: 'malikmaaz815@gmail.com', displayName: 'Admin User', uid: 'mock-uid-123' };
    callback(mockUser);
}
