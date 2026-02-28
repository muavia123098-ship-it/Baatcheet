// ---------------- Initialization & Global State ----------------
let activeChatId = null;
let activeChatData = null;
let chats = [];
let presenceListener = null;
let typingListener = null;
let messageListener = null;
let typingTimeout = null;
let isCurrentlyTyping = false;
let isSelectionMode = false;
let selectedMessages = new Set();
let contactsMap = new Map(); // Local cache for nicknames
let contactsListener = null;

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
        emojiPicker: document.getElementById('emoji-picker'),
        chatMenuBtn: document.getElementById('chat-menu-btn'),
        chatMenu: document.getElementById('chat-menu'),
        clearChatMenu: document.getElementById('clear-chat-menu'),
        blockContactMenu: document.getElementById('block-contact-menu'),
        contactProfileMenu: document.getElementById('contact-profile-menu'),
        clearChatModal: document.getElementById('clear-chat-modal'),
        blockContactModal: document.getElementById('block-contact-modal'),
        confirmClearChatBtn: document.getElementById('confirm-clear-chat-btn'),
        cancelClearChatBtn: document.getElementById('cancel-clear-chat-btn'),
        confirmBlockBtn: document.getElementById('confirm-block-btn'),
        cancelBlockBtn: document.getElementById('cancel-block-btn'),
        deleteContactMenu: document.getElementById('delete-contact-menu'),
        deleteContactModal: document.getElementById('delete-contact-modal'),
        confirmDeleteContactBtn: document.getElementById('confirm-delete-contact-btn'),
        cancelDeleteContactBtn: document.getElementById('cancel-delete-contact-btn')
    };

    // Attach local listeners with high priority
    if (nodes.messageInput) {
        const handleInput = () => {
            // Typing indicator logic
            if (!isCurrentlyTyping) {
                isCurrentlyTyping = true;
                setTypingStatus(true);
            }

            if (typingTimeout) clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => {
                isCurrentlyTyping = false;
                setTypingStatus(false);
            }, 3000);

            // Update icon
            updateSendBtnIcon();
        };
        nodes.messageInput.onkeyup = (e) => {
            if (e.key === 'Enter') {
                sendMessage();
                isCurrentlyTyping = false;
                setTypingStatus(false);
                if (typingTimeout) clearTimeout(typingTimeout);
            }
            handleInput();
        };
        nodes.messageInput.oninput = handleInput;
        nodes.messageInput.onkeydown = handleInput;
        nodes.messageInput.onpaste = handleInput;
        nodes.messageInput.onblur = () => {
            isCurrentlyTyping = false;
            setTypingStatus(false);
        };
    }
    if (nodes.sendBtn) {
        nodes.sendBtn.onclick = sendMessage;
    }
    if (nodes.backBtn) nodes.backBtn.onclick = closeChat;

    // Call Listener
    if (nodes.callBtn) {
        nodes.callBtn.onclick = () => {
            if (activeChatData) {
                const other = getOtherParticipant(activeChatData);
                if (other && other.uid) startCall(other.uid, false);
            }
        };
    }
    if (document.getElementById('video-call-btn')) {
        document.getElementById('video-call-btn').onclick = () => {
            if (activeChatData) {
                const other = getOtherParticipant(activeChatData);
                if (other && other.uid) startCall(other.uid, true);
            }
        };
    }

    // Voice Recording Listeners (Removed)
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

    // Selection/Delete Listeners
    if (nodes.cancelSelectionBtn) nodes.cancelSelectionBtn.onclick = exitSelectionMode;
    if (nodes.deleteSelectedBtn) nodes.deleteSelectedBtn.onclick = showDeleteModal;
    if (nodes.cancelDeleteBtn) nodes.cancelDeleteBtn.onclick = closeDeleteModal;
    if (nodes.deleteForMeBtn) nodes.deleteForMeBtn.onclick = confirmDeleteForMe;
    if (nodes.deleteForEveryoneBtn) nodes.deleteForEveryoneBtn.onclick = confirmDeleteForEveryone;

    initEmojiPicker();

    // Chat Menu Dropdown Logic
    if (nodes.chatMenuBtn) {
        nodes.chatMenuBtn.onclick = (e) => {
            e.stopPropagation();
            if (nodes.chatMenu) nodes.chatMenu.classList.toggle('hidden');
        };
    }

    // Modal Cancel Listeners
    if (nodes.cancelClearChatBtn) nodes.cancelClearChatBtn.onclick = () => nodes.clearChatModal.classList.add('hidden');
    if (nodes.cancelBlockBtn) nodes.cancelBlockBtn.onclick = () => nodes.blockContactModal.classList.add('hidden');

    // Close menus on click outside
    document.addEventListener('click', () => {
        if (nodes.chatMenu) nodes.chatMenu.classList.add('hidden');
        if (document.getElementById('main-menu')) document.getElementById('main-menu').classList.add('hidden');
    });

    // Chat Actions
    if (nodes.clearChatMenu) nodes.clearChatMenu.onclick = () => {
        nodes.clearChatModal.classList.remove('hidden');
        nodes.chatMenu.classList.add('hidden');
    };
    if (nodes.blockContactMenu) nodes.blockContactMenu.onclick = () => {
        nodes.blockContactModal.classList.remove('hidden');
        nodes.chatMenu.classList.add('hidden');
    };
    if (nodes.contactProfileMenu) nodes.contactProfileMenu.onclick = () => {
        openContactProfile();
        nodes.chatMenu.classList.add('hidden');
    };

    if (nodes.confirmClearChatBtn) nodes.confirmClearChatBtn.onclick = clearChat;
    if (nodes.confirmBlockBtn) nodes.confirmBlockBtn.onclick = confirmBlockContact;

    if (nodes.deleteContactMenu) {
        nodes.deleteContactMenu.onclick = () => {
            if (nodes.deleteContactModal) nodes.deleteContactModal.classList.remove('hidden');
            if (nodes.chatMenu) nodes.chatMenu.classList.add('hidden');
        };
    }
    if (nodes.cancelDeleteContactBtn) {
        nodes.cancelDeleteContactBtn.onclick = () => {
            if (nodes.deleteContactModal) nodes.deleteContactModal.classList.add('hidden');
        };
    }
    if (nodes.confirmDeleteContactBtn) nodes.confirmDeleteContactBtn.onclick = confirmDeleteContact;

}

