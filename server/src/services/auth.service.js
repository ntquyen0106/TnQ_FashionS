import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Otp from "../models/Otp.js";
import { sendMail } from "./mail.service.js"; 
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
  if (!email || !password || !name) throw new Error("Thiếu thông tin đăng ký");

  // Kiểm tra email đã tồn tại user active chưa
  const existing = await User.findOne({ email, status: "active" });
  if (existing) throw new Error("Email đã được sử dụng");

  // Tạo OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 phút

  // Lưu OTP (ghi đè nếu đã có)
  await Otp.findOneAndUpdate(
    { email },
    { otp, expiresAt },
    { upsert: true, new: true }
  );

  // Gửi OTP qua email
  await sendMail(email, "Mã xác thực đăng ký", `Mã OTP của bạn là: ${otp}`);

  return { message: "Đã gửi OTP xác thực đến email" };
};

export const verifyOtp = async ({ email, otp, password, name }) => {
  const otpDoc = await Otp.findOne({ email });
  if (!otpDoc || otpDoc.otp !== otp || otpDoc.expiresAt < new Date()) {
    throw new Error("OTP không hợp lệ hoặc đã hết hạn");
  }

  // Xóa OTP sau khi dùng
  await Otp.deleteOne({ email });

  // Tạo user (nếu chưa có)
  let user = await User.findOne({ email });
  if (!user) {
    const passwordHash = await bcrypt.hash(password, 10);
    user = await User.create({
      email,
      passwordHash,
      name,
      status: "active"
    });
  } else {
    user.status = "active";
    await user.save();
  }

  return { message: "Xác thực thành công, tài khoản đã được tạo" };
};

//resend otp
export const resendOtp = async ({ email }) => {
  if (!email) throw new Error("Thiếu email");

  // Kiểm tra OTP cũ còn hạn và gửi chưa quá 30s
  const otpDoc = await Otp.findOne({ email });
  if (otpDoc && otpDoc.expiresAt > new Date()) {
    const now = Date.now();
    const lastSent = otpDoc.lastSentAt ? otpDoc.lastSentAt.getTime() : 0;
    if (now - lastSent < 30 * 1000) {
      throw new Error("Vui lòng chờ 30 giây trước khi gửi lại OTP");
    }
  }

  // Tạo OTP mới
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 phút
  const lastSentAt = new Date();

  await Otp.findOneAndUpdate(
    { email },
    { otp, expiresAt, lastSentAt },
    { upsert: true, new: true }
  );

  await sendMail(email, "Mã xác thực đăng ký", `Mã OTP của bạn là: ${otp}`);

  return { message: "Đã gửi lại OTP xác thực đến email" };
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

