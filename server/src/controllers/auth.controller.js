import { adminAuth } from '../config/firebase.js';
import * as auth from '../services/auth.service.js';
import User from "../models/User.js";
import jwt from "jsonwebtoken";

export const COOKIE_NAME = "token";

const ONE_DAY = 1000 * 60 * 60 * 24;
const SEVEN_DAYS = ONE_DAY * 7;
const THIRTY_DAYS = ONE_DAY * 30;

export const baseCookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
};

// LOGIN
export const postLogin = async (req, res, next) => {
  try {
    const { email, password, remember } = req.body;
    const { token, user } = await auth.login({ email, password });
    const maxAge = remember ? THIRTY_DAYS : SEVEN_DAYS;

    // ✅ thêm path:"/" và dùng baseCookieOpts + COOKIE_NAME
    res.cookie(COOKIE_NAME, token, { ...baseCookieOpts, path: "/", maxAge });

    res.json({ user });
  } catch (e) { next(e); }
};

// REGISTER
export const postRegister = async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    const result = await auth.register({ email, password, name });
    res.json(result);
  } catch (e) { next(e); }
};

// VERIFY OTP
export const postVerifyOtp = async (req, res, next) => {
  try {
    const { email, otp, password, name } = req.body;
    const result = await auth.verifyOtp({ email, otp, password, name });
    res.json(result);
  } catch (e) { next(e); }
};

// ADD ADDRESS (nếu chưa dùng thì có thể comment)
export const postAddAddress = async (req, res, next) => {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return res.status(401).json({ message: "Unauthenticated" });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ message: "Unauthenticated" });

    const { address } = req.body;
    if (!address) return res.status(400).json({ message: "Address is required" });

    user.address = user.address || [];
    user.address.push(address);
    await user.save();

    res.json({ user: auth.sanitize(user) });
  } catch (e) { next(e); }
};

// GET ME
export const getMe = async (req, res, next) => {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return res.status(401).json({ message: "Unauthenticated" });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const me = await User.findById(payload.sub);
    if (!me) return res.status(401).json({ message: "Unauthenticated" });
    res.json({ user: auth.sanitize(me) });
  } catch (e) { next(e); }
};

//Login bằng firebase
export const postFirebaseLogin = async (req, res, next) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ message: 'Missing idToken' });

    // Xác thực token với Firebase
    const decoded = await adminAuth.verifyIdToken(idToken);

    // Lấy thông tin user từ Firebase
    const { email, name, uid, picture } = decoded;

    // Tìm hoặc tạo user trong MongoDB
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        email,
        name: name || 'No Name',
        passwordHash: uid, // Có thể random hoặc để uid, vì không dùng password
        avatar: picture,
        role: 'user',
        status: 'active',
      });
    }

    // Tạo JWT cho client
    const token = jwt.sign({ sub: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: 60 * 60 * 24 * 7,
    });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    res.json({ user: auth.sanitize(user) });
  } catch (e) {
    next(e);
  }
};

//Login by Facebook
export const postFacebookLogin = async (req, res, next) => {
  try {
    const { token } = req.body;
    const result = await auth.facebookLogin({ token });
    res.json(result);
  } catch (e) { next(e); }
};

//Resend OTP
export const postResendOtp = async (req, res, next) => {
  try {
    const { email } = req.body;
    const result = await auth.resendOtp({ email });
    res.json(result);
  } catch (e) { next(e); }
};

export const postLogout = async (req, res) => {
  // ❌ bỏ clearCookie(...cookieOpts) cũ
  // ✅ đặt trống + maxAge 0 + expires về 0 và giữ y chang các option khi set
  res.cookie(COOKIE_NAME, "", {
    ...baseCookieOpts,
    path: "/",            // phải trùng với lúc set
    maxAge: 0,
    expires: new Date(0),
  });
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ message: "Logged out" });
};

export const postForgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const result = await auth.forgotPassword({ email });
    res.json(result);
  } catch (e) { next(e); }
};

export const postForgotVerify = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const result = await auth.forgotVerify({ email, otp });
    res.json(result);
  } catch (e) { next(e); }
};

export const postForgotReset = async (req, res, next) => {
  try {
    const { resetToken, newPassword } = req.body;
    const result = await auth.forgotReset({ resetToken, newPassword });
    res.json(result);
  } catch (e) { next(e); }
};