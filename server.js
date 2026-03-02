const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Sab origins ko allow kar raha hoon (Development ke liye)
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

// Main route
app.get('/', (req, res) => {
    res.send('BAATCHEET Chat Server is Running!');
});

// Real-time Messaging (Socket.io)
io.on('connection', (socket) => {
    console.log('Ek user connect hua:', socket.id);

    // Jab koi user join karega (Identify karne ke liye)
    socket.on('join_user', (userId) => {
        socket.join(userId);
        console.log(`User ${userId} ne apna room join kiya.`);
    });

    // Message bhejne ka logic
    socket.on('send_message', (data) => {
        console.log("Naya message:", data);
        // Recevier ko message foran bhej dena
        io.to(data.receiverId).emit('receive_message', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnect ho gaya.');
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`BAATCHEET Server chal raha hai port ${PORT} par 🚀`);
});
