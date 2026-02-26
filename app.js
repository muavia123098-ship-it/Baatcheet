// ---------------- Initialization & Global State ----------------
let activeChatId = null;
let activeChatData = null;
let chats = [];
let presenceListener = null;
let messageListener = null;

// DOM Cache
let nodes = {};

function initDOMRefs() {
    console.log("initDOMRefs: Mapping elements...");
    nodes = {
        chatList: document.getElementById('chat-list'),
        chatBody: document.getElementById('chat-body'),
        messageInput: document.getElementById('message-input'),
        sendBtn: document.getElementById('send-btn'),
        activeChatName: document.getElementById('active-chat-name'),
        activeChatStatus: document.getElementById('active-chat-status'),
        myNameDisplay: document.getElementById('my-name-display'),
        myNumberDisplay: document.getElementById('my-number-display'),
        backBtn: document.getElementById('back-btn'),
        callBtn: document.getElementById('call-btn'),
        recordingOverlay: document.getElementById('recording-overlay'),
        recordingTimer: document.getElementById('recording-timer'),
        stopRecordingBtn: document.getElementById('stop-recording-btn'),
        deleteRecordingBtn: document.getElementById('delete-recording-btn'),
        sendRecordingBtn: document.getElementById('send-recording-btn'),
        selectionHeader: document.getElementById('selection-header'),
        selectionCount: document.getElementById('selection-count'),
        deleteSelectedBtn: document.getElementById('delete-selected-btn'),
        cancelSelectionBtn: document.getElementById('cancel-selection-btn'),
        deleteConfirmModal: document.getElementById('delete-confirm-modal'),
        deleteModalText: document.getElementById('delete-modal-text'),
        deleteForEveryoneBtn: document.getElementById('delete-for-everyone-btn'),
        deleteForMeBtn: document.getElementById('delete-for-me-btn'),
        cancelDeleteBtn: document.getElementById('cancel-delete-btn'),
        emojiBtn: document.getElementById('emoji-btn'),
        emojiPicker: document.getElementById('emoji-picker')
    };

    // Attach local listeners with high priority
    if (nodes.messageInput) {
        const handleInput = () => {
            updateSendBtnIcon();
        };
        nodes.messageInput.onkeyup = (e) => {
            if (e.key === 'Enter') sendMessage();
            handleInput();
        };
        nodes.messageInput.oninput = handleInput;
        nodes.messageInput.onkeydown = handleInput;
        nodes.messageInput.onpaste = handleInput;
    }
    if (nodes.sendBtn) {
        nodes.sendBtn.onclick = () => {
            if (nodes.sendBtn.classList.contains('fa-paper-plane')) {
                sendMessage();
            } else {
                startRecording();
            }
        };
    }
    if (nodes.backBtn) nodes.backBtn.onclick = closeChat;

    // Call Listener
    if (nodes.callBtn) {
        nodes.callBtn.onclick = () => {
            if (activeChatData) {
                const other = getOtherParticipant(activeChatData);
                if (other && other.uid) startCall(other.uid);
            }
        };
    }

    // Voice Recording Listeners
    if (nodes.chatBody) {
        nodes.chatBody.onclick = (e) => {
            if (!isSelectionMode) return;
            const msgDiv = e.target.closest('.message');
            if (msgDiv && msgDiv.dataset.id) {
                e.preventDefault();
                e.stopPropagation();
                toggleMessageSelection(msgDiv.dataset.id, msgDiv);
            }
        };
    }
    if (nodes.stopRecordingBtn) nodes.stopRecordingBtn.onclick = stopRecording;
    if (nodes.deleteRecordingBtn) nodes.deleteRecordingBtn.onclick = cancelRecording;
    if (nodes.sendRecordingBtn) nodes.sendRecordingBtn.onclick = uploadAndSendAudio;

    // Selection/Delete Listeners
    if (nodes.cancelSelectionBtn) nodes.cancelSelectionBtn.onclick = exitSelectionMode;
    if (nodes.deleteSelectedBtn) nodes.deleteSelectedBtn.onclick = showDeleteModal;
    if (nodes.cancelDeleteBtn) nodes.cancelDeleteBtn.onclick = closeDeleteModal;
    if (nodes.deleteForMeBtn) nodes.deleteForMeBtn.onclick = confirmDeleteForMe;
    if (nodes.deleteForEveryoneBtn) nodes.deleteForEveryoneBtn.onclick = confirmDeleteForEveryone;

    initEmojiPicker();
}

