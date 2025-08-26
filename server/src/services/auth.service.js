import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const TOKEN_AGE = 60 * 60 * 24 * 7; // 7 ngày

export const login = async ({ email, password }) => {
  const user = await User.findOne({ email });
  if (!user) {
    const err = new Error("Sai email hoặc mật khẩu");
    err.status = 401;
    throw err;
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    const err = new Error("Sai email hoặc mật khẩu");
    err.status = 401;
    throw err;
  }
  const token = jwt.sign({ sub: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: TOKEN_AGE
  });
  return { token, user: sanitize(user) };
};

export const register = async ({ email, password, name }) => {
  if (!email || !password || !name) {
    const err = new Error("Thiếu thông tin đăng ký (email, password, name)");
    err.status = 400;
    throw err;
  }
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    const err = new Error("Email đã được sử dụng");
    err.status = 400;
    throw err;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await User.create({ email, passwordHash, name });
  return { message: "Đăng ký thành công" };
};

export const sanitize = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  status: u.status,
  createdAt: u.createdAt,
  updatedAt: u.updatedAt
});

