// middlewares/auth.js
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const requireAuth = async (req, res, next) => {
  try {
    const h = req.headers.authorization || '';
    const bearer = h.startsWith('Bearer ') ? h.slice(7) : null;
    const token = req.cookies?.token || bearer;

    if (!token) return res.status(401).json({ message: 'Unauthenticated' });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const uid = payload.sub || payload._id || payload.id || payload.userId;
    if (!uid) return res.status(401).json({ message: 'Invalid token' });

    const user = await User.findById(uid).select('_id name email role status').lean();
    if (!user || user.status !== 'active') {
      return res.status(401).json({ message: 'Unauthenticated' });
    }

    req.userId = String(user._id);
    req.userRole = user.role;
    req.user = user;
    next();
  } catch (e) {
    if (e.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    return res.status(401).json({ message: 'Invalid token' });
  }
};
export const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.userRole)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };

export const optionalAuth = async (req, res, next) => {
  try {
    const h = req.headers.authorization || '';
    const bearer = h.startsWith('Bearer ') ? h.slice(7) : null;
    const token = req.cookies?.token || bearer; // đọc cả cookie và bearer
    if (!token) return next();

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const uid = payload.sub || payload._id || payload.id || payload.userId;
    if (!uid) return next();

    const user = await User.findById(uid).select('_id name email role status').lean();
    if (user && user.status === 'active') {
      req.userId = String(user._id);
      req.userRole = user.role;
      req.user = user;
    }
    next();
  } catch {
    // optional -> không chặn request nếu token lỗi
    next();
  }
};
