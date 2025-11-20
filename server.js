const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from current directory
app.use(express.static(__dirname));

// Store drawing history in memory
let drawingHistory = [];
let connectedUsers = 0;

io.on('connection', (socket) => {
    connectedUsers++;
    io.emit('users_count', connectedUsers);

    // Send existing history to the new client
    socket.emit('history', drawingHistory);

    socket.on('draw', (data) => {
        drawingHistory.push(data);
        // Broadcast to all other clients
        socket.broadcast.emit('draw', data);
    });

    socket.on('clear', () => {
        drawingHistory = [];
        io.emit('clear');
    });

    socket.on('disconnect', () => {
        connectedUsers--;
        io.emit('users_count', connectedUsers);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
