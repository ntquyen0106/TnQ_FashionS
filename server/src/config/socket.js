import { Server } from 'socket.io';
import { authenticateSocket } from '../middlewares/socket-auth.middleware.js';

// Global IO instance
let io = null;

// Online users tracking: Map<userId, { socketId, connectedAt, lastActivity }>
const onlineUsers = new Map();

// Active sessions tracking: Map<socketId, { userId, userName, role, connectedAt, lastActivity }>
const activeSessions = new Map();

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
  io = new Server(httpServer, {
    cors: {
      origin: [clientURL, 'http://localhost:5173', 'http://localhost:3000'].filter(Boolean),
      credentials: true,
    },
  });

  // Socket authentication middleware
  io.use(authenticateSocket);

  // Socket connection handling
  io.on('connection', (socket) => {
    const userId = socket.user?._id?.toString();
    const userName = socket.user?.name || 'Guest';
    const userRole = socket.user?.role || 'guest';

    console.log(`[Socket] ${userName} kết nối (${socket.id})`);

    // Track online user
    if (userId) {
      onlineUsers.set(userId, {
        socketId: socket.id,
        connectedAt: new Date(),
        lastActivity: new Date(),
      });

      activeSessions.set(socket.id, {
        userId,
        userName,
        role: userRole,
        connectedAt: new Date(),
        lastActivity: new Date(),
      });

      // Broadcast updated online stats to admins
      broadcastOnlineStats(io);
    }

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

    // User activity tracking (update lastActivity)
    socket.on('activity', () => {
      const session = activeSessions.get(socket.id);
      if (session) {
        session.lastActivity = new Date();
      }
      if (userId) {
        const userOnline = onlineUsers.get(userId);
        if (userOnline) {
          userOnline.lastActivity = new Date();
        }
      }
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

      // Remove from tracking
      if (userId) {
        onlineUsers.delete(userId);
      }
      activeSessions.delete(socket.id);

      // Broadcast updated stats
      broadcastOnlineStats(io);
    });
  });

  // Cleanup stale sessions every 5 minutes
  setInterval(() => {
    const now = Date.now();
    const staleThreshold = 10 * 60 * 1000; // 10 minutes

    activeSessions.forEach((session, socketId) => {
      if (now - session.lastActivity.getTime() > staleThreshold) {
        console.log(`🧹 [Socket] Cleaning stale session: ${session.userName}`);
        onlineUsers.delete(session.userId);
        activeSessions.delete(socketId);
      }
    });

    broadcastOnlineStats(io);
  }, 5 * 60 * 1000);

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

/**
 * Broadcast online statistics to admin clients
 */
const broadcastOnlineStats = (io) => {
  const stats = getOnlineStats();
  io.to('staff-room').emit('online-stats', stats);
};

/**
 * Get current online statistics
 */
export const getOnlineStats = () => {
  const sessions = Array.from(activeSessions.values());

  // Group by role
  const byRole = sessions.reduce((acc, s) => {
    acc[s.role] = (acc[s.role] || 0) + 1;
    return acc;
  }, {});

  return {
    onlineUsers: onlineUsers.size,
    activeSessions: activeSessions.size,
    byRole: Object.entries(byRole).map(([role, count]) => ({ role, count })),
    timestamp: new Date(),
  };
};

/**
 * Check if user is online
 */
export const isUserOnline = (userId) => {
  return onlineUsers.has(userId);
};

/**
 * Get online user IDs
 */
export const getOnlineUserIds = () => {
  return Array.from(onlineUsers.keys());
};