function updateSendBtnIcon() {
    if (!nodes.messageInput || !nodes.sendBtn) return;
    const icon = nodes.sendBtn.querySelector('i');
    if (!icon) return;

    if (nodes.messageInput.value.trim() !== '') {
        icon.className = 'fas fa-paper-plane';
    } else {
        icon.className = 'fas fa-microphone';
    }
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
            listenForContacts(user.uid); // Sync nicknames
            listenForCalls(user.uid);
            managePresence(); // Start presence management

            // Midnight cleanup check
            checkAndRunDailyCleanup();
            // Check permissions after login
            checkAllPermissions();
            // Check every hour just in case they keep the tab open overnight
            setInterval(checkAndRunDailyCleanup, 60 * 60 * 1000);
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

    // We remove .orderBy to avoid requiring a composite index immediately.
    // Sorting will be done in memory.
    window.db.collection('conversations')
        .where('participants', 'array-contains', uid)
        .onSnapshot(snapshot => {
            console.log("Chat Snapshot received. Docs count:", snapshot.docs.length);
            chats = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Sort in memory by lastUpdate
            chats.sort((a, b) => (b.lastUpdate?.seconds || 0) - (a.lastUpdate?.seconds || 0));

            console.log("Chats array updated and sorted:", chats);

            // Sync activeChatData if the current active chat was updated
            if (activeChatId) {
                const currentChat = chats.find(c => c.id === activeChatId);
                if (currentChat) {
                    activeChatData = currentChat;
                    // Update header UI (for block status etc.)
                    const other = getOtherParticipant(currentChat);
                    if (nodes.activeChatName) nodes.activeChatName.innerText = other.nickname || other.name;

                    // Update menu UI block status
                    const myUid = window.userData ? window.userData.uid : null;
                    if (nodes.blockContactMenu) {
                        if (currentChat.blockedBy && myUid && currentChat.blockedBy[myUid]) {
                            nodes.blockContactMenu.innerText = "Unblock Contact";
                            nodes.blockContactMenu.style.color = "var(--text-primary)";
                        } else {
                            nodes.blockContactMenu.innerText = "Block Contact";
                            nodes.blockContactMenu.style.color = "var(--primary-red)";
                        }
                    }
                }
            }

            renderChatList();
        }, error => {
            console.error("Chat Listener Error:", error);
            if (error.message.includes("index")) {
                console.warn("INDEX ERROR: Please create the index via the link in the console to enable server-side sorting.");
            }
        });
}

