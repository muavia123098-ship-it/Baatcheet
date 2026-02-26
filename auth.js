// DOM Elements
const loginStep = document.getElementById('login-step');
const profileStep = document.getElementById('profile-step');
const successStep = document.getElementById('success-step');
const googleLoginBtn = document.getElementById('google-login-btn');
const createAccountBtn = document.getElementById('create-account-btn');

const generatedNumberSpan = document.getElementById('generated-number');
const startChattingBtn = document.getElementById('start-chatting-btn');

let currentUser = null;

// Google Login
googleLoginBtn.onclick = async () => {
    if (!window.auth || !window.provider) {
        console.error("Firebase not initialized");
        alert("System initializing... Please wait a second and try again.");
        return;
    }
    try {
        const result = await window.auth.signInWithPopup(window.provider);
        currentUser = result.user;

        // Check if user already exists in Firestore
        const userDoc = await window.db.collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
            // Already has an account, skip profile setup
            localStorage.setItem('baatcheet_user', JSON.stringify(userDoc.data()));
            window.location.href = 'index.html';
        } else {
            showStep(profileStep);
        }
    } catch (error) {
        console.error("Login failed", error);
        alert("Google Login Failed! Error: " + error.message);
    }
};



// Create Account Logic
createAccountBtn.onclick = async () => {
    if (!currentUser) {
        alert("User session not found. Please login again.");
        showStep(loginStep);
        return;
    }

    const name = document.getElementById('user-name').value.trim();
    const bio = document.getElementById('user-bio').value.trim();

    if (!name) {
        alert("Please enter your name");
        return;
    }

    // Generate 10-digit number starting with 0200
    const randomPart = Math.floor(100000 + Math.random() * 900000); // 6 random digits
    const uniqueNumber = `0200${randomPart}`;

    try {
        console.log("Attempting to save user data to Firestore...");



        // Data to be stored in Firestore
        const firestoreUserData = {
            uid: currentUser.uid,
            name: name,
            bio: bio,
            baatcheetNumber: uniqueNumber,
            email: currentUser.email,
            status: 'online',
            lastSeen: window.firebase.firestore.FieldValue.serverTimestamp(),
            createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
        };

        await window.db.collection('users').doc(currentUser.uid).set(firestoreUserData);
        console.log("User data saved successfully!");

        // Data to be stored in localStorage (can be a subset or same as firestoreUserData)
        const localUserData = {
            uid: currentUser.uid,
            name: name,
            bio: bio,
            baatcheetNumber: uniqueNumber,
            email: currentUser.email,
            // photoURL: avatarPreview.src // Removed as per instruction
        };

        localStorage.setItem('baatcheet_user', JSON.stringify(localUserData));
        generatedNumberSpan.innerText = uniqueNumber;
        showStep(successStep);
    } catch (error) {
        console.error("Detailed Error:", error);
        alert("Error saving profile: " + error.message + "\n\nTip: Make sure Firestore Rules are set to 'test mode' or 'allow all' for now.");
    }
};

startChattingBtn.onclick = () => {
    window.location.href = 'index.html';
};

function showStep(stepToShow) {
    [loginStep, profileStep, successStep].forEach(step => {
        step.classList.add('hidden');
    });
    stepToShow.classList.remove('hidden');
}

// Global Presence Logic
function managePresence() {
    const user = window.auth.currentUser;
    if (!user) return;

    const userRef = window.db.collection('users').doc(user.uid);

    // Set online on load
    userRef.update({
        status: 'online',
        lastSeen: window.firebase.firestore.FieldValue.serverTimestamp()
    });

    // Set offline on disconnect
    window.addEventListener('beforeunload', () => {
        userRef.update({
            status: 'offline',
            lastSeen: window.firebase.firestore.FieldValue.serverTimestamp()
        });
    });

    // Handle visibility change (tab background/foreground)
    document.addEventListener('visibilitychange', () => {
        const status = document.visibilityState === 'visible' ? 'online' : 'offline';
        userRef.update({
            status: status,
            lastSeen: window.firebase.firestore.FieldValue.serverTimestamp()
        });
    });
}

// Wait for auth state to manage presence
window.auth.onAuthStateChanged(user => {
    if (user) {
        managePresence();
    }
});