function updateHeaderUI() {
    const uData = window.userData;
    if (uData) {
        if (nodes.myNameDisplay) nodes.myNameDisplay.innerText = uData.name || 'User';
        if (nodes.myNumberDisplay) nodes.myNumberDisplay.innerText = uData.baatcheetNumber || '';
    }
}

// Global Initialization
window.auth.onAuthStateChanged(user => {
    initDOMRefs();
    if (user) {
        console.log("App Init: Auth confirmed for", user.uid);
        // Wait briefly for firestore-config to sync latest window.userData
        setTimeout(() => {
            updateHeaderUI();
            listenForChats(user.uid);
            listenForCalls();
        }, 500);
    } else {
        console.warn("App Init: No user, auth-config should redirect...");
    }
});

// 1. Listen for Conversations (Chat List)
function listenForChats(authUid) {
    const uid = authUid || (window.userData ? window.userData.uid : null);
    if (!uid) {
        console.error("Cannot listen for chats: No user UID found.");
        return;
    }
    console.log("Listening for chats for user UID:", uid);
    window.db.collection('conversations')
        .where('participants', 'array-contains', uid)
        .onSnapshot(snapshot => {
            console.log("Chat Snapshot received. Docs count:", snapshot.docs.length);
            chats = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            console.log("Chats array updated:", chats);
            renderChatList();
        }, error => {
            console.error("Chat Listener Error:", error);
            alert("Chat listener failed: " + error.message);
        });
}

function renderChatList(filter = '') {
    if (!nodes.chatList) return;
    console.log("Rendering Chat List. Total chats:", chats.length, "Filter:", filter);
    nodes.chatList.innerHTML = '';

    const filteredChats = chats
        .filter(chat => {
            const otherParticipant = getOtherParticipant(chat);
            const nameToSearch = (otherParticipant.nickname || otherParticipant.name || 'Unknown').toLowerCase();
            return nameToSearch.includes(filter.toLowerCase());
        })
        .sort((a, b) => (b.lastUpdate?.seconds || 0) - (a.lastUpdate?.seconds || 0));

    if (chats.length === 0) {
        nodes.chatList.innerHTML = `
            <div style="padding: 20px; text-align: center; color: var(--text-secondary);">
                <p>Aapka chat list khaali hai.</p>
                <small style="color:var(--primary-red)">Tip: 'Add Contact' menu se kisi ko add karein.</small>
            </div>`;
        return;
    }

    if (filteredChats.length === 0) {
        nodes.chatList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--primary-red); font-weight: bold;">No contacts match your filter.</div>';
        return;
    }

    filteredChats.forEach(chat => {
        const other = getOtherParticipant(chat);
        const div = document.createElement('div');
        div.className = `chat-item ${activeChatId === chat.id ? 'active' : ''}`;
        div.onclick = () => selectChat(chat);

        const time = chat.lastUpdate ? new Date(chat.lastUpdate.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : '';

        div.innerHTML = `
            <div class="chat-item-info" style="margin-left: 0;">
                <div class="chat-item-top">
                    <span class="chat-item-name">${other.nickname || other.name || 'Unknown'}</span>
                    <span class="chat-item-time">${time}</span>
                </div>
                <div class="chat-item-msg">${chat.lastMessage || 'Start a conversation'}</div>
            </div>
        `;
        nodes.chatList.appendChild(div);
    });
}

// Helper to get the other person in the chat
function getOtherParticipant(chat) {
    const userData = window.userData;
    if (chat && chat.participantsData && userData && userData.uid) {
        // Find the participant that is NOT me
        const other = chat.participantsData.find(p => p.uid !== userData.uid);
        if (other) return other;
    }
    // Fallback logic
    if (chat && chat.participantsData && chat.participantsData.length > 0) {
        return chat.participantsData[0];
    }
    return { name: 'Unknown', photoURL: '' };
}

// 3. Select Chat
function selectChat(chat) {
    const userData = window.userData;
    activeChatId = chat.id;
    activeChatData = chat;

    const other = getOtherParticipant(chat);
    if (nodes.activeChatName) nodes.activeChatName.innerText = other.nickname || other.name;

    // Listen for other person's presence
    listenForOtherPresence(other.uid);

    // Show Chat UI components
    if (nodes.callBtn) nodes.callBtn.style.display = 'block';

    const chatFooter = document.querySelector('.chat-footer');
    if (chatFooter) chatFooter.style.display = 'flex';

    // Hide welcome message or empty state help
    if (nodes.chatBody) {
        nodes.chatBody.classList.remove('hidden');
        nodes.chatBody.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-secondary);">Loading messages...</div>';
    }

    // Mobile View Toggle
    const sidebar = document.querySelector('.sidebar');
    const mainChat = document.querySelector('.main-chat');
    if (sidebar) sidebar.classList.add('hide-mobile');
    if (mainChat) mainChat.classList.add('show-mobile');

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
    if (nodes.activeChatName) nodes.activeChatName.innerText = 'Select a chat';
    if (nodes.activeChatStatus) nodes.activeChatStatus.innerText = '';
    if (nodes.chatBody) nodes.chatBody.innerHTML = '';

    // Unsubscribe presence listener
    if (presenceListener) {
        presenceListener();
        presenceListener = null;
    }

    if (nodes.callBtn) nodes.callBtn.style.display = 'none';

    const chatFooter = document.querySelector('.chat-footer');
    if (chatFooter) chatFooter.style.display = 'none';

    // Toggle Mobile view back
    const sidebar = document.querySelector('.sidebar');
    const mainChat = document.querySelector('.main-chat');
    if (sidebar) sidebar.classList.remove('hide-mobile');
    if (mainChat) mainChat.classList.remove('show-mobile');

    if (typeof exitSelectionMode === 'function') exitSelectionMode();
    renderChatList();
}

// Helper functions for presence
function listenForOtherPresence(otherUid) {
    if (!nodes.activeChatStatus) return;
    if (presenceListener) presenceListener();

    presenceListener = window.db.collection('users').doc(otherUid)
        .onSnapshot(doc => {
            const data = doc.data();
            if (data) {
                if (data.status === 'online') {
                    nodes.activeChatStatus.innerText = 'Online';
                } else if (data.lastSeen) {
                    const lastSeenDate = new Date(data.lastSeen.seconds * 1000);
                    const timeStr = lastSeenDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                    nodes.activeChatStatus.innerText = `Last seen at ${timeStr}`;
                } else {
                    nodes.activeChatStatus.innerText = 'Offline';
                }
            }
        });
}

// Mark all unread messages from the other person as read
async function markMessagesAsRead(chatId) {
    const userData = window.userData;
    try {
        const unreadSnap = await window.db.collection('conversations').doc(chatId)
            .collection('messages')
            .where('senderId', '!=', userData.uid)
            .where('read', '==', false)
            .get();

        const batch = window.db.batch();
        unreadSnap.docs.forEach(doc => {
            batch.update(doc.ref, { read: true });
        });
        await batch.commit();
    } catch (e) {
        console.warn('markMessagesAsRead error:', e.message);
    }
}