function listenForContacts(uid) {
    if (!uid) return;
    if (contactsListener) contactsListener();
    console.log("Listening for private contacts...");
    contactsListener = window.db.collection('users').doc(uid).collection('contacts')
        .onSnapshot(snapshot => {
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.uid) contactsMap.set(data.uid, data);
            });
            console.log("Contacts map synced:", contactsMap.size, "records.");
            renderChatList(); // Re-render to apply nicknames
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

        const unreadKey = `unread_${userData.uid}`;
        const hasUnread = chat[unreadKey] === true;

        // Typing status in list
        const isOtherTyping = chat[`typing_${other.uid}`];
        const lastMsgText = isOtherTyping ? '<span class="typing-indicator-text">Typing...</span>' : (chat.lastMessage || 'Start a conversation');

        div.innerHTML = `
            <div class="chat-item-info" style="margin-left: 0;">
                <div class="chat-item-top">
                    <div>
                        <span class="chat-item-name">${contactsMap.get(other.uid)?.name || other.nickname || other.name || 'Unknown'}</span>
                        ${hasUnread ? '<span class="unread-dot"></span>' : ''}
                    </div>
                    <span class="chat-item-time">${time}</span>
                </div>
                <div class="chat-item-msg">${lastMsgText}</div>
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
    if (document.getElementById('video-call-btn')) document.getElementById('video-call-btn').style.display = 'block';

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
    // Cleanup any already expired messages for this chat
    cleanupExpiredMessages(chat.id);

    // --- Block UI Update ---
    const myUid = window.userData ? window.userData.uid : null;
    if (nodes.blockContactMenu) {
        if (chat.blockedBy && myUid && chat.blockedBy[myUid]) {
            nodes.blockContactMenu.innerText = "Unblock Contact";
            nodes.blockContactMenu.style.color = "var(--text-primary)";
        } else {
            nodes.blockContactMenu.innerText = "Block Contact";
            nodes.blockContactMenu.style.color = "var(--primary-red)";
        }
    }
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
    if (typingListener) {
        typingListener();
        typingListener = null;
    }

    if (nodes.callBtn) nodes.callBtn.style.display = 'none';
    if (document.getElementById('video-call-btn')) document.getElementById('video-call-btn').style.display = 'none';

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
function managePresence() {
    const userData = window.userData;
    if (!userData || !userData.uid) return;

    const userRef = window.db.collection('users').doc(userData.uid);

    const updateStatus = (status) => {
        userRef.update({
            status: status,
            lastSeen: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(err => console.warn("Presence update failed:", err));
    };

    // Set online on load
    updateStatus('online');

    // Heartbeat: Update 'lastSeen' every 1 minute to keep 'Online' active
    const heartbeat = setInterval(() => {
        if (document.visibilityState === 'visible') {
            updateStatus('online');
        }
    }, 60000);

    // Set offline on disconnect (tab close)
    window.addEventListener('beforeunload', () => {
        clearInterval(heartbeat);
        // Note: update might not finish in beforeunload on some browsers
        // so we also rely on visibilitychange and server-side timeouts if we had them.
        updateStatus('offline');
    });

    // Handle visibility change (tab background/foreground)
    document.addEventListener('visibilitychange', () => {
        const isVisible = document.visibilityState === 'visible';
        updateStatus(isVisible ? 'online' : 'offline');
    });
}

function listenForOtherPresence(otherUid) {
    if (!nodes.activeChatStatus) return;
    if (presenceListener) presenceListener();
    if (typingListener) typingListener();

    let lastPresenceText = 'Offline';

    presenceListener = window.db.collection('users').doc(otherUid)
        .onSnapshot(doc => {
            const data = doc.data();
            if (data) {
                if (data.status === 'online') {
                    lastPresenceText = 'Online';
                } else if (data.lastSeen) {
                    const lastSeenDate = new Date(data.lastSeen.seconds * 1000);
                    const timeStr = lastSeenDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                    lastPresenceText = `Last seen at ${timeStr}`;
                } else {
                    lastPresenceText = 'Offline';
                }

                // If not showing typing, update text
                if (nodes.activeChatStatus.innerText !== 'Typing...') {
                    nodes.activeChatStatus.innerText = lastPresenceText;
                }
            }
        });

    typingListener = window.db.collection('conversations').doc(activeChatId)
        .onSnapshot(doc => {
            const data = doc.data();
            if (data && otherUid) {
                const isOtherTyping = data[`typing_${otherUid}`];
                if (isOtherTyping) {
                    nodes.activeChatStatus.innerText = 'Typing...';
                    nodes.activeChatStatus.style.color = '#43c966';
                } else {
                    nodes.activeChatStatus.innerText = lastPresenceText;
                    nodes.activeChatStatus.style.color = 'var(--text-secondary)';
                }
            }
        });
}

function setTypingStatus(isTyping) {
    if (!activeChatId || !window.userData) return;
    window.db.collection('conversations').doc(activeChatId).update({
        [`typing_${window.userData.uid}`]: isTyping
    }).catch(err => console.warn("Typing status update failed:", err));
}

// Mark all unread messages from the other person as read
async function markMessagesAsRead(chatId) {
    const userData = window.userData;
    if (!userData) return;
    try {
        // Inequality filters on multiple fields require an index.
        // We avoid it by only filtering 'read' and checking senderId in JS.
        const unreadSnap = await window.db.collection('conversations').doc(chatId)
            .collection('messages')
            .where('read', '==', false)
            .get();

        const batch = window.db.batch();
        let count = 0;
        const expiryTime = Date.now() + (60 * 60 * 1000); // 1 hour from now

        unreadSnap.docs.forEach(doc => {
            const msg = doc.data();
            // Important: We only mark as read messages sent by others
            if (msg.senderId !== userData.uid) {
                batch.update(doc.ref, {
                    read: true,
                    expiryAt: expiryTime
                });
                count++;
            }
        });

        // Also: Look for messages that ARE read but missing expiryAt (for some reason)
        // This ensures old read messages also get a cleanup timer eventually
        const readMissingExpiry = await window.db.collection('conversations').doc(chatId)
            .collection('messages')
            .where('read', '==', true)
            .get();

        readMissingExpiry.docs.forEach(doc => {
            const msg = doc.data();
            if (!msg.expiryAt) {
                batch.update(doc.ref, { expiryAt: expiryTime });
                count++;
            }
        });

        // Clear unread flag for me
        const convRef = window.db.collection('conversations').doc(chatId);
        batch.update(convRef, { [`unread_${userData.uid}`]: false });

        if (count > 0 || unreadSnap.size > 0) {
            await batch.commit();
            // Schedule a one-time cleanup for exactly 1 hour from now
            // so messages are deleted as soon as they expire
            setTimeout(() => {
                cleanupExpiredMessages(chatId);
            }, 60 * 60 * 1000 + 5000); // 1 hour + 5 sec buffer
            console.log(`markMessagesAsRead: ${count} messages marked. Auto-delete scheduled in 1 hour.`);
        }
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
    const pHeader = pModal ? pModal.querySelector('.modal-header h3') : null;
    const eProfileName = document.getElementById('edit-profile-name');
    const sProfileBtn = document.getElementById('save-profile-btn');
    const cProfileClose = document.getElementById('close-profile-modal');

    // Store context: 'self' or 'contact'
    let profileContext = 'self';
    let currentContact = null;

    window.openProfileModal = function () {
        profileContext = 'self';
        currentContact = null;
        if (pHeader) pHeader.innerText = "Edit Profile";
        const uData = window.userData;
        if (!uData) return;
        if (eProfileName) eProfileName.value = uData.name || "";
        if (pModal) pModal.classList.remove('hidden');
    };

    window.openContactProfileModal = function (contact) {
        profileContext = 'contact';
        currentContact = contact;
        if (pHeader) pHeader.innerText = "Contact Profile";
        if (eProfileName) eProfileName.value = contact.name || "";
        if (pModal) pModal.classList.remove('hidden');
    };

    if (cProfileClose) {
        cProfileClose.onclick = () => {
            if (pModal) pModal.classList.add('hidden');
            profileContext = 'self';
            currentContact = null;
        };
    }

    window.saveProfile = async function () {
        const uData = window.userData;
        if (!eProfileName || !sProfileBtn || !uData) return;
        const newName = eProfileName.value.trim();

        if (!newName) {
            alert("Pehle naam enter karein!");
            return;
        }

        try {
            sProfileBtn.innerText = "Saving...";
            sProfileBtn.disabled = true;

            if (profileContext === 'self') {
                // Update OWN profile
                await db.collection('users').doc(uData.uid).update({ name: newName });
                uData.name = newName;
                localStorage.setItem('baatcheet_user', JSON.stringify(uData));
                const nameDisp = document.getElementById('my-name-display');
                if (nameDisp) nameDisp.innerText = newName;
                console.log("Personal profile updated.");
            } else {
                // Update CONTACT nickname
                if (currentContact) {
                    const contactRef = db.collection('users')
                        .doc(uData.uid)
                        .collection('contacts')
                        .doc(currentContact.uid);

                    await contactRef.set({
                        uid: currentContact.uid,
                        name: newName,
                        baatcheetNumber: currentContact.baatcheetNumber || ''
                    }, { merge: true });
                    console.log("Contact nickname saved/updated.");
                    renderChatList();
                }
            }

            alert("Saved successfully!");
            if (pModal) pModal.classList.add('hidden');
        } catch (error) {
            console.error("Error saving profile:", error);
            alert("Update fail: " + error.message);
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
    console.log("listenForMessages: Starting listener for", activeChatId);
    if (messageListener) messageListener(); // Unsubscribe previous

    messageListener = window.db.collection('conversations')
        .doc(activeChatId)
        .collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot({ includeMetadataChanges: true }, snapshot => {
            const userData = window.userData;
            console.log(`Messages Snapshot from ${snapshot.metadata.fromCache ? 'cache' : 'server'}: ${snapshot.size} messages`);
            if (nodes.chatBody) {
                nodes.chatBody.innerHTML = '';
                // Visible Debug Message
                const debugDiv = document.createElement('div');
                debugDiv.style = "font-size:10px; color:var(--text-secondary); text-align:center; padding:5px; opacity:0.5;";
                debugDiv.innerText = `Snapshot Sync: ${snapshot.size} messages (${snapshot.metadata.fromCache ? 'cache' : 'server'})`;
                nodes.chatBody.appendChild(debugDiv);
            }

            snapshot.docs.forEach((doc, idx) => {
                const msgId = doc.id;
                try {
                    const msg = doc.data();
                    const msgType = msg.type || 'text';
                    console.log(`[Msg ${idx + 1}/${snapshot.size}] ID: ${msgId}, Type: ${msgType}`);

                    // Skip if deleted for this user
                    if (msg.deletedFor && userData && userData.uid && msg.deletedFor.includes(userData.uid)) {
                        return;
                    }

                    // Clear Chat Filter: Skip if message is older than the last "Clear Chat" time for this user
                    if (activeChatData && activeChatData.clearedAt && userData && userData.uid) {
                        const myClearTime = activeChatData.clearedAt[userData.uid];
                        if (myClearTime && msg.timestamp) {
                            const clearTs = myClearTime.toDate ? myClearTime.toDate().getTime() : myClearTime;
                            const msgTs = msg.timestamp.toDate ? msg.timestamp.toDate().getTime() : (msg.timestamp.seconds * 1000);
                            if (msgTs <= clearTs) return;
                        }
                    }

                    const isSent = userData && msg.senderId === userData.uid;
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
                        div.className = `message call-log`;
                        let iconClass = 'fa-phone';
                        let iconColor = '#8696a0'; // Default
                        let callText = msg.text || 'Voice Call';

                        // Debugging info
                        console.log(`Rendering Call Log [${msgId}]:`, {
                            callerId: msg.callerId,
                            myUid: userData ? userData.uid : 'null',
                            status: msg.callStatus
                        });

                        if (msg.callerId) {
                            const isICalled = msg.callerId === userData.uid;
                            const isIMissed = msg.callStatus === 'missed';

                            if (isIMissed) {
                                iconClass = 'fa-phone-slash';
                                iconColor = '#f15c6d'; // Missed Red
                                callText = isICalled ? 'Missed Voice Call (Outgoing)' : 'Missed Voice Call (Incoming)';
                            } else {
                                iconColor = '#34B7F1'; // Answered Blue
                                callText = isICalled ? 'Outgoing Voice Call' : 'Incoming Voice Call';
                            }
                        } else if (msg.text) {
                            // Fallback for legacy logs
                            if (msg.text.toLowerCase().includes('missed')) {
                                iconClass = 'fa-phone-slash';
                                iconColor = '#f15c6d';
                            } else {
                                iconColor = '#34B7F1';
                            }
                        }

                        const timeStr = msg.timestamp
                            ? new Date(msg.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
                            : '';
                        const durationStr = msg.duration ? ` (${formatDuration(msg.duration)})` : '';
                        div.innerHTML = `<i class="fas ${iconClass}" style="color:${iconColor}; margin-right:8px;"></i> ${callText}${durationStr} <small style="margin-left:8px; opacity:0.6">${timeStr}</small>`;
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

                    let timeStr = '...';
                    if (msg.timestamp) {
                        try {
                            const date = msg.timestamp.toDate ? msg.timestamp.toDate() : new Date(msg.timestamp.seconds * 1000);
                            timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                        } catch (e) { timeStr = '...'; }
                    }

                    // Tick logic:
                    //   No tick        = received message (not mine)
                    //   Single grey ✓  = sent, not yet read
                    //   Double blue ✓✓ = sent & read by recipient
                    let tickHtml = '';
                    if (isSent) {
                        if (msg.read === true) {
                            tickHtml = `<i class="fas fa-check-double" style="color:#34B7F1;margin-left:5px;" title="Read"></i>`;
                        } else {
                            tickHtml = `<i class="fas fa-check" style="color:#8696a0;margin-left:5px;" title="Delivered"></i>`;
                        }
                    }

                    div.innerHTML = `
                    ${msg.text}
                    <div class="msg-time">${timeStr}${tickHtml}</div>
                `;
                    if (nodes.chatBody) nodes.chatBody.appendChild(div);
                    console.log(`- Rendered ${msgId} successfully.`);
                } catch (err) {
                    console.error(`- Error rendering ${doc.id}:`, err);
                }
            });
            if (nodes.chatBody) nodes.chatBody.scrollTop = nodes.chatBody.scrollHeight;
            console.log(`listenForMessages: Finished rendering ${snapshot.size} messages.`);

            // Auto-mark incoming as read while the chat is open
            if (activeChatId) {
                markMessagesAsRead(activeChatId);
            }
        }, error => {
            console.error("Messages Listener Error:", error);
            if (nodes.chatBody) {
                nodes.chatBody.innerHTML = `<div style="padding:20px; text-align:center; color:var(--primary-red);">
                    Error loading messages: ${error.message}
                </div>`;
            }
        });
}

// 5. Send Message
async function sendMessage() {
    if (!activeChatId) return;

    // Block Check
    if (activeChatData && activeChatData.blockedBy) {
        const blockerIds = Object.keys(activeChatData.blockedBy);
        if (blockerIds.length > 0) {
            alert("This chat is blocked. You cannot send messages.");
            return;
        }
    }

    console.log("SENDING MESSAGE: Initializing...", { activeChatId, hasInput: !!nodes.messageInput });

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
    if (typeof updateSendBtnIcon === 'function') updateSendBtnIcon();

    try {
        await window.db.collection('conversations').doc(activeChatId).collection('messages').add({
            text: text,
            senderId: uData.uid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            read: false
        });

        const other = getOtherParticipant(chats.find(c => c.id === activeChatId));
        const updateData = {
            lastMessage: text,
            lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (other && other.uid) {
            updateData[`unread_${other.uid}`] = true;
        }

        await window.db.collection('conversations').doc(activeChatId).update(updateData);
        console.log("Message sent successfully!");
    } catch (e) {
        console.error("Error sending message:", e);
        alert("Pesh aaney wala masla (Sending failed): " + e.message);
    }
}

// UI Handlers (updateSendBtnIcon removed)

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

// Voice Recording Logic Removed

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

// --- Midnight Cleanup Logic ---
async function checkAndRunDailyCleanup() {
    if (!window.userData) return;

    const lastCleanupKey = `lastCleanupDate_${window.userData.uid}`;
    const lastCleanupDate = localStorage.getItem(lastCleanupKey);
    const now = new Date();

    // Format: YYYY-MM-DD
    const todayStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;

    console.log(`Checking daily cleanup... Last: ${lastCleanupDate}, Today: ${todayStr}`);

    if (lastCleanupDate !== todayStr) {
        console.log("Midnight passed or new day. Running chat cleanup...");
        await deleteAllChatsLocallyAndRemotely();
        localStorage.setItem(lastCleanupKey, todayStr);
    }
}

async function deleteAllChatsLocallyAndRemotely() {
    if (!chats || chats.length === 0) {
        console.log("No chats to clean up.");
        return;
    }

    try {
        console.log(`Attempting to delete ${chats.length} active conversations...`);

        for (const chat of chats) {
            const convRef = window.db.collection('conversations').doc(chat.id);
            const msgsRef = convRef.collection('messages');

            // 1. Delete all messages in the subcollection
            const msgsSnapshot = await msgsRef.get();
            if (!msgsSnapshot.empty) {
                const batch = window.db.batch();
                msgsSnapshot.forEach(doc => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
                console.log(`Deleted ${msgsSnapshot.size} messages from chat ${chat.id}`);
            }

            // 2. Delete the conversation document itself
            await convRef.delete();
            console.log(`Deleted conversation document ${chat.id}`);
        }

        // 3. Clear local state and UI
        chats = [];
        activeChatId = null;
        activeChatData = null;
        renderChatList();
        closeChat();

        console.log("Daily chat cleanup completed successfully.");
    } catch (err) {
        console.error("Failed to run daily chat cleanup:", err);
    }
}

// --- Hourly Auto-Delete Logic ---
async function cleanupExpiredMessages(chatId) {
    if (!chatId) return;
    const now = Date.now();
    try {
        const expiredSnap = await window.db.collection('conversations')
            .doc(chatId)
            .collection('messages')
            .where('expiryAt', '<=', now)
            .get();

        if (!expiredSnap.empty) {
            console.log(`Cleanup: Found ${expiredSnap.size} expired messages in chat ${chatId}. Deleting...`);
            const batch = window.db.batch();
            expiredSnap.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }
    } catch (err) {
        console.warn(`Cleanup failed for chat ${chatId}:`, err.message);
    }
}

async function runGlobalCleanupSweep() {
    if (!chats || chats.length === 0) return;
    console.log("Running Global Expiry Sweep...");
    for (const chat of chats) {
        await cleanupExpiredMessages(chat.id);
    }
}

// Start Expiry Sweep (every 5 minutes)
setInterval(runGlobalCleanupSweep, 5 * 60 * 1000);

// --- PWA Installation Logic ---
let deferredPrompt;
const installBtn = document.getElementById('install-app-btn');

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    // Update UI notify the user they can install the PWA
    if (installBtn) installBtn.classList.remove('hidden');
    console.log("PWA: Install prompt stashed.");
});

if (installBtn) {
    installBtn.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        // Show the install prompt
        deferredPrompt.prompt();
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`PWA: User response to the install prompt: ${outcome}`);
        // We've used the prompt, and can't use it again, throw it away
        deferredPrompt = null;
        // Hide the install button
        installBtn.classList.add('hidden');
    });
}

window.addEventListener('appinstalled', (event) => {
    console.log('PWA: App installed successfully.');
    if (installBtn) installBtn.classList.add('hidden');
});

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
// --- Chat Header Menu Actions ---

async function clearChat() {
    if (!activeChatId) return;
    nodes.clearChatModal.classList.add('hidden');

    const myUid = window.userData ? window.userData.uid : null;
    if (!myUid) return;

    try {
        const convRef = window.db.collection('conversations').doc(activeChatId);

        // Update the clearedAt timestamp for the current user in the conversation document
        const updateData = {};
        updateData[`clearedAt.${myUid}`] = firebase.firestore.FieldValue.serverTimestamp();

        await convRef.update(updateData);

        console.log("Chat cleared for current user.");

        // Update local state to trigger a re-render/filter immediately if possible
        if (!activeChatData.clearedAt) activeChatData.clearedAt = {};
        activeChatData.clearedAt[myUid] = Date.now(); // Temporary local timestamp

        // Re-listen for messages to apply filter
        listenForMessages();
    } catch (err) {
        console.error("Failed to clear chat:", err);
        alert("Chat clear nahi ho saka!");
    }
}

async function confirmBlockContact() {
    if (!activeChatId || !window.userData) return;
    nodes.blockContactModal.classList.add('hidden');

    const myUid = window.userData.uid;
    const convRef = window.db.collection('conversations').doc(activeChatId);

    try {
        const isBlocked = activeChatData.blockedBy && activeChatData.blockedBy[myUid];
        const updateData = {};

        if (isBlocked) {
            updateData[`blockedBy.${myUid}`] = firebase.firestore.FieldValue.delete();
            await convRef.update(updateData);
            alert("Contact unblocked successfully.");
        } else {
            updateData[`blockedBy.${myUid}`] = true;
            await convRef.update(updateData);
            alert("Contact blocked successfully.");
        }

        // Update local state and UI
        if (activeChatData.blockedBy) {
            if (isBlocked) delete activeChatData.blockedBy[myUid];
            else activeChatData.blockedBy[myUid] = true;
        } else if (!isBlocked) {
            activeChatData.blockedBy = { [myUid]: true };
        }
        selectChat(activeChatData);

    } catch (err) {
        console.error("Failed to toggle block status:", err);
    }
}

async function confirmDeleteContact() {
    if (!activeChatId || !activeChatData) return;
    const other = getOtherParticipant(activeChatData);
    const myUid = window.userData ? window.userData.uid : null;

    try {
        if (nodes.confirmDeleteContactBtn) {
            nodes.confirmDeleteContactBtn.innerText = "Deleting...";
            nodes.confirmDeleteContactBtn.disabled = true;
        }

        // 1. Delete conversation document (Removes it for both participants)
        await window.db.collection('conversations').doc(activeChatId).delete();
        console.log("Conversation document deleted:", activeChatId);

        // 2. Delete nickname from private contacts if it exists
        if (myUid && other.uid) {
            await window.db.collection('users').doc(myUid).collection('contacts').doc(other.uid).delete();
            console.log("Private contact record deleted for UID:", other.uid);
            contactsMap.delete(other.uid);
        }

        // 3. UI Cleanup
        if (nodes.deleteContactModal) nodes.deleteContactModal.classList.add('hidden');
        closeChat(); // Go back to empty state
        renderChatList();

        alert("Contact deleted successfully from both sides.");

    } catch (err) {
        console.error("Failed to delete contact:", err);
        alert("Deletion failed: " + err.message);
    } finally {
        if (nodes.confirmDeleteContactBtn) {
            nodes.confirmDeleteContactBtn.innerText = "Delete for Both";
            nodes.confirmDeleteContactBtn.disabled = false;
        }
    }
}

function openContactProfile() {
    if (!activeChatData) return;
    const otherUser = getOtherParticipant(activeChatData);
    if (!otherUser) return;

    // Use the unified profile modal logic
    const pModal = document.getElementById('profile-modal');
    const eProfileName = document.getElementById('edit-profile-name');
    const pHeader = pModal ? pModal.querySelector('.modal-header h3') : null;

    if (pModal && eProfileName) {
        if (pHeader) pHeader.innerText = "Contact Profile";

        // Scope variables from profile editing closure
        // (Wait, app.js logic needs access to 'profileContext' and 'currentContact')
        // I will re-implement this inside the closure or make them global-ish.

        // Actually, let's just use the existing closure-friendly vars
        window.openContactProfileModal(otherUser);
    }
}
// --- Permission Management [NEW] ---
async function checkAllPermissions() {
    const skipPermissions = localStorage.getItem('baatcheet_skip_permissions');
    if (skipPermissions === 'true') return;

    const modal = document.getElementById('permission-modal');
    const grantBtn = document.getElementById('grant-all-btn');
    const skipBtn = document.getElementById('permission-skip');

    // Check if permissions are already granted
    let micGranted = false;
    let camGranted = false;
    let notifyGranted = Notification.permission === 'granted';

    try {
        const micStatus = await navigator.permissions.query({ name: 'microphone' });
        const camStatus = await navigator.permissions.query({ name: 'camera' });
        micGranted = micStatus.state === 'granted';
        camGranted = camStatus.state === 'granted';
    } catch (e) {
        console.warn("Permission query not fully supported:", e);
    }

    // If any important permission is missing, show modal
    if (!micGranted || !camGranted || !notifyGranted) {
        if (modal) modal.classList.remove('hidden');
    }

    if (grantBtn) {
        grantBtn.onclick = async () => {
            grantBtn.disabled = true;
            grantBtn.innerText = "Processing...";

            try {
                // 1. Notifications
                if (Notification.permission !== 'granted') {
                    await Notification.requestPermission();
                }

                // 2. Mic & Camera (This triggers the browser prompt)
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
                // Stop the stream immediately, we only wanted the permission
                stream.getTracks().forEach(track => track.stop());

                console.log("All permissions requested/granted.");
                if (modal) modal.classList.add('hidden');
            } catch (err) {
                console.error("Permission request failed:", err);
                alert("Please allow permissions from browser settings to use all features.");
                if (modal) modal.classList.add('hidden');
            }
        };
    }

    if (skipBtn) {
        skipBtn.onclick = () => {
            localStorage.setItem('baatcheet_skip_permissions', 'true');
            if (modal) modal.classList.add('hidden');
        };
    }
}
