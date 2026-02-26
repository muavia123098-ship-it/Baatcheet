// Populate Sidebar Header
if (userData) {
    document.getElementById('user-main-img').src = userData.photoURL || `https://ui-avatars.com/api/?name=${userData.name}&background=d32f2f&color=fff`;
    document.getElementById('user-main-img').title = `My Number: ${userData.baatcheetNumber}`;
    if (document.getElementById('my-number-display')) {
        document.getElementById('my-number-display').innerText = userData.baatcheetNumber;
    }
}

// Logout Logic
const logoutBtn = document.getElementById('logout-menu');
if (logoutBtn) {
    logoutBtn.onclick = () => {
        localStorage.removeItem('baatcheet_user');
        auth.signOut().then(() => {
            window.location.href = 'login.html';
        });
    };
}

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
            <img src="${other.photoURL || 'https://ui-avatars.com/api/?name=' + other.name + '&background=d32f2f&color=fff'}" class="chat-item-img">
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
    activeChatImg.src = other.photoURL || `https://ui-avatars.com/api/?name=${other.name}&background=d32f2f&color=fff`;
    activeChatStatus.innerText = 'Online';

    // Show Call button
    const callBtn = document.getElementById('call-btn');
    if (callBtn) callBtn.style.display = 'block';

    // Mobile View Toggle
    document.querySelector('.sidebar').classList.add('hide-mobile');
    document.querySelector('.main-chat').classList.add('show-mobile');

    renderChatList();
    listenForMessages();
    // Mark incoming messages as read when chat is opened
    markMessagesAsRead(chat.id);
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

// Mobile Back Button
document.getElementById('back-btn').onclick = () => {
    document.querySelector('.sidebar').classList.remove('hide-mobile');
    document.querySelector('.main-chat').classList.remove('show-mobile');

    // Hide Call button when returning to chat list
    const callBtn = document.getElementById('call-btn');
    if (callBtn) callBtn.style.display = 'none';
};

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
                const isSent = msg.senderId === userData.uid;
                const div = document.createElement('div');
                div.className = `message ${isSent ? 'sent' : 'received'}`;

                const timeStr = msg.timestamp
                    ? new Date(msg.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '...';

                // Tick logic:
                //   No tick        = received message (not mine)
                //   Single grey ✓  = sent, not yet read
                //   Double red ✓✓  = sent & read by recipient
                let tickHtml = '';
                if (isSent) {
                    if (msg.read) {
                        tickHtml = '<i class="fas fa-check-double" style="color:#d32f2f;margin-left:5px;"></i>';
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

messageInput.oninput = updateSendBtnIcon;
messageInput.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };
sendBtn.onclick = () => { if (sendBtn.classList.contains('fa-paper-plane')) sendMessage(); };

document.getElementById('chat-search').oninput = (e) => renderChatList(e.target.value);

// Start
listenForChats();
listenForCalls();
