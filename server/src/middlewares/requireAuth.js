// middlewares/auth.js
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const requireAuth = async (req, res, next) => {
  try {
    const h = req.headers.authorization || '';
    const bearer = h.startsWith('Bearer ') ? h.slice(7) : null;
    const token = req.cookies?.token || bearer; // cookie FE, Bearer cho Postman

    if (!token) return res.status(401).json({ message: 'Unauthenticated' });

    const payload = jwt.verify(token, process.env.JWT_SECRET); // { sub, ... }
m
    const user = await User.findById(payload.sub).select('_id name email role status').lean();

    if (!user || user.status !== 'active') {
      return res.status(401).json({ message: 'Unauthenticated' });
    }

    // tương thích cũ + tiện ích mới
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
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.sub);
      if (user) req.user = user;
    }
    next();
  } catch (err) {
    next();
  }
};
