/* eslint-disable @typescript-eslint/no-require-imports */
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const fs = require('fs');
const path = require('path');

// Simple Logging Utility
const logFilePath = path.join(__dirname, 'server.log');
const logger = (message) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(logMessage.trim());
  fs.appendFileSync(logFilePath, logMessage);
};

app.prepare().then(() => {
  const expressApp = express();
  const httpServer = createServer(expressApp);
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Socket.io event handling
  io.on('connection', (socket) => {
    logger(`User connected: ${socket.id}`);

    // Join room
    socket.on('join-room', (roomId) => {
      socket.join(roomId);
      logger(`User ${socket.id} joined room ${roomId}`);
      socket.to(roomId).emit('user-joined', socket.id);
    });

    // Handle messages (Educational & Secure Mode)
    socket.on('send-message', (data) => {
      logger(`Message from ${socket.id} in room ${data.roomId} [Mode: ${data.mode}]`);
      // Broadcast message to everyone in the room except sender
      socket.to(data.roomId).emit('receive-message', {
        ...data,
        senderId: socket.id,
        timestamp: Date.now(),
      });
    });

    // Handle public key sharing (Secure Mode)
    socket.on('share-public-key', (data) => {
      logger(`Public Key shared by ${socket.id} for room ${data.roomId}`);
      // Broadcast public key to room
      socket.to(data.roomId).emit('receive-public-key', {
        ...data,
        senderId: socket.id,
      });
    });

    socket.on('disconnecting', () => {
      // Find rooms the user was in and notify them
      for (const room of socket.rooms) {
        if (room !== socket.id) {
          logger(`User ${socket.id} leaving room ${room}`);
          socket.to(room).emit('user-left', socket.id);
        }
      }
    });

    socket.on('disconnect', () => {
      logger(`User disconnected: ${socket.id}`);
    });
  });

  // Next.js request handling
  expressApp.use((req, res) => {
    return handle(req, res);
  });

  httpServer.listen(port, () => {
    logger(`> Ready on http://${hostname}:${port}`);
  });
}).catch((err) => {
  console.error('Error starting server:', err);
  process.exit(1);
});
