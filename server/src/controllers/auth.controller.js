import jwt from 'jsonwebtoken';
import * as auth from '../services/auth.service.js';
import User from '../models/User.js';

export const COOKIE_NAME = 'token';
const ONE_DAY = 1000 * 60 * 60 * 24;
const SEVEN_DAYS = ONE_DAY * 7;
const THIRTY_DAYS = ONE_DAY * 30;

const isProd = process.env.NODE_ENV === 'production';

export const baseCookieOpts = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? 'none' : 'lax',
  path: '/', // luôn có path
};

function setAuthCookie(res, token, maxAge) {
  res.cookie(COOKIE_NAME, token, {
    ...baseCookieOpts,
    path: '/',
    maxAge,
    domain: 'localhost', // thêm
  });
}

// LOGIN
export const postLogin = async (req, res, next) => {
  try {
    const { email, password, remember } = req.body;
    const { token, user } = await auth.login({ email, password });
    setAuthCookie(res, token, remember ? THIRTY_DAYS : SEVEN_DAYS);
    res.json({ user });
  } catch (e) {
    next(e);
  }
};

// ME – dùng req.user đã có từ requireAuth
export const getMe = async (req, res) => {
  return res.json({ user: req.user });
};

// LOGOUT
export const postLogout = async (req, res) => {
  res.cookie(COOKIE_NAME, '', { ...baseCookieOpts, maxAge: 0, expires: new Date(0) });
  res.setHeader('Cache-Control', 'no-store');
  return res.json({ message: 'Logged out' });
};

// REGISTER / VERIFY OTP / RESEND OTP / FORGOT...
export const postRegister = async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    const result = await auth.register({ email, password, name });
    res.json(result);
  } catch (e) {
    next(e);
  }
};

export const postVerifyOtp = async (req, res, next) => {
  try {
    const { email, otp, password, name } = req.body;
    const result = await auth.verifyOtp({ email, otp, password, name });
    res.json(result);
  } catch (e) {
    next(e);
  }
};

export const postResendOtp = async (req, res, next) => {
  try {
    const { email } = req.body;
    const result = await auth.resendOtp({ email });
    res.json(result);
  } catch (e) {
    next(e);
  }
};

export const postForgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const result = await auth.forgotPassword({ email });
    res.json(result);
  } catch (e) {
    next(e);
  }
};

export const postForgotVerify = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const result = await auth.forgotVerify({ email, otp });
    res.json(result);
  } catch (e) {
    next(e);
  }
};

export const postForgotReset = async (req, res, next) => {
  try {
    const { resetToken, newPassword } = req.body;
    const result = await auth.forgotReset({ resetToken, newPassword });
    res.json(result);
  } catch (e) {
    next(e);
  }
};

// ADD ADDRESS – dùng req.user.id
export const postAddAddress = async (req, res, next) => {
  try {
    const { address } = req.body;
    if (!address) return res.status(400).json({ message: 'Address is required' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ message: 'Unauthenticated' });

    user.address = user.address || [];
    user.address.push(address);
    await user.save();

    res.json({ user: auth.sanitize(user) });
  } catch (e) {
    next(e);
  }
};

// Firebase login (nếu dùng) – tạm thời: gọi service để khỏi phụ thuộc admin SDK ở đây
export const postFirebaseLogin = async (req, res, next) => {
  try {
    const { idToken } = req.body;
    const { user, token } = await auth.firebaseLogin({ idToken }); // triển khai trong services
    setAuthCookie(res, token, SEVEN_DAYS);
    res.json({ user });
  } catch (e) {
    next(e);
  }
};

export const postFacebookLogin = async (req, res, next) => {
  try {
    const { token } = req.body;
    const result = await auth.facebookLogin({ token });
    res.json(result);
  } catch (e) {
    next(e);
  }
};
