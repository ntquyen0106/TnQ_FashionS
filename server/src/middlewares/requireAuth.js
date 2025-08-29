// middlewares/auth.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";  // <- thêm import

export const requireAuth = async (req, res, next) => {
  try {
    // Giữ nguyên cookie "token"; đồng thời hỗ trợ Bearer cho Postman nếu bạn có dùng
    const h = req.headers.authorization || "";
    const bearer = h.startsWith("Bearer ") ? h.slice(7) : null;
    const token = req.cookies?.token || bearer;

    if (!token) return res.status(401).json({ message: "Unauthenticated" });

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // MỚI: tải user để kiểm tra status/role “mới nhất”
    const user = await User.findById(payload.sub).select("_id role status");
    if (!user || user.status !== "active") {
      return res.status(401).json({ message: "Unauthenticated" });
    }

    // TƯƠNG THÍCH NGƯỢC: vẫn gán như code cũ
    req.userId = user._id.toString();
    req.userRole = user.role;

    // TIỆN ÍCH MỚI: có luôn object user nếu controller cần
    req.user = user;

    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};

export const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.userRole)) return res.status(403).json({ message: "Forbidden" });
  next();
};
