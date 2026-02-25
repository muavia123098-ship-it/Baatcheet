// Logic to add contacts by Baatcheet Number
async function addContactByNumber(number) {
    if (number === userData.baatcheetNumber) {
        alert("You cannot add yourself!");
        return;
    }

    try {
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('baatcheetNumber', '==', number).get();

        if (snapshot.empty) {
            alert("No user found with this number!");
            return;
        }

        const targetUser = snapshot.docs[0].data();

        // Check if conversation already exists
        const convId = [userData.uid, targetUser.uid].sort().join('_');
        const convRef = db.collection('conversations').doc(convId);
        const convDoc = await convRef.get();

        if (!convDoc.exists()) {
            await convRef.set({
                participants: [userData.uid, targetUser.uid],
                participantsData: [
                    { uid: userData.uid, name: userData.name, photoURL: userData.photoURL },
                    { uid: targetUser.uid, name: targetUser.name, photoURL: targetUser.photoURL }
                ],
                lastMessage: '',
                lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        alert(`Contact ${targetUser.name} added!`);
        // The chat list will auto-update due to onSnapshot in app.js
    } catch (error) {
        console.error("Error adding contact:", error);
        alert("Failed to add contact.");
    }
}

// Hook into Search UI if it starts with '0200'
const searchInput = document.getElementById('chat-search');
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const val = searchInput.value.trim();
        if (val.startsWith('0200') && val.length === 10) {
            addContactByNumber(val);
            searchInput.value = '';
        }
    }
});