window.onload = () => {
    initDOMRefs();
    const searchInput = document.getElementById('chat-search');
    if (searchInput) {
        searchInput.oninput = (e) => renderChatList(e.target.value);
    }
};

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
function listenForMessages() {
    const userData = window.userData;
    if (messageListener) messageListener(); // Unsubscribe previous

    messageListener = window.db.collection('conversations')
        .doc(activeChatId)
        .collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot(snapshot => {
            if (nodes.chatBody) nodes.chatBody.innerHTML = '';
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

                // Regular Click - Handled by delegation now, but we keep this to prevent default if needed
                div.onclick = (e) => {
                    if (isSelectionMode) {
                        e.stopPropagation(); // Prevent duplicate trigger from delegation if handled here
                        // toggleMessageSelection(msgId, div); // Let delegation handle it
                    }
                };

                // Special rendering for Call Logs
                if (msg.type === 'call') {
                    div.className = `message call-log ${msg.callType || ''}`;
                    let iconClass = 'fa-phone';
                    let iconColor = '#8696a0'; // Default Delivered/Outgoing grey

                    if (msg.callType && msg.callType.includes('missed')) {
                        iconClass = 'fa-phone-slash';
                        iconColor = '#f15c6d'; // Missed Red
                    } else if (msg.callType === 'incoming') {
                        iconColor = '#34B7F1'; // Answered Blue
                    } else if (msg.callType === 'outgoing') {
                        iconColor = '#34B7F1'; // Answered Blue
                    }

                    const timeStr = msg.timestamp
                        ? new Date(msg.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
                        : '';
                    const durationStr = msg.duration ? ` (${formatDuration(msg.duration)})` : '';
                    div.innerHTML = `<i class="fas ${iconClass}" style="color:${iconColor}; margin-right:8px;"></i> ${msg.text}${durationStr} <small style="margin-left:8px; opacity:0.6">${timeStr}</small>`;
                    if (nodes.chatBody) nodes.chatBody.appendChild(div);
                    return;
                }

                // Special rendering for Voice Messages
                if (msg.type === 'audio') {
                    div.className = `message ${isSent ? 'sent' : 'received'} audio-msg`;
                    const timeStr = msg.timestamp
                        ? new Date(msg.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
                        : '...';

                    let tickHtml = '';
                    if (isSent) {
                        tickHtml = msg.read
                            ? `<i class="fas fa-check-double" style="color:#34B7F1;margin-left:5px;"></i>`
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
                    if (nodes.chatBody) nodes.chatBody.appendChild(div);
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
                        tickHtml = `<i class="fas fa-check-double" style="color:#34B7F1;margin-left:5px;"></i>`;
                    } else {
                        tickHtml = '<i class="fas fa-check" style="color:#8696a0;margin-left:5px;"></i>';
                    }
                }

                div.innerHTML = `
                    ${msg.text}
                    <div class="msg-time">${timeStr}${tickHtml}</div>
                `;
                if (nodes.chatBody) nodes.chatBody.appendChild(div);
            });
            if (nodes.chatBody) nodes.chatBody.scrollTop = nodes.chatBody.scrollHeight;

            // Auto-mark incoming as read while the chat is open
            markMessagesAsRead(activeChatId);
        });
}

