import { Server } from 'socket.io';
import { authenticateSocket } from '../middlewares/socket-auth.middleware.js';

/**
 * Setup Socket.IO server
 * @param {import('http').Server} httpServer 
 * @param {string} clientURL 
 * @returns {Server} Socket.IO instance
 */
export const setupSocketIO = (httpServer, clientURL) => {
  const io = new Server(httpServer, {
    cors: {
      origin: [clientURL, 'http://localhost:5173', 'http://localhost:3000'].filter(Boolean),
      credentials: true,
    },
  });

  // Socket authentication middleware
  io.use(authenticateSocket);

  // Socket connection handling
  io.on('connection', (socket) => {
    console.log(`[Socket] ${socket.user?.name || 'Guest'} kết nối (${socket.id})`);

    // Join conversation room
    socket.on('join_conversation', (conversationId) => {
      socket.join(`conversation:${conversationId}`);
      console.log(`[Socket] ${socket.user.name} tham gia conversation:${conversationId}`);
    });

    // Leave conversation room
    socket.on('leave_conversation', (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
      console.log(`[Socket] ${socket.user.name} rời conversation:${conversationId}`);
    });

    // Typing indicator
    socket.on('typing', ({ conversationId, isTyping }) => {
      socket.to(`conversation:${conversationId}`).emit('user_typing', {
        userId: socket.user._id,
        userName: socket.user.name,
        isTyping,
      });
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] ${socket.user?.name || 'Guest'} ngắt kết nối`);
    });
  });

  return io;
};

/**
 * Attach Socket.IO instance to Express request
 * @param {Server} io 
 */
export const attachSocketIO = (io) => {
  return (req, res, next) => {
    req.io = io;
    next();
  };
};
