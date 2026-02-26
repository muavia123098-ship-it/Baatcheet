// Populate Sidebar Header
// window.userData is provided by firebase-config.js. We use a local shorthand if needed.
(function () {
    const uData = window.userData;
    if (uData) {
        if (document.getElementById('my-name-display')) {
            document.getElementById('my-name-display').innerText = uData.name;
        }
        if (document.getElementById('my-number-display')) {
            document.getElementById('my-number-display').innerText = uData.baatcheetNumber;
        }
    }
})();

let activeChatId = null;
let activeChatData = null;
let chats = [];

// DOM Elements
const chatList = document.getElementById('chat-list');
const chatBody = document.getElementById('chat-body');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const activeChatName = document.getElementById('active-chat-name');
const activeChatImg = document.getElementById('active-chat-img');
const activeChatStatus = document.getElementById('active-chat-status');

// 1. Listen for Conversations (Chat List)
function listenForChats() {
    console.log("Listening for chats for user UID:", userData.uid);
    db.collection('conversations')
        .where('participants', 'array-contains', userData.uid)
        .onSnapshot(snapshot => {
            console.log("Chat Snapshot received. Docs count:", snapshot.docs.length);
            chats = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            renderChatList();
        }, error => {
            console.error("Chat Listener Error:", error);
        });
}

// 2. Render Chat List
function renderChatList(filter = '') {
    console.log("Rendering Chat List. Total chats:", chats.length, "Filter:", filter);
    chatList.innerHTML = '';

    const filteredChats = chats
        .filter(chat => {
            const otherParticipant = getOtherParticipant(chat);
            const nameToSearch = (otherParticipant.nickname || otherParticipant.name || 'Unknown').toLowerCase();
            return nameToSearch.includes(filter.toLowerCase());
        })
        .sort((a, b) => (b.lastUpdate?.seconds || 0) - (a.lastUpdate?.seconds || 0));

    if (filteredChats.length === 0 && chats.length > 0) {
        chatList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary);">No contacts match your search.</div>';
    } else if (chats.length === 0) {
        chatList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary);">Add a contact to start chatting!</div>';
    }

    filteredChats.forEach(chat => {
        const other = getOtherParticipant(chat);
        const div = document.createElement('div');
        div.className = `chat-item ${activeChatId === chat.id ? 'active' : ''}`;
        div.onclick = () => selectChat(chat);

        const time = chat.lastUpdate ? new Date(chat.lastUpdate.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

        div.innerHTML = `
            <div class="chat-item-info">
                <div class="chat-item-top">
                    <span class="chat-item-name">${other.nickname || other.name}</span>
                    <span class="chat-item-time">${time}</span>
                </div>
                <div class="chat-item-msg">${chat.lastMessage || 'Start a conversation'}</div>
            </div>
        `;
        chatList.appendChild(div);
    });
}

// Helper to get the other person in the chat
function getOtherParticipant(chat) {
    if (chat.participantsData && userData) {
        // Find the participant that is NOT me
        const other = chat.participantsData.find(p => p.uid !== userData.uid);
        if (other) {
            return other;
        }
    }
    // If no participant found (e.g. chat with yourself or corrupted data)
    return chat.participantsData ? chat.participantsData[0] : { name: 'Unknown' };
}

// 3. Select Chat
function selectChat(chat) {
    activeChatId = chat.id;
    activeChatData = chat;
    const other = getOtherParticipant(chat);
    activeChatName.innerText = other.nickname || other.name;
    activeChatStatus.innerText = 'Online';

    // Show Chat UI components
    const callBtn = document.getElementById('call-btn');
    if (callBtn) callBtn.style.display = 'block';

    const chatFooter = document.querySelector('.chat-footer');
    if (chatFooter) chatFooter.style.display = 'flex';

    const chatBody = document.getElementById('chat-body');
    if (chatBody) chatBody.classList.remove('hidden');

    // Mobile View Toggle
    document.querySelector('.sidebar').classList.add('hide-mobile');
    document.querySelector('.main-chat').classList.add('show-mobile');

    renderChatList();
    listenForMessages();
    // Mark incoming messages as read when chat is opened
    markMessagesAsRead(chat.id);
}

// Close Chat (Back to contacts or blank state)
function closeChat() {
    activeChatId = null;
    activeChatData = null;

    // Stop message listener
    if (messageListener) {
        messageListener();
        messageListener = null;
    }

    // Reset UI
    activeChatName.innerText = 'Select a chat';
    activeChatStatus.innerText = '';
    chatBody.innerHTML = '';

    const callBtn = document.getElementById('call-btn');
    if (callBtn) callBtn.style.display = 'none';

    const chatFooter = document.querySelector('.chat-footer');
    if (chatFooter) chatFooter.style.display = 'none';

    // Toggle Mobile view back
    document.querySelector('.sidebar').classList.remove('hide-mobile');
    document.querySelector('.main-chat').classList.remove('show-mobile');

    exitSelectionMode();
    renderChatList();
}

// Mark all unread messages from the other person as read
async function markMessagesAsRead(chatId) {
    try {
        const unreadSnap = await db.collection('conversations').doc(chatId)
            .collection('messages')
            .where('senderId', '!=', userData.uid)
            .where('read', '==', false)
            .get();

        const batch = db.batch();
        unreadSnap.docs.forEach(doc => {
            batch.update(doc.ref, { read: true });
        });
        await batch.commit();
    } catch (e) {
        console.warn('markMessagesAsRead error:', e.message);
    }
}

// Back Button Logic (All devices)
document.getElementById('back-btn').onclick = closeChat;

// Notification Permissions
async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        alert("Aapka browser notifications support nahi karta (Not supported).");
        return;
    }

    try {
        // Show current state for debugging
        if (Notification.permission === 'denied') {
            alert("Notifications pehle se Block hain. Browser settings mein ja kar 'Reset Permission' ya 'Allow' karein.");
        }

        const permission = await Notification.requestPermission();

        if (permission === 'granted') {
            alert("Notification Permission: ALLOWED (Shukriya!)");
        } else if (permission === 'denied') {
            alert("Notification Permission: DENIED (Block). Please change in settings.");
        }
    } catch (err) {
        alert("Notification Error: " + err.message);
    }
}

// Profile Editing Logic
// These might be declared in contacts.js, so we use them directly or from window.
(function () {
    const pModal = document.getElementById('profile-modal');
    const eProfileImg = document.getElementById('edit-profile-img');
    const ePhotoUrl = document.getElementById('edit-photo-url');
    const eProfileName = document.getElementById('edit-profile-name');
    const sProfileBtn = document.getElementById('save-profile-btn');

    window.openProfileModal = function () {
        const uData = window.userData;
        if (!uData) return;
        if (eProfileName) eProfileName.value = uData.name || "";
        if (pModal) pModal.classList.remove('hidden');
    };

    window.saveProfile = async function () {
        const uData = window.userData;
        if (!eProfileName || !sProfileBtn) return;
        const newName = eProfileName.value.trim();

        if (!newName) {
            alert("Pehle apna naam enter karein!");
            return;
        }

        try {
            sProfileBtn.innerText = "Saving...";
            sProfileBtn.disabled = true;

            await db.collection('users').doc(uData.uid).update({
                name: newName
            });

            // Update local memory and UI
            uData.name = newName;
            localStorage.setItem('baatcheet_user', JSON.stringify(uData));

            // Update Sidebar Header UI
            const nameDisp = document.getElementById('my-name-display');
            if (nameDisp) nameDisp.innerText = newName;

            alert("Profile updated successfully!");
            if (pModal) pModal.classList.add('hidden');
        } catch (error) {
            console.error("Error updating profile:", error);
            alert("Profile update failed: " + error.message);
        } finally {
            sProfileBtn.innerText = "Save Changes";
            sProfileBtn.disabled = false;
        }
    };

    if (sProfileBtn) {
        sProfileBtn.onclick = window.saveProfile;
    }
})();