// 5. Send Message
async function sendMessage() {
    console.log("sendMessage: check state...", { activeChatId, hasInput: !!nodes.messageInput });
    if (!activeChatId) {
        console.warn("No active chat selected!");
        return;
    }

    const mInput = nodes.messageInput || document.getElementById('message-input');
    if (!mInput) return;

    const text = mInput.value.trim();
    if (!text) {
        console.log("Empty message, ignoring.");
        return;
    }

    console.log("Sending message text:", text);
    const uData = window.userData;

    // Clear input immediately for responsiveness
    mInput.value = '';
    updateSendBtnIcon();

    try {
        await window.db.collection('conversations').doc(activeChatId).collection('messages').add({
            text: text,
            senderId: uData.uid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            read: false
        });

        await window.db.collection('conversations').doc(activeChatId).update({
            lastMessage: text,
            lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log("Message sent successfully!");
    } catch (e) {
        console.error("Error sending message:", e);
        alert("Pesh aaney wala masla (Sending failed): " + e.message);
    }
}

// UI Handlers
function updateSendBtnIcon() {
    const mInput = nodes.messageInput || document.getElementById('message-input');
    const sBtn = nodes.sendBtn || document.getElementById('send-btn');
    if (!sBtn || !mInput) return;

    if (mInput.value.trim() !== '') {
        sBtn.classList.remove('fa-microphone');
        sBtn.classList.add('fa-paper-plane', 'send-btn');
    } else {
        sBtn.classList.remove('fa-paper-plane', 'send-btn');
        sBtn.classList.add('fa-microphone');
    }
}

// --- Emoji Picker Logic ---
function initEmojiPicker() {
    if (nodes.emojiBtn && nodes.emojiPicker) {
        nodes.emojiBtn.onclick = (e) => {
            e.stopPropagation();
            nodes.emojiPicker.classList.toggle('hidden');
        };

        // Close picker when clicking outside
        document.addEventListener('click', (e) => {
            if (!nodes.emojiPicker.contains(e.target) && e.target !== nodes.emojiBtn) {
                nodes.emojiPicker.classList.add('hidden');
            }
        });

        // Handle emoji click
        const emojis = document.querySelectorAll('.emoji');
        emojis.forEach(emoji => {
            emoji.onclick = () => {
                const mInput = nodes.messageInput || document.getElementById('message-input');
                if (mInput) {
                    mInput.value += emoji.innerText;
                    updateSendBtnIcon();
                    mInput.focus();
                }
            };
        });
    }
}

function formatDuration(seconds) {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
        return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
}

// --- Voice Recording Logic ---
// We use window.currentUser if defined in auth.js
let mediaRecorder = null;
let audioChunks = [];
let recordingTimerInterval = null;
let recordedAudioBlob = null;
let recordingStartTime = 0;

// --- Selection Mode Logic ---
let isSelectionMode = false;
let selectedMessages = new Set(); // Stores message IDs
let longPressTimeout = null;

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
            if (nodes.stopRecordingBtn) nodes.stopRecordingBtn.classList.add('hidden');
            if (nodes.sendRecordingBtn) nodes.sendRecordingBtn.classList.remove('hidden');
        };

        mediaRecorder.start();
        recordingStartTime = Date.now();
        startTimer();

        if (nodes.recordingOverlay) nodes.recordingOverlay.classList.remove('hidden');
        if (nodes.stopRecordingBtn) nodes.stopRecordingBtn.classList.remove('hidden');
        if (nodes.sendRecordingBtn) nodes.sendRecordingBtn.classList.add('hidden');
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
    if (nodes.recordingOverlay) nodes.recordingOverlay.classList.add('hidden');
    recordedAudioBlob = null;
    audioChunks = [];
}

async function uploadAndSendAudio() {
    if (!recordedAudioBlob || !activeChatId) {
        console.warn("Upload aborted: No blob or activeChatId", { recordedAudioBlob, activeChatId });
        return;
    }

    console.log("Starting voice recording upload...", { size: recordedAudioBlob.size, type: recordedAudioBlob.type });

    try {
        if (nodes.sendRecordingBtn) {
            nodes.sendRecordingBtn.classList.add('fa-spinner', 'fa-spin');
            nodes.sendRecordingBtn.classList.remove('fa-paper-plane');
        }

        const fileName = `audio_${Date.now()}.webm`;
        const storageRef = window.storage.ref(`audio_notes/${activeChatId}/${fileName}`);

        console.log("Uploading to storage path:", storageRef.fullPath);
        await storageRef.put(recordedAudioBlob);
        const downloadURL = await storageRef.getDownloadURL();
        console.log("Upload success! URL:", downloadURL);

        const timestamp = window.firebase.firestore.FieldValue.serverTimestamp();

        // Save as audio type message
        await window.db.collection('conversations').doc(activeChatId).collection('messages').add({
            type: 'audio',
            audioUrl: downloadURL,
            senderId: window.userData.uid,
            timestamp: timestamp,
            read: false
        });

        await window.db.collection('conversations').doc(activeChatId).update({
            lastMessage: '🎤 Voice Message',
            lastUpdate: timestamp
        });

        console.log("Firestore update success!");
        cancelRecording();
    } catch (err) {
        console.error("Audio upload failed:", err);
        alert("Voice message send nahi ho saka! (Error: " + err.message + ")");
    } finally {
        if (nodes.sendRecordingBtn) {
            nodes.sendRecordingBtn.classList.remove('fa-spinner', 'fa-spin');
            nodes.sendRecordingBtn.classList.add('fa-paper-plane');
        }
    }
}

