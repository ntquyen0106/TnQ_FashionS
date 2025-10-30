import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema({
  email: String,
  phoneNumber: String,
  otpHash: String, // hash OTP
  passwordHash: String, // hash password tạm (nếu cần)
  name: String,
  expiresAt: Date,
  lastSentAt: Date,
  usedAt: Date, // đánh dấu đã dùng
  type: { type: String, default: 'register' }, // "register" hoặc "forgot"
  resetToken: String,
  resetTokenExpiresAt: Date,
});

export default mongoose.model('Otp', otpSchema);