// Show Background Notification
function showCallNotification(callerName) {
    if (Notification.permission === 'granted' && document.visibilityState !== 'visible') {
        navigator.serviceWorker.ready.then(registration => {
            registration.showNotification('Baatcheet Incoming Call', {
                body: `${callerName} is calling you...`,
                icon: 'logo.png',
                tag: 'incoming-call',
                renotify: true,
                requireInteraction: true,
                vibrate: [200, 100, 200],
                actions: [
                    { action: 'accept', title: '✅ Accept' },
                    { action: 'decline', title: '❌ Decline' }
                ]
            });
        });
    }
}

// 4. Listen for Messages
let messageListener = null;
function listenForMessages() {
    if (messageListener) messageListener(); // Unsubscribe previous

    messageListener = db.collection('conversations')
        .doc(activeChatId)
        .collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot(snapshot => {
            chatBody.innerHTML = '';
            snapshot.docs.forEach(doc => {
                const msg = doc.data();
                const msgId = doc.id;

                // Skip if deleted for this user
                if (msg.deletedFor && msg.deletedFor.includes(userData.uid)) {
                    return;
                }

                const isSent = msg.senderId === userData.uid;
                const div = document.createElement('div');
                div.id = `msg-${msgId}`;
                div.dataset.id = msgId;

                // --- Interaction Handlers ---
                const handleSelectionInput = (e) => {
                    if (isSelectionMode) {
                        e.preventDefault();
                        toggleMessageSelection(msgId, div);
                    }
                };

                // Desktop Right-Click
                div.oncontextmenu = (e) => {
                    e.preventDefault();
                    if (!isSelectionMode) {
                        enterSelectionMode(msgId, div);
                    }
                };

                // Mobile Long-Press
                div.ontouchstart = (e) => {
                    if (isSelectionMode) return;
                    longPressTimeout = setTimeout(() => {
                        enterSelectionMode(msgId, div);
                    }, 600);
                };

                div.ontouchend = () => clearTimeout(longPressTimeout);
                div.ontouchmove = () => clearTimeout(longPressTimeout);

                // Regular Click
                div.onclick = (e) => {
                    if (isSelectionMode) {
                        handleSelectionInput(e);
                    }
                };

                // Special rendering for Call Logs
                if (msg.type === 'call') {
                    div.className = `message call-log ${msg.callType || ''}`;
                    const iconClass = msg.callType === 'missed' ? 'fa-phone-slash' : 'fa-phone';
                    div.innerHTML = `<i class="fas ${iconClass}"></i> ${msg.text}`;
                    chatBody.appendChild(div);
                    return;
                }

                // Special rendering for Voice Messages
                if (msg.type === 'audio') {
                    div.className = `message ${isSent ? 'sent' : 'received'} audio-msg`;
                    const timeStr = msg.timestamp
                        ? new Date(msg.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '...';

                    let tickHtml = '';
                    if (isSent) {
                        tickHtml = msg.read
                            ? '<i class="fas fa-check-double" style="color:#53bdeb;margin-left:5px;"></i>'
                            : '<i class="fas fa-check" style="color:#8696a0;margin-left:5px;"></i>';
                    }

                    div.innerHTML = `
                        <div class="audio-player">
                            <i class="fas fa-play play-btn" onclick="this.nextElementSibling.paused ? (this.nextElementSibling.play(), this.classList.replace('fa-play', 'fa-pause')) : (this.nextElementSibling.pause(), this.classList.replace('fa-pause', 'fa-play'))"></i>
                            <audio src="${msg.audioUrl}" onended="this.previousElementSibling.classList.replace('fa-pause', 'fa-play')"></audio>
                            <div class="audio-waveform">
                                <div class="mic-icon-circle">
                                    <i class="fas fa-microphone"></i>
                                </div>
                                <div class="audio-dummy-bar"></div>
                            </div>
                        </div>
                        <div class="msg-time">${timeStr}${tickHtml}</div>
                    `;
                    chatBody.appendChild(div);
                    return;
                }

                div.className = `message ${isSent ? 'sent' : 'received'}`;

                const timeStr = msg.timestamp
                    ? new Date(msg.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '...';

                // Tick logic:
                //   No tick        = received message (not mine)
                //   Single grey ✓  = sent, not yet read
                //   Double blue ✓✓ = sent & read by recipient
                let tickHtml = '';
                if (isSent) {
                    if (msg.read) {
                        tickHtml = '<i class="fas fa-check-double" style="color:#53bdeb;margin-left:5px;"></i>';
                    } else {
                        tickHtml = '<i class="fas fa-check" style="color:#8696a0;margin-left:5px;"></i>';
                    }
                }

                div.innerHTML = `
                    ${msg.text}
                    <div class="msg-time">${timeStr}${tickHtml}</div>
                `;
                chatBody.appendChild(div);
            });
            chatBody.scrollTop = chatBody.scrollHeight;

            // Auto-mark incoming as read while the chat is open
            markMessagesAsRead(activeChatId);
        });
}

// 5. Send Message
async function sendMessage() {
    const text = messageInput.value.trim();
    if (text && activeChatId) {
        messageInput.value = '';
        updateSendBtnIcon();

        const timestamp = firebase.firestore.FieldValue.serverTimestamp();

        // Add message to subcollection (read:false by default)
        await db.collection('conversations').doc(activeChatId).collection('messages').add({
            text: text,
            senderId: userData.uid,
            timestamp: timestamp,
            read: false
        });

        // Update conversation metadata
        await db.collection('conversations').doc(activeChatId).update({
            lastMessage: text,
            lastUpdate: timestamp
        });
    }
}

// UI Handlers
function updateSendBtnIcon() {
    if (messageInput.value.trim() !== '') {
        sendBtn.className = 'fas fa-paper-plane footer-btn send-btn';
    } else {
        sendBtn.className = 'fas fa-microphone footer-btn';
    }
}

// Emoji Picker Logic
const emojiBtn = document.getElementById('emoji-btn');
const emojiPicker = document.getElementById('emoji-picker');

if (emojiBtn && emojiPicker) {
    emojiBtn.onclick = (e) => {
        e.stopPropagation();
        emojiPicker.classList.toggle('hidden');
    };

    // Close picker when clicking outside
    document.addEventListener('click', (e) => {
        if (!emojiPicker.contains(e.target) && e.target !== emojiBtn) {
            emojiPicker.classList.add('hidden');
        }
    });

    // Handle emoji click
    const emojis = document.querySelectorAll('.emoji');
    emojis.forEach(emoji => {
        emoji.onclick = () => {
            messageInput.value += emoji.innerText;
            updateSendBtnIcon(); // Update send button state
            messageInput.focus();
        };
    });
}

// --- Voice Recording Logic ---
// We use window.currentUser if defined in auth.js
const recordingOverlay = document.getElementById('recording-overlay');
const recordingTimer = document.getElementById('recording-timer');
let mediaRecorder = null;
let audioChunks = [];
let recordingTimerInterval = null;
let recordedAudioBlob = null;
let recordingStartTime = 0;

// --- Selection Mode Logic ---
let isSelectionMode = false;
let selectedMessages = new Set(); // Stores message IDs
let longPressTimeout = null;
const stopRecordingBtn = document.getElementById('stop-recording-btn');
const deleteRecordingBtn = document.getElementById('delete-recording-btn');
const sendRecordingBtn = document.getElementById('send-recording-btn');

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
            recordedAudioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            stream.getTracks().forEach(track => track.stop());

            // Show Send, Hide Stop
            stopRecordingBtn.classList.add('hidden');
            sendRecordingBtn.classList.remove('hidden');
        };

        mediaRecorder.start();
        recordingStartTime = Date.now();
        startTimer();

        recordingOverlay.classList.remove('hidden');
        stopRecordingBtn.classList.remove('hidden');
        sendRecordingBtn.classList.add('hidden');
    } catch (err) {
        console.error("Microphone access denied:", err);
        alert("Microphone access chahiye recording ke liye!");
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        stopTimer();
    }
}

