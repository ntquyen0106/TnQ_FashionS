import mongoose from "mongoose";

const otpSchema = new mongoose.Schema({
  email: String,
  otpHash: String,      // nên lưu hash OTP
  passwordHash: String, // hash password tạm
  name: String,
  expiresAt: Date,
  lastSentAt: Date,
  usedAt: Date,         // đánh dấu đã dùng
});


export default mongoose.model("Otp", otpSchema);
