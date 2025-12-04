import { Server } from 'socket.io';
import { authenticateSocket } from '../middlewares/socket-auth.middleware.js';

const normalizeOrigins = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  return String(value)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

// Global IO instance
let io = null;

/**
 * Get the Socket.IO instance
 * @returns {Server} Socket.IO instance
 */
export const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized!');
  }
  return io;
};

/**
 * Setup Socket.IO server
 * @param {import('http').Server} httpServer
 * @param {string} clientURL
 * @returns {Server} Socket.IO instance
 */
export const setupSocketIO = (httpServer, clientURL) => {
  const staticOrigins = [
    ...normalizeOrigins(clientURL),
    ...normalizeOrigins(process.env.CORS_EXTRA_ORIGINS),
    'http://localhost:5173',
    'http://localhost:3000',
  ].filter(Boolean);

  const allowPatterns = [
    /^http:\/\/localhost(?::\d+)?$/,
    /^http:\/\/127\.0\.0\.1(?::\d+)?$/,
    /^https:\/\/[\w-]+\.vercel\.app$/,
  ];

  io = new Server(httpServer, {
    cors: {
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (staticOrigins.includes(origin) || allowPatterns.some((re) => re.test(origin))) {
          return cb(null, true);
        }
        return cb(new Error('Socket CORS not allowed'));
      },
      credentials: true,
    },
  });

  // Socket authentication middleware
  io.use(authenticateSocket);

  // Socket connection handling
  io.on('connection', (socket) => {
    console.log(`[Socket] ${socket.user?.name || 'Guest'} kết nối (${socket.id})`);

    // Staff auto-join staff room to receive new chat requests
    if (socket.user?.role === 'staff' || socket.user?.role === 'admin') {
      socket.join('staff-room');
      //console.log(`[Socket] ${socket.user.name} joined staff-room (room size: ${io.sockets.adapter.rooms.get('staff-room')?.size || 1})`);
      // Immediately send a lightweight ping so staff UI can confirm subscription
      socket.emit('staff_room_joined', { ok: true, room: 'staff-room', ts: Date.now() });
    }

    // Join chat session (for customers and staff)
    socket.on('join_chat', (sessionId) => {
      socket.join(`chat:${sessionId}`);
      console.log(`[Socket] ${socket.user?.name || 'Guest'} joined chat:${sessionId}`);
    });

    // Leave chat session
    socket.on('leave_chat', (sessionId) => {
      socket.leave(`chat:${sessionId}`);
      console.log(`[Socket] ${socket.user?.name || 'Guest'} left chat:${sessionId}`);
    });

    // Join conversation room (legacy support)
    socket.on('join_conversation', (conversationId) => {
      socket.join(`conversation:${conversationId}`);
      console.log(`[Socket] ${socket.user.name} tham gia conversation:${conversationId}`);
    });

    // Leave conversation room (legacy support)
    socket.on('leave_conversation', (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
      console.log(`[Socket] ${socket.user.name} rời conversation:${conversationId}`);
    });

    // Typing indicator
    socket.on('typing', ({ conversationId, sessionId, isTyping }) => {
      const room = conversationId ? `conversation:${conversationId}` : `chat:${sessionId}`;
      socket.to(room).emit('user_typing', {
        userId: socket.user._id,
        userName: socket.user.name,
        isTyping,
      });
    });

    // Handle staff request from customer
    socket.on('request_staff', (data) => {
      console.log(`[Socket] Customer requesting staff for session: ${data.sessionId}`);
      // Broadcast to all staff members
      io.to('staff-room').emit('new_staff_request', {
        sessionId: data.sessionId,
        timestamp: data.timestamp || new Date().toISOString(),
        message: 'Có khách hàng yêu cầu hỗ trợ',
      });
      // Ack back to requester so frontend can mark "notified"
      socket.emit('staff_request_ack', { success: true, sessionId: data.sessionId });
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
