import 'dotenv/config';
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

  // Nếu đã có user active
  const existing = await User.findOne({ email, status: "active" });
  if (existing) throw new Error("Email đã được sử dụng");

  // Tạo OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const lastSentAt = new Date();

  // Hash password ngay tại đây
  const passwordHash = await bcrypt.hash(password, 10);

  // Lưu vào Otp
  await Otp.findOneAndUpdate(
    { email },
    { otpHash, expiresAt, lastSentAt, passwordHash, name },
    { upsert: true, new: true }
  );

  await sendMail(email, "Mã xác thực đăng ký", `Mã OTP của bạn là: ${otp}`);

  return { message: "Đã gửi OTP xác thực đến email" };
};

export const verifyOtp = async ({ email, otp }) => {
  const otpDoc = await Otp.findOne({ email });
  if (!otpDoc || otpDoc.expiresAt < new Date()) {
    throw new Error("OTP không hợp lệ hoặc đã hết hạn");
  }

  const isValid = await bcrypt.compare(otp, otpDoc.otpHash);
  if (!isValid) throw new Error("OTP không hợp lệ");

  // Tạo/activate user
  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      email,
      passwordHash: otpDoc.passwordHash,
      name: otpDoc.name,
      status: "active",
    });
  } else {
    user.status = "active";
    await user.save();
  }

  // Đánh dấu đã dùng
  await Otp.updateOne({ email }, { $set: { usedAt: new Date() } });

  return { message: "Xác thực thành công, tài khoản đã được tạo" };
};

//resend otp
export const resendOtp = async ({ email }) => {
  if (!email) throw new Error("Thiếu email");

  const otpDoc = await Otp.findOne({ email });
  if (otpDoc && otpDoc.expiresAt > new Date()) {
    const now = Date.now();
    const lastSent = otpDoc.lastSentAt ? otpDoc.lastSentAt.getTime() : 0;
    if (now - lastSent < 30 * 1000) {
      throw new Error("Vui lòng chờ 30 giây trước khi gửi lại OTP");
    }
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const lastSentAt = new Date();

  await Otp.findOneAndUpdate(
    { email },
    { otpHash, expiresAt, lastSentAt },
    { upsert: true, new: true }
  );

  await sendMail(email, "Mã xác thực đăng ký", `Mã OTP của bạn là: ${otp}`);

  return { message: "Đã gửi lại OTP xác thực đến email" };
};

console.log('PROVIDER=', process.env.EMAIL_PROVIDER);
console.log('MAILTRAP_USER exists?', !!process.env.MAILTRAP_USER);
console.log('MAILTRAP_PASS exists?', !!process.env.MAILTRAP_PASS);



export const sanitize = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  status: u.status,
  createdAt: u.createdAt,
  updatedAt: u.updatedAt
});

