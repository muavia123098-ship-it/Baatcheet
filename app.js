// Check if user is logged in
const userData = JSON.parse(localStorage.getItem('baatcheet_user'));
if (!userData) {
    window.location.href = 'login.html';
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
    db.collection('conversations')
        .where('participants', 'array-contains', userData.uid)
        .onSnapshot(snapshot => {
            chats = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            renderChatList();
        });
}

// 2. Render Chat List
function renderChatList(filter = '') {
    chatList.innerHTML = '';
    chats.sort((a, b) => (b.lastUpdate?.seconds || 0) - (a.lastUpdate?.seconds || 0))
        .filter(chat => {
            const otherParticipant = getOtherParticipant(chat);
            return otherParticipant.name.toLowerCase().includes(filter.toLowerCase());
        })
        .forEach(chat => {
            const other = getOtherParticipant(chat);
            const div = document.createElement('div');
            div.className = `chat-item ${activeChatId === chat.id ? 'active' : ''}`;
            div.onclick = () => selectChat(chat);

            const time = chat.lastUpdate ? new Date(chat.lastUpdate.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

            div.innerHTML = `
                <img src="${other.photoURL || 'https://ui-avatars.com/api/?name=' + other.name + '&background=d32f2f&color=fff'}" class="chat-item-img">
                <div class="chat-item-info">
                    <div class="chat-item-top">
                        <span class="chat-item-name">${other.name}</span>
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
    if (chat.participantsData) {
        return chat.participantsData.find(p => p.uid !== userData.uid) || { name: 'Unknown' };
    }
    return { name: 'Unknown' };
}

// 3. Select Chat
function selectChat(chat) {
    activeChatId = chat.id;
    activeChatData = chat;
    const other = getOtherParticipant(chat);
    activeChatName.innerText = other.name;
    activeChatImg.src = other.photoURL || `https://ui-avatars.com/api/?name=${other.name}&background=d32f2f&color=fff`;
    activeChatStatus.innerText = 'Online';

    renderChatList();
    listenForMessages();
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
                const div = document.createElement('div');
                div.className = `message ${msg.senderId === userData.uid ? 'sent' : 'received'}`;

                const timeStr = msg.timestamp ? new Date(msg.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...';

                div.innerHTML = `
                    ${msg.text}
                    <div class="msg-time">${timeStr} ${msg.senderId === userData.uid ? '<i class="fas fa-check-double" style="color: #53bdeb; margin-left: 5px;"></i>' : ''}</div>
                `;
                chatBody.appendChild(div);
            });
            chatBody.scrollTop = chatBody.scrollHeight;
        });
}

// 5. Send Message
async function sendMessage() {
    const text = messageInput.value.trim();
    if (text && activeChatId) {
        messageInput.value = '';
        updateSendBtnIcon();

        const timestamp = firebase.firestore.FieldValue.serverTimestamp();

        // Add message to subcollection
        await db.collection('conversations').doc(activeChatId).collection('messages').add({
            text: text,
            senderId: userData.uid,
            timestamp: timestamp
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

messageInput.oninput = updateSendBtnIcon;
messageInput.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };
sendBtn.onclick = () => { if (sendBtn.classList.contains('fa-paper-plane')) sendMessage(); };

document.getElementById('chat-search').oninput = (e) => renderChatList(e.target.value);

// Start
listenForChats();