function cancelRecording() {
    stopRecording();
    recordingOverlay.classList.add('hidden');
    recordedAudioBlob = null;
    audioChunks = [];
}

async function uploadAndSendAudio() {
    if (!recordedAudioBlob || !activeChatId) return;

    try {
        sendRecordingBtn.classList.add('fa-spinner', 'fa-spin');
        sendRecordingBtn.classList.remove('fa-paper-plane');

        const fileName = `audio_${Date.now()}.webm`;
        const storageRef = storage.ref(`audio_notes/${activeChatId}/${fileName}`);

        await storageRef.put(recordedAudioBlob);
        const downloadURL = await storageRef.getDownloadURL();

        const timestamp = firebase.firestore.FieldValue.serverTimestamp();

        // Save as audio type message
        await db.collection('conversations').doc(activeChatId).collection('messages').add({
            type: 'audio',
            audioUrl: downloadURL,
            senderId: userData.uid,
            timestamp: timestamp,
            read: false
        });

        await db.collection('conversations').doc(activeChatId).update({
            lastMessage: '🎤 Voice Message',
            lastUpdate: timestamp
        });

        cancelRecording();
    } catch (err) {
        console.error("Audio upload failed:", err);
        alert("Voice message send nahi ho saka!");
    } finally {
        sendRecordingBtn.classList.remove('fa-spinner', 'fa-spin');
        sendRecordingBtn.classList.add('fa-paper-plane');
    }
}

