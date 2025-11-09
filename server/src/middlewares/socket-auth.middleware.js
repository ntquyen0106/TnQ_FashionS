import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Socket.IO authentication middleware
 * Verify JWT token from handshake auth
 * Tương thích với requireAuth middleware
 */
export const authenticateSocket = async (socket, next) => {
  try {
    // Get token from handshake auth or query
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    // Verify token (giống requireAuth)
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const uid = payload.sub || payload._id || payload.id || payload.userId;
    
    if (!uid) {
      return next(new Error('Invalid token payload'));
    }

    // Get user from database
    const user = await User.findById(uid)
      .select('_id name email role status')
      .lean();

    if (!user || user.status !== 'active') {
      return next(new Error('User not found or inactive'));
    }

    // Attach user to socket (consistent format)
    socket.user = user;
    socket.userId = String(user._id);
    socket.userRole = user.role;
    
    next();
  } catch (error) {
    console.error('❌ [Socket Auth] Error:', error.message);
    if (error.name === 'TokenExpiredError') {
      return next(new Error('Token expired'));
    }
    next(new Error('Authentication failed'));
  }
};