function startTimer() {
    if (nodes.recordingTimer) nodes.recordingTimer.innerText = "00:00";
    recordingTimerInterval = setInterval(() => {
        const diff = Date.now() - recordingStartTime;
        const mins = Math.floor(diff / 60000).toString().padStart(2, '0');
        const secs = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        if (nodes.recordingTimer) nodes.recordingTimer.innerText = `${mins}:${secs}`;
    }, 1000);
}

function stopTimer() {
    clearInterval(recordingTimerInterval);
}

// Voice Event Handlers are now in initDOMRefs

// --- Message Selection & Deletion Functions ---
// Elements are now in nodes cache

function enterSelectionMode(msgId, element) {
    isSelectionMode = true;
    document.body.classList.add('selection-active');
    if (nodes.selectionHeader) nodes.selectionHeader.classList.remove('hidden');
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
        if (nodes.selectionCount) nodes.selectionCount.innerText = count;
    }
}

function exitSelectionMode() {
    isSelectionMode = false;
    document.body.classList.remove('selection-active');
    selectedMessages.clear();
    if (nodes.selectionHeader) nodes.selectionHeader.classList.add('hidden');
    // Remove highlight from all messages
    document.querySelectorAll('.message.selected').forEach(el => el.classList.remove('selected'));
}

function showDeleteModal() {
    if (selectedMessages.size === 0) return;

    if (nodes.deleteModalText) {
        nodes.deleteModalText.innerText = selectedMessages.size === 1
            ? "Delete message?"
            : `Delete ${selectedMessages.size} messages?`;
    }

    // WhatsApp logic: only show "Delete for everyone" if all selected messages were sent by the user
    let allMine = true;
    selectedMessages.forEach(msgId => {
        const msgDiv = document.getElementById(`msg-${msgId}`);
        if (msgDiv && msgDiv.classList.contains('received')) {
            allMine = false;
        }
    });

    if (allMine) {
        if (nodes.deleteForEveryoneBtn) nodes.deleteForEveryoneBtn.classList.remove('hidden');
    } else {
        if (nodes.deleteForEveryoneBtn) nodes.deleteForEveryoneBtn.classList.add('hidden');
    }

    if (nodes.deleteConfirmModal) nodes.deleteConfirmModal.classList.remove('hidden');
}

async function confirmDeleteForMe() {
    if (!activeChatId) return;
    try {
        const batch = db.batch();
        const convRef = db.collection('conversations').doc(activeChatId).collection('messages');

        selectedMessages.forEach(msgId => {
            batch.update(convRef.doc(msgId), {
                deletedFor: firebase.firestore.FieldValue.arrayUnion(window.userData.uid)
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
    if (nodes.deleteConfirmModal) nodes.deleteConfirmModal.classList.add('hidden');
}

// Redundant listeners removed (handled in initDOMRefs)

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

// Initializers at the bottom should be careful
// Redundant top-level listenForChats() call as it's handled in onAuthStateChanged

// Redundant mainCallBtn attachment removed (handled in initDOMRefs)
