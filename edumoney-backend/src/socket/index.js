import { Server } from 'socket.io';
import { SOCKET_EVENTS } from './events.js';

let io;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: [
        process.env.FRONTEND_URL || 'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:3000',
      ],
      credentials: true,
      methods: ['GET', 'POST'],
    },
  });

  io.on(SOCKET_EVENTS.CONNECT, (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // Map user to socket room
    socket.on(SOCKET_EVENTS.REGISTER, (userId) => {
      if (userId) {
        socket.join(userId.toString());
        console.log(`[Socket] User ${userId} joined room`);
      }
    });

    socket.on(SOCKET_EVENTS.DISCONNECT, () => {
      console.log(`[Socket] Disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io is not initialized!');
  }
  return io;
};
