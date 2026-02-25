// DOM Elements
const loginStep = document.getElementById('login-step');
const profileStep = document.getElementById('profile-step');
const successStep = document.getElementById('success-step');
const googleLoginBtn = document.getElementById('google-login-btn');
const createAccountBtn = document.getElementById('create-account-btn');
const dpInput = document.getElementById('dp-input');
const avatarPreview = document.getElementById('avatar-preview');
const generatedNumberSpan = document.getElementById('generated-number');
const startChattingBtn = document.getElementById('start-chatting-btn');

let currentUser = null;

// Google Login
googleLoginBtn.onclick = async () => {
    try {
        const result = await auth.signInWithPopup(provider);
        currentUser = result.user;

        // Check if user already exists in Firestore
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
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

// Handle Image Preview
dpInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            avatarPreview.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
};

// Create Account Logic
createAccountBtn.onclick = async () => {
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
        const userData = {
            uid: currentUser.uid,
            name: name,
            bio: bio,
            photoURL: avatarPreview.src, // Base64 for now, ideally upload to Storage
            baatcheetNumber: uniqueNumber,
            email: currentUser.email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('users').doc(currentUser.uid).set(userData);

        localStorage.setItem('baatcheet_user', JSON.stringify(userData));
        generatedNumberSpan.innerText = uniqueNumber;
        showStep(successStep);
    } catch (error) {
        console.error("Failed to save profile", error);
        alert("Error saving profile: " + error.message);
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