function startTimer() {
    recordingTimer.innerText = "00:00";
    recordingTimerInterval = setInterval(() => {
        const diff = Date.now() - recordingStartTime;
        const mins = Math.floor(diff / 60000).toString().padStart(2, '0');
        const secs = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        recordingTimer.innerText = `${mins}:${secs}`;
    }, 1000);
}

function stopTimer() {
    clearInterval(recordingTimerInterval);
}

// Attach Voice Event Handlers
stopRecordingBtn.onclick = stopRecording;
deleteRecordingBtn.onclick = cancelRecording;
sendRecordingBtn.onclick = uploadAndSendAudio;

// --- Message Selection & Deletion Functions ---
const selectionHeader = document.getElementById('selection-header');
const selectionCountSpan = document.getElementById('selection-count');
const deleteSelectedBtn = document.getElementById('delete-selected-btn');
const cancelSelectionBtn = document.getElementById('cancel-selection-btn');

// Delete Modal Elements
const deleteConfirmModal = document.getElementById('delete-confirm-modal');
const deleteModalText = document.getElementById('delete-modal-text');
const deleteForEveryoneBtn = document.getElementById('delete-for-everyone-btn');
const deleteForMeBtn = document.getElementById('delete-for-me-btn');
const cancelDeleteBtn = document.getElementById('cancel-delete-btn');

function enterSelectionMode(msgId, element) {
    isSelectionMode = true;
    selectionHeader.classList.remove('hidden');
    toggleMessageSelection(msgId, element);
}

function toggleMessageSelection(msgId, element) {
    if (selectedMessages.has(msgId)) {
        selectedMessages.delete(msgId);
        element.classList.remove('selected');
    } else {
        selectedMessages.add(msgId);
        element.classList.add('selected');
    }

    const count = selectedMessages.size;
    if (count === 0) {
        exitSelectionMode();
    } else {
        selectionCountSpan.innerText = count;
    }
}

