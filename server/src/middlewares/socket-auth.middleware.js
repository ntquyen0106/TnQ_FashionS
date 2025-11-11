import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import cookie from 'cookie';

/**
 * Socket.IO authentication middleware
 * Verify JWT token from cookie (compatible with cookie-based auth)
 */
export const authenticateSocket = async (socket, next) => {
  try {
    // Try to get token from auth header first (backward compatibility)
    let token = socket.handshake.auth?.token || socket.handshake.query?.token;

    // If no token in auth, try to parse from cookie (primary method)
    if (!token && socket.handshake.headers.cookie) {
      const cookies = cookie.parse(socket.handshake.headers.cookie);
      token = cookies.token || cookies.jwt || cookies.auth_token;
    }

    if (!token) {
      // Allow guest connections (optional)
      socket.user = null;
      socket.userId = null;
      socket.userRole = 'guest';
      return next();
    }

    // Verify token
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const uid = payload.sub || payload._id || payload.id || payload.userId;

    if (!uid) {
      return next(new Error('Invalid token payload'));
    }

    // Get user from database
    const user = await User.findById(uid).select('_id name email role status').lean();

    if (!user || user.status !== 'active') {
      return next(new Error('User not found or inactive'));
    }

    // Attach user to socket
    socket.user = user;
    socket.userId = String(user._id);
    socket.userRole = user.role;

    console.log(`[Socket Auth] ✅ ${user.name} (${user.role}) authenticated`);
    next();
  } catch (error) {
    console.error('❌ [Socket Auth] Error:', error.message);
    // Allow connection but as guest
    socket.user = null;
    socket.userId = null;
    socket.userRole = 'guest';
    next();
  }
};
