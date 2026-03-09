/**
 * FireClone Compatibility SDK - v4.0
 * Replicates Firebase v9+ Modular API for easy migration.
 */

const API_BASE = 'http://localhost:3000/api';
const SOCKET_URL = 'http://localhost:3000';

let socket;
let currentProjectId;
let socketReady = false;

function initSocket() {
    if (socket || socketReady) return;
    if (typeof io !== 'undefined') {
        socket = io(SOCKET_URL);
        socket.emit('subscribe', currentProjectId);
        socketReady = true;
    } else {
        const script = document.createElement('script');
        script.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
        script.onload = () => {
            socket = io(SOCKET_URL);
            socket.emit('subscribe', currentProjectId);
            socketReady = true;
        };
        document.head.appendChild(script);
    }
}

export function initializeApp(config) {
    currentProjectId = config.projectId;
    return { config };
}

export function getFirestore(app) {
    initSocket();
    return { apiBase: API_BASE, projectId: currentProjectId };
}

export function collection(db, collectionName) {
    return { _type: 'collection', db, name: collectionName };
}

export function doc(dbOrCol, ...path) {
    let db, collectionName, docId;
    if (dbOrCol._type === 'collection') {
        db = dbOrCol.db;
        collectionName = dbOrCol.name;
        docId = path[0];
    } else {
        db = dbOrCol;
        collectionName = path[0];
        docId = path[1];
    }
    return { _type: 'doc', db, collectionName, id: docId };
}

async function safeFetch(url, options = {}) {
    try {
        const res = await fetch(url, options);
        const text = await res.text();
        try {
            return { ok: res.ok, status: res.status, data: JSON.parse(text) };
        } catch {
            return { ok: false, status: res.status, data: null };
        }
    } catch (err) {
        console.error('Fetch failed:', url, err);
        return { ok: false, status: 0, data: null };
    }
}

export async function addDoc(col, data) {
    const res = await safeFetch(`${col.db.apiBase}/projects/${col.db.projectId}/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionName: col.name, data })
    });
    return res.data || {};
}

export async function getDocs(q) {
    const col = q.col || q;
    const res = await safeFetch(`${col.db.apiBase}/projects/${col.db.projectId}/data/${col.name}`);
    const items = (res.ok && Array.isArray(res.data)) ? res.data : [];
    return {
        forEach: (cb) => items.forEach(item => cb({ id: item._id, data: () => item, exists: () => true })),
        docs: items.map(item => ({ id: item._id, data: () => item, exists: () => true })),
        size: items.length,
        empty: items.length === 0
    };
}

export async function getDoc(docRef) {
    const res = await safeFetch(`${docRef.db.apiBase}/projects/${docRef.db.projectId}/data/${docRef.collectionName}/${docRef.id}`);
    if (!res.ok || !res.data) return { exists: () => false, data: () => null, id: docRef.id };
    return { exists: () => true, id: res.data._id || docRef.id, data: () => res.data };
}

export async function setDoc(docRef, data, options = {}) {
    return updateDoc(docRef, data);
}

export async function updateDoc(docRef, data) {
    const res = await safeFetch(`${docRef.db.apiBase}/projects/${docRef.db.projectId}/data/${docRef.collectionName}/${docRef.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return res.data || {};
}

export async function deleteDoc(docRef) {
    const res = await safeFetch(`${docRef.db.apiBase}/projects/${docRef.db.projectId}/data/${docRef.collectionName}/${docRef.id}`, {
        method: 'DELETE'
    });
    return res.data || {};
}

// Unified onSnapshot — handles both doc refs AND collection refs
export function onSnapshot(ref, callback) {
    if (ref._type === 'doc') {
        const loadDoc = async () => {
            const snap = await getDoc(ref);
            callback(snap);
        };
        loadDoc();
        const listenForUpdates = () => {
            if (socket) {
                socket.on('dataUpdate', (update) => {
                    if (update.collectionName === ref.collectionName) loadDoc();
                });
            } else {
                setTimeout(listenForUpdates, 500);
            }
        };
        listenForUpdates();
    } else {
        const col = ref.col || ref;
        const loadCollection = async () => {
            const snap = await getDocs(col);
            callback(snap);
        };
        loadCollection();
        const listenForUpdates = () => {
            if (socket) {
                socket.on('dataUpdate', (update) => {
                    if (update.collectionName === col.name) loadCollection();
                });
            } else {
                setTimeout(listenForUpdates, 500);
            }
        };
        listenForUpdates();
    }
}

export function increment(value) { return { _type: 'increment', value }; }
export function query(col, ...constraints) { return { _type: 'query', col, constraints }; }
export function orderBy(field, direction) { return { type: 'orderBy', field, direction }; }
export function where(field, operator, value) { return { type: 'where', field, operator, value }; }

// Auth Mock
export function getAuth(app) { return { app }; }
export class GoogleAuthProvider { constructor() { this.params = {}; } setCustomParameters(p) { this.params = p; } }
export async function signInWithPopup() { return { user: { email: 'malikmaaz815@gmail.com', displayName: 'Admin User' } }; }
export async function signOut() { return Promise.resolve(); }
export function onAuthStateChanged(auth, callback) {
    callback({ email: 'malikmaaz815@gmail.com', displayName: 'Admin User', uid: 'mock-uid-123' });
}
