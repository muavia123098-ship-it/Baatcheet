// Logic to add contacts by Baatcheet Number with validation
async function addContactByNumber(number, customName) {
    // Ensure we have current user data
    const userData = window.userData || JSON.parse(localStorage.getItem('baatcheet_user'));

    if (!userData || !userData.uid) {
        alert("Session expired! Please login again.");
        window.location.href = 'login.html';
        return;
    }

    if (number === userData.baatcheetNumber) {
        alert("Aap khud ko add nahi kar saktay!");
        return;
    }

    try {
        console.log("Step 1: Searching for user in 'users' collection with number:", number);
        const usersRef = window.db.collection('users');
        const snapshot = await usersRef.where('baatcheetNumber', '==', number).get();

        if (snapshot.empty) {
            alert("Ye number Baatcheet par mojood nahi hai!");
            return;
        }

        const targetUser = snapshot.docs[0].data();
        console.log("Step 2: Target user found:", targetUser.name, targetUser.uid);

        // Check if conversation already exists
        const convId = [userData.uid, targetUser.uid].sort().join('_');
        console.log("Step 3: Checking conversation in 'conversations' collection, ID:", convId);
        const convRef = window.db.collection('conversations').doc(convId);

        let convDoc;
        try {
            convDoc = await convRef.get();
        } catch (readError) {
            console.error("Permission error during conversation READ:", readError);
            throw readError;
        }

        if (!convDoc.exists) {
            console.log("Step 4: Creating new conversation...");
            try {
                await convRef.set({
                    participants: [userData.uid, targetUser.uid],
                    participantsData: [
                        { uid: userData.uid, name: userData.name, photoURL: userData.photoURL || '' },
                        { uid: targetUser.uid, name: targetUser.name, photoURL: targetUser.photoURL || '', nickname: customName }
                    ],
                    lastMessage: '',
                    lastUpdate: window.firebase.firestore.FieldValue.serverTimestamp()
                });

                // ALSO save to private contacts list
                await window.db.collection('users').doc(userData.uid).collection('contacts').add({
                    uid: targetUser.uid,
                    name: customName,
                    baatcheetNumber: number
                });
            } catch (createError) {
                console.error("Permission error during conversation CREATE:", createError);
                throw createError;
            }
        } else {
            const data = convDoc.data();
            console.log("Step 4: Conversation exists. Checking participants...");
            if (!data.participants.includes(userData.uid)) {
                console.log("Updating participants array...");
                try {
                    await convRef.update({
                        participants: [userData.uid, targetUser.uid],
                        participantsData: [
                            { uid: userData.uid, name: userData.name, photoURL: userData.photoURL || '' },
                            { uid: targetUser.uid, name: targetUser.name, photoURL: targetUser.photoURL || '', nickname: customName }
                        ]
                    });

                    // ALSO ensure private contact exists/updated
                    const contactSnap = await window.db.collection('users').doc(userData.uid).collection('contacts')
                        .where('uid', '==', targetUser.uid).get();
                    if (contactSnap.empty) {
                        await window.db.collection('users').doc(userData.uid).collection('contacts').add({
                            uid: targetUser.uid,
                            name: customName,
                            baatcheetNumber: number
                        });
                    }
                } catch (updateError) {
                    console.error("Permission error during conversation UPDATE:", updateError);
                    throw updateError;
                }
            } else {
                alert("Ye contact pehle se mojood hai!");
                return;
            }
        }

        alert(`Contact '${customName}' kamyabi se add ho gaya!`);
        closeAddContactModal();
    } catch (error) {
        console.error("Error adding contact:", error);
        if (error.message.includes("permission")) {
            alert("Permission Error: Please ensure Firestore rules are updated in Firebase Console.");
        } else {
            alert("Failed to add contact: " + error.message);
        }
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