function exitSelectionMode() {
    isSelectionMode = false;
    selectedMessages.clear();
    selectionHeader.classList.add('hidden');
    // Remove highlight from all messages
    document.querySelectorAll('.message.selected').forEach(el => el.classList.remove('selected'));
}

function showDeleteModal() {
    if (selectedMessages.size === 0) return;

    deleteModalText.innerText = selectedMessages.size === 1
        ? "Delete message?"
        : `Delete ${selectedMessages.size} messages?`;

    // WhatsApp logic: only show "Delete for everyone" if all selected messages were sent by the user
    let allMine = true;
    selectedMessages.forEach(msgId => {
        const msgDiv = document.getElementById(`msg-${msgId}`);
        if (msgDiv && msgDiv.classList.contains('received')) {
            allMine = false;
        }
    });

    if (allMine) {
        deleteForEveryoneBtn.classList.remove('hidden');
    } else {
        deleteForEveryoneBtn.classList.add('hidden');
    }

    deleteConfirmModal.classList.remove('hidden');
}

async function confirmDeleteForMe() {
    if (!activeChatId) return;
    try {
        const batch = db.batch();
        const convRef = db.collection('conversations').doc(activeChatId).collection('messages');

        selectedMessages.forEach(msgId => {
            batch.update(convRef.doc(msgId), {
                deletedFor: firebase.firestore.FieldValue.arrayUnion(userData.uid)
            });
        });

        await batch.commit();
        closeDeleteModal();
        exitSelectionMode();
    } catch (err) {
        console.error("Delete for me failed:", err);
        alert("Delete nahi ho saka!");
    }
}

async function confirmDeleteForEveryone() {
    if (!activeChatId) return;
    try {
        const batch = db.batch();
        const convRef = db.collection('conversations').doc(activeChatId).collection('messages');

        selectedMessages.forEach(msgId => {
            // Option A: Genuine Delete
            batch.delete(convRef.doc(msgId));

            // Option B: Mark as deleted (like WhatsApp)
            // batch.update(convRef.doc(msgId), {
            //     type: 'deleted',
            //     text: '🚫 This message was deleted',
            //     deletedAt: firebase.firestore.FieldValue.serverTimestamp()
            // });
        });

        await batch.commit();
        closeDeleteModal();
        exitSelectionMode();
    } catch (err) {
        console.error("Delete for everyone failed:", err);
        alert("Delete for everyone nakam raha!");
    }
}

function closeDeleteModal() {
    deleteConfirmModal.classList.add('hidden');
}

cancelSelectionBtn.onclick = exitSelectionMode;
deleteSelectedBtn.onclick = showDeleteModal;
cancelDeleteBtn.onclick = closeDeleteModal;
deleteForMeBtn.onclick = confirmDeleteForMe;
deleteForEveryoneBtn.onclick = confirmDeleteForEveryone;

// Exit on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isSelectionMode) {
        exitSelectionMode();
    }
});

messageInput.oninput = updateSendBtnIcon;
messageInput.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };
sendBtn.onclick = () => {
    if (sendBtn.classList.contains('fa-paper-plane')) {
        sendMessage();
    } else if (sendBtn.classList.contains('fa-microphone')) {
        startRecording();
    }
};

document.getElementById('chat-search').oninput = (e) => renderChatList(e.target.value);

// Listen for Service Worker messages (e.g., from Notification actions)
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'DECLINE_CALL') {
            if (typeof endCall === 'function') {
                endCall();
            }
        }
    });
}

// Start
listenForChats();
listenForCalls();

// Attach the call event
const mainCallBtn = document.getElementById('call-btn');
if (mainCallBtn) {
    mainCallBtn.onclick = () => {
        if (activeChatData) {
            const other = getOtherParticipant(activeChatData);
            if (other && other.uid) {
                startCall(other.uid);
            }
        }
    };
}
