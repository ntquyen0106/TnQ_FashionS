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
  // ❗ Thường KHÔNG cần 'domain' ở localhost. Nếu bạn gặp vấn đề cookie không hiện,
  // có thể mở comment dòng dưới:
  // domain: "localhost",
};

function setAuthCookie(res, token, maxAge) {
  res.cookie(COOKIE_NAME, token, { ...baseCookieOpts, maxAge });
}

/* -------------------- AUTH CORE -------------------- */

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

// LOGOUT
export const postLogout = async (req, res) => {
  res.cookie(COOKIE_NAME, '', { ...baseCookieOpts, maxAge: 0, expires: new Date(0) });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ message: 'Logged out' });
};

// ME (đã có requireAuth ở routes nên dùng req.user)
export const getMe = async (req, res) => {
  return res.json({ user: req.user });
};

/* -------------------- REGISTER + OTP -------------------- */

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

/* -------------------- FORGOT PASSWORD FLOW -------------------- */

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

/* -------------------- SOCIAL LOGINS -------------------- */

// Firebase (Google)
export const postFirebaseLogin = async (req, res, next) => {
  try {
    const { idToken } = req.body;

    // ⚠️ đảm bảo bạn có export hàm 'firebaseLogin' trong services/auth.service.js
    // (đúng tên như dưới). Nếu bạn đã viết tên khác như 'firebaseSocialLogin'
    // thì đổi về 'firebaseLogin' hoặc sửa dòng gọi này cho khớp.
    const { user, token } = await auth.firebaseLogin({ idToken });

    setAuthCookie(res, token, SEVEN_DAYS);
    res.json({ user });
  } catch (e) {
    next(e);
  }
};

// Facebook
export const postFacebookLogin = async (req, res, next) => {
  try {
    const { token } = req.body;
    const result = await auth.facebookLogin({ token });
    // Nếu bạn cũng muốn set cookie sau facebookLogin:
    // setAuthCookie(res, result.token, SEVEN_DAYS);
    res.json(result);
  } catch (e) {
    next(e);
  }
};

/* -------------------- USER UTILITIES -------------------- */

export const postAddAddress = async (req, res, next) => {
  try {
    const user = await auth.addAddress(req.user._id, req.body.address);
    res.json({ user: auth.sanitize(user) });
  } catch (e) {
    next(e);
  }
};

export const postSetDefaultAddress = async (req, res, next) => {
  try {
    const user = await auth.setDefaultAddress(req.user._id, req.body.addressId);
    res.json({ user: auth.sanitize(user) });
  } catch (e) {
    next(e);
  }
};
