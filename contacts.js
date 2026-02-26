// Logic to add contacts by Baatcheet Number with validation
async function addContactByNumber(number, customName) {
    const userData = window.userData;
    if (number === userData.baatcheetNumber) {
        alert("You cannot add yourself!");
        return;
    }

    try {
        console.log("Searching for user:", number);
        const usersRef = window.db.collection('users');
        const snapshot = await usersRef.where('baatcheetNumber', '==', number).get();

        if (snapshot.empty) {
            alert("Ye number Baatcheet par exist nahi karta! (Number not found)");
            return;
        }

        const targetUser = snapshot.docs[0].data();

        // Check if conversation already exists
        const convId = [userData.uid, targetUser.uid].sort().join('_');
        const convRef = window.db.collection('conversations').doc(convId);
        const convDoc = await convRef.get();

        if (!convDoc.exists) {
            await convRef.set({
                participants: [userData.uid, targetUser.uid],
                participantsData: [
                    { uid: userData.uid, name: userData.name, photoURL: userData.photoURL },
                    { uid: targetUser.uid, name: targetUser.name, photoURL: targetUser.photoURL, nickname: customName }
                ],
                lastMessage: '',
                lastUpdate: window.firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            // Fix for previous bug: If conversation exists but participants are corrupted
            const data = convDoc.data();
            if (!data.participants.includes(userData.uid)) {
                console.log("Fixing corrupted participants array...");
                await convRef.update({
                    participants: [userData.uid, targetUser.uid],
                    participantsData: [
                        { uid: userData.uid, name: userData.name, photoURL: userData.photoURL },
                        { uid: targetUser.uid, name: targetUser.name, photoURL: targetUser.photoURL, nickname: customName }
                    ]
                });
            } else {
                alert("Contact pehle se mojood he!");
                return;
            }
        }

        alert(`Contact ${customName} added successfully!`);
        closeAddContactModal();
    } catch (error) {
        console.error("Error adding contact:", error);
        alert("Failed to add contact: " + error.message);
    }
}

// Modal Toggle Logic
const modal = document.getElementById('add-contact-modal');
const closeBtn = document.getElementById('close-modal');
const saveBtn = document.getElementById('save-contact-btn');
const numberInput = document.getElementById('new-contact-number');
const nameInput = document.getElementById('new-contact-name');

function openAddContactModal() {
    modal.classList.remove('hidden');
    document.getElementById('main-menu').classList.add('hidden');
}

function closeAddContactModal() {
    modal.classList.add('hidden');
    numberInput.value = '';
    nameInput.value = '';
}

closeBtn.onclick = closeAddContactModal;

saveBtn.onclick = () => {
    const num = numberInput.value.trim();
    const name = nameInput.value.trim();

    if (num.length !== 10 || !num.startsWith('0200')) {
        alert("Valid 10-digit number starting with 0200 enter karein.");
        return;
    }

    if (!name) {
        alert("Please enter a name for this contact.");
        return;
    }

    addContactByNumber(num, name);
};

// Menu Logic
document.getElementById('menu-btn').onclick = (e) => {
    e.stopPropagation();
    document.getElementById('main-menu').classList.toggle('hidden');
};

document.getElementById('add-contact-menu').onclick = openAddContactModal;

document.getElementById('logout-menu').onclick = () => {
    localStorage.removeItem('baatcheet_user');
    window.auth.signOut().then(() => {
        window.location.href = 'login.html';
    });
};

document.getElementById('refresh-app-menu').onclick = () => {
    location.reload();
};

document.getElementById('enable-notifications').onclick = () => {
    if (typeof requestNotificationPermission === 'function') {
        requestNotificationPermission();
    }
    document.getElementById('main-menu').classList.add('hidden');
};

const profileModal = document.getElementById('profile-modal');
document.getElementById('profile-menu').onclick = () => {
    if (typeof openProfileModal === 'function') {
        openProfileModal();
    }
    document.getElementById('main-menu').classList.add('hidden');
};

document.getElementById('close-profile-modal').onclick = () => {
    profileModal.classList.add('hidden');
};

// Close menu on click outside
window.onclick = () => {
    document.getElementById('main-menu').classList.add('hidden');
};
