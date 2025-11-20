const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for simplicity in this demo
        methods: ["GET", "POST"]
    }
});

let drawingHistory = [];
let connectedUsers = 0;

io.on('connection', (socket) => {
    connectedUsers++;
    io.emit('users_count', connectedUsers);
    console.log(`User connected. Total: ${connectedUsers}`);

    // Send existing history to new user
    socket.emit('history', drawingHistory);

    socket.on('draw', (data) => {
        drawingHistory.push(data);
        // Broadcast to everyone else
        socket.broadcast.emit('draw', data);
    });

    socket.on('clear', () => {
        drawingHistory = [];
        io.emit('clear');
    });

    socket.on('disconnect', () => {
        connectedUsers--;
        io.emit('users_count', connectedUsers);
        console.log(`User disconnected. Total: ${connectedUsers}`);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Socket.io server running on port ${PORT}`);
});
