import 'dotenv/config';
import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Otp from '../models/Otp.js';
import { sendMail } from './mail.service.js';
import { adminAuth } from '../config/firebase.js';

const TOKEN_AGE = 60 * 60 * 24 * 7; // 7 ngày

/* -------------------- AUTHENTICATION SERVICES -------------------- */

export const login = async ({ email, password }) => {
  const user = await User.findOne({ email });
  if (!user) {
    const err = new Error('Không tìm thấy email');
    err.status = 401;
    throw err;
  }

  if (user.status !== 'active') {
    const err = new Error('Tài khoản bị khóa');
    err.status = 403;
    throw err;
  }

  // Nếu là tài khoản đăng nhập bằng Google (không có passwordHash), báo lỗi rõ ràng
  if (!user.passwordHash) {
    const err = new Error(
      'Tài khoản này đăng nhập bằng Google. Vui lòng dùng nút Google để đăng nhập.',
    );
    err.status = 400;
    throw err;
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    const err = new Error('Sai mật khẩu');
    err.status = 401;
    throw err;
  }

  const token = jwt.sign({ sub: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: TOKEN_AGE,
  });
  return { token, user: sanitize(user) };
};

export const firebaseSocialLogin = async ({ idToken }) => {
  if (!idToken) throw new Error('Thiếu idToken');

  const decoded = await adminAuth.verifyIdToken(idToken);
  const { email, name, picture, uid, firebase } = decoded;

  if (!email) throw new Error('Firebase token missing email');

  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      email,
      name: name || 'Social User',
      avatar: picture,
      status: 'active',
      role: 'user',
      provider: firebase?.sign_in_provider || 'firebase',
    });
  } else if (!user.name && name) {
    user.name = name; // cập nhật tên nếu trống
    await user.save();
  }

  const JWT_SECRET = process.env.JWT_SECRET;
  const token = jwt.sign(
    { sub: user._id.toString(), role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' },
  );

  return { user: sanitize(user), token };
};

// Alias để controller gọi tên nào cũng được
export const firebaseLogin = firebaseSocialLogin;

export const register = async ({ email, password, name }) => {
  if (!email || !password || !name) throw new Error('Thiếu thông tin đăng ký');

  // Nếu đã có user active
  const existing = await User.findOne({ email, status: 'active' });
  if (existing) throw new Error('Email đã được sử dụng');

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
    { upsert: true, new: true },
  );

  await sendMail(email, 'Mã xác thực đăng ký', `Mã OTP của bạn là: ${otp}`);

  return { message: 'Đã gửi OTP xác thực đến email' };
};

export const verifyOtp = async ({ email, otp }) => {
  const otpDoc = await Otp.findOne({ email });
  if (!otpDoc || otpDoc.expiresAt < new Date()) {
    throw new Error('OTP không hợp lệ hoặc đã hết hạn');
  }

  const isValid = bcrypt.compare(otp, otpDoc.otpHash);
  if (!isValid) throw new Error('OTP không hợp lệ');

  // Tạo/activate user
  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      email,
      passwordHash: otpDoc.passwordHash,
      name: otpDoc.name,
      status: 'active',
    });
  } else {
    user.status = 'active';
    await user.save();
  }

  // Đánh dấu đã dùng
  await Otp.updateOne({ email }, { $set: { usedAt: new Date() } });

  return { message: 'Xác thực thành công, tài khoản đã được tạo' };
};

export const resendOtp = async ({ email }) => {
  if (!email) throw new Error('Thiếu email');

  const otpDoc = await Otp.findOne({ email });
  if (otpDoc && otpDoc.expiresAt > new Date()) {
    const now = Date.now();
    const lastSent = otpDoc.lastSentAt ? otpDoc.lastSentAt.getTime() : 0;
    if (now - lastSent < 30 * 1000) {
      throw new Error('Vui lòng chờ 30 giây trước khi gửi lại OTP');
    }
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const lastSentAt = new Date();

  await Otp.findOneAndUpdate(
    { email },
    { otpHash, expiresAt, lastSentAt },
    { upsert: true, new: true },
  );

  await sendMail(email, 'Mã xác thực đăng ký', `Mã OTP của bạn là: ${otp}`);

  return { message: 'Đã gửi lại OTP xác thực đến email' };
};

export const forgotPassword = async ({ email }) => {
  const user = await User.findOne({ email });
  if (!user) throw new Error('Email không tồn tại');

  // Rate limit 30s
  const otpDoc = await Otp.findOne({ email, type: 'forgot' });
  if (otpDoc && otpDoc.lastSentAt && Date.now() - otpDoc.lastSentAt.getTime() < 30 * 1000) {
    throw new Error('Vui lòng chờ 30 giây trước khi gửi lại OTP');
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const lastSentAt = new Date();

  await Otp.findOneAndUpdate(
    { email, type: 'forgot' },
    { otpHash, expiresAt, lastSentAt, usedAt: null, resetToken: null, resetTokenExpiresAt: null },
    { upsert: true, new: true },
  );

  await sendMail(email, 'Mã OTP đặt lại mật khẩu', `Mã OTP của bạn là: ${otp}`);

  return { message: 'Đã gửi OTP đặt lại mật khẩu về email' };
};

export const forgotVerify = async ({ email, otp }) => {
  const otpDoc = await Otp.findOne({ email, type: 'forgot' });
  if (!otpDoc || otpDoc.expiresAt < new Date() || otpDoc.usedAt) {
    throw new Error('OTP không hợp lệ hoặc đã hết hạn');
  }
  const ok = bcrypt.compare(otp, otpDoc.otpHash);
  if (!ok) throw new Error('OTP không hợp lệ hoặc đã hết hạn');

  // Tạo resetToken ngắn hạn
  const resetToken = randomBytes(32).toString('hex');
  const resetTokenExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

  otpDoc.resetToken = resetToken;
  otpDoc.resetTokenExpiresAt = resetTokenExpiresAt;
  otpDoc.usedAt = new Date();
  await otpDoc.save();

  return { resetToken };
};

export const forgotReset = async ({ resetToken, newPassword }) => {
  const otpDoc = await Otp.findOne({ resetToken, type: 'forgot' });
  if (!otpDoc || otpDoc.resetTokenExpiresAt < new Date()) {
    throw new Error('resetToken không hợp lệ hoặc đã hết hạn');
  }

  const user = await User.findOne({ email: otpDoc.email });
  if (!user) throw new Error('User không tồn tại');

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();

  // Xóa OTP sau khi dùng
  await Otp.deleteOne({ _id: otpDoc._id });

  return { message: 'Đổi mật khẩu thành công' };
};

/* -------------------- UTILITY FUNCTIONS -------------------- */

export const sanitize = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  status: u.status,
  createdAt: u.createdAt,
  updatedAt: u.updatedAt,
});