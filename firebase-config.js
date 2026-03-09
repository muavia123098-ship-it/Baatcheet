// FireClone Migration: Redirecting Firebase imports to custom SDK
import {
    initializeApp,
    getFirestore,
    collection,
    addDoc,
    getDocs,
    onSnapshot,
    deleteDoc,
    doc,
    query,
    orderBy,
    updateDoc,
    getDoc,
    setDoc,
    where,
    increment
} from "./fireclone-sdk.js";

const firebaseConfig = {
    projectId: "69ad3c60fbc006ad975762e8" // Your FireClone Project ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export {
    db,
    collection,
    addDoc,
    getDocs,
    onSnapshot,
    deleteDoc,
    doc,
    query,
    orderBy,
    updateDoc,
    getDoc,
    setDoc,
    where,
    increment
};
