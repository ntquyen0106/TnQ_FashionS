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
// middlewares/auth.js
export const requireRole =
  (...roles) =>
  (req, res, next) => {
    // ALIAS: chỉnh lại nếu hệ thống bạn khác
    const ALIAS = {
      admin: new Set(['admin', 'ADMIN', 4, '4']),
      manager: new Set(['manager', 'MANAGER', 3, '3']),
      staff: new Set(['staff', 'STAFF', 2, '2']),
      cashier: new Set(['cashier', 'CASHIER', 1, '1']),
    };

    const userRole = req.userRole; // giữ nguyên như bạn đang set ở requireAuth
    if (userRole == null) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // Hợp nhất tất cả role kỳ vọng thành một tập "raw" có cả alias
    const expected = new Set();
    for (const r of roles) {
      const key = String(r).toLowerCase();
      if (ALIAS[key]) {
        for (const v of ALIAS[key]) expected.add(String(v).toLowerCase());
      }
      expected.add(String(r).toLowerCase());
      // cũng thêm dạng số nếu có thể parse được
      const rn = Number(r);
      if (!Number.isNaN(rn)) expected.add(String(rn));
    }

    // Chuẩn hoá role của user để so
    const uStr = String(userRole).toLowerCase();
    const uNum = Number(userRole);
    const ok = expected.has(uStr) || (!Number.isNaN(uNum) && expected.has(String(uNum)));

    if (!ok) return res.status(403).json({ message: 'Forbidden' });
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
