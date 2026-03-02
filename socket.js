const SERVER_URL = 'http://localhost:3001'; // Aapka server URL (Localhost for now)
const socket = io(SERVER_URL);

socket.on('connect', () => {
    console.log('Server ke saath connect ho gaya! ID:', socket.id);

    // Jab user login ho jaye, to server ko bataein
    if (window.userData && window.userData.uid) {
        socket.emit('join_user', window.userData.uid);
    }
});

// Message receive karne ka listener
socket.on('receive_message', (data) => {
    console.log('Naya message aaya:', data);
    // Agar active chat wahi hai, to message screen par dikhayein
    if (typeof window.handleReceiveSocketMessage === 'function') {
        window.handleReceiveSocketMessage(data);
    }
});

socket.on('disconnect', () => {
    console.log('Server se disconnect ho gaya.');
});

// Global function message bhejne ke liye
window.sendSocketMessage = (receiverId, messageText, type = 'text') => {
    const messageData = {
        senderId: window.userData.uid,
        receiverId: receiverId,
        text: messageText,
        type: type,
        timestamp: new Date().toISOString()
    };
    socket.emit('send_message', messageData);
};
