import 'dotenv/config';
import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Otp from '../models/Otp.js';
import { sendMail } from './mail.service.js';
import { adminAuth } from '../config/firebase.js';
const TOKEN_AGE = 60 * 60 * 24 * 7; // 7 ngày

export const login = async ({ email, password }) => {
  const user = await User.findOne({ email });
  if (!user) {
    const err = new Error('Sai email hoặc mật khẩu');
    err.status = 401;
    throw err;
  }

  if (user.status !== 'active') {
    // <-- thêm
    const err = new Error('Tài khoản bị khóa');
    err.status = 403;
    throw err;
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    const err = new Error('Sai email hoặc mật khẩu');
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
      passwordHash: '',
      status: 'active',
      role: 'user',
      provider: firebase?.sign_in_provider || 'firebase',
    });
  } else if (!user.name && name) {
    user.name = name; // <— cập nhật tên nếu trống
    await user.save();
  }

  const JWT_SECRET = process.env.JWT_SECRET;
  const token = jwt.sign(
    { sub: user._id.toString(), role: user.role }, // dùng sub
    JWT_SECRET,
    { expiresIn: '7d' },
  );

  return { user: sanitize(user), token }; // trả sanitize
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

  const isValid = await bcrypt.compare(otp, otpDoc.otpHash);
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

//resend otp
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

//Forgot password
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
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 phút
  const lastSentAt = new Date();

  await Otp.findOneAndUpdate(
    { email, type: 'forgot' },
    { otpHash, expiresAt, lastSentAt, usedAt: null, resetToken: null, resetTokenExpiresAt: null },
    { upsert: true, new: true },
  );

  await sendMail(email, 'Mã OTP đặt lại mật khẩu', `Mã OTP của bạn là: ${otp}`);

  return { message: 'Đã gửi OTP đặt lại mật khẩu về email' };
};

// Xác thực OTP, trả về resetToken
export const forgotVerify = async ({ email, otp }) => {
  const otpDoc = await Otp.findOne({ email, type: 'forgot' });
  if (!otpDoc || otpDoc.expiresAt < new Date() || otpDoc.usedAt) {
    throw new Error('OTP không hợp lệ hoặc đã hết hạn');
  }
  const ok = await bcrypt.compare(otp, otpDoc.otpHash);
  if (!ok) throw new Error('OTP không hợp lệ hoặc đã hết hạn');

  // Tạo resetToken ngắn hạn (random string)
  const resetToken = randomBytes(32).toString('hex'); // <-- Sửa dòng này
  const resetTokenExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 phút

  otpDoc.resetToken = resetToken;
  otpDoc.resetTokenExpiresAt = resetTokenExpiresAt;
  otpDoc.usedAt = new Date(); // đánh dấu đã dùng OTP
  await otpDoc.save();

  return { resetToken };
};

// Đổi mật khẩu bằng resetToken
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


//==================================================================================
// ULtility
//================================================================================

export const addAddress = async (userId, addressData) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  // Nếu là địa chỉ đầu tiên hoặc addressData.isDefault, set mặc định
  let isDefault = user.addresses.length === 0;
  if (addressData.isDefault === true) isDefault = true;

  if (isDefault) {
    user.addresses.forEach(addr => addr.isDefault = false);
  }

  user.addresses.push({ ...addressData, isDefault });
  await user.save();
  return {
    message: "Thêm địa chỉ thành công",
    addresses: user.addresses
  };
};

export const setDefaultAddress = async (userId, addressId) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  user.addresses = user.addresses.map(addr => ({
    ...addr.toObject(),
    isDefault: addr._id.toString() === addressId,
  }));

  await user.save();
  return user;
};
//================================================================================= 


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
  updatedAt: u.updatedAt,
});
