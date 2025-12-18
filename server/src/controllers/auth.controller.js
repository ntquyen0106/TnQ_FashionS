import * as auth from '../services/auth.service.js';
import User from '../models/User.js';
import validator from 'validator';
import jwt from 'jsonwebtoken';

export const COOKIE_NAME = 'token';
const ONE_DAY = 1000 * 60 * 60 * 24;
const SEVEN_DAYS = ONE_DAY * 7;
const THIRTY_DAYS = ONE_DAY * 30;

const isProd = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';

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

// LOGIN - Hỗ trợ email HOẶC phone
export const postLogin = async (req, res, next) => {
  try {
    const { identifier, password, remember } = req.body; // identifier có thể là email hoặc phone

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Vui lòng nhập đầy đủ thông tin' });
    }

    const { token, user } = await auth.login({ identifier, password });
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

// Mint a short-lived token for Socket.IO auth.
// Needed in production because the app uses same-origin cookies on Vercel, while Socket.IO connects to the backend origin.
export const getSocketToken = async (req, res) => {
  const uid = req.user?._id;
  if (!uid) return res.status(401).json({ message: 'Unauthenticated' });

  const token = jwt.sign(
    { sub: String(uid), role: req.user?.role },
    process.env.JWT_SECRET,
    { expiresIn: '15m' },
  );

  return res.json({ token });
};

/* -------------------- REGISTER + OTP + PHONE VERIFICATION -------------------- */

// Bước 1: Gửi OTP qua Firebase để xác thực SĐT
export const postRegister = async (req, res, next) => {
  try {
    const { phoneNumber, email, password, confirmPassword, name } = req.body;

    const result = await auth.register({
      phoneNumber,
      email,
      password,
      confirmPassword,
      name,
    });

    res.json(result);
  } catch (e) {
    // Service trả về lỗi validation với errors object
    if (e.status === 400 && e.errors) {
      return res.status(400).json({
        message: e.message,
        errors: e.errors,
      });
    }
    next(e);
  }
};

// Bước 2: Xác thực Firebase ID Token từ client sau khi user nhập OTP
export const postVerifyPhone = async (req, res, next) => {
  try {
    const { firebaseIdToken, phoneNumber, email, password, name } = req.body;

    const result = await auth.verifyPhoneAndCreateUser({
      firebaseIdToken,
      phoneNumber,
      email,
      password,
      name,
    });

    // Set cookie sau khi tạo user thành công
    setAuthCookie(res, result.token, SEVEN_DAYS);

    res.json(result);
  } catch (e) {
    // Service trả về lỗi validation với errors object
    if (e.status && e.errors) {
      return res.status(e.status).json({
        message: e.message,
        errors: e.errors,
      });
    }
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

export const postForgotVerifyPhone = async (req, res, next) => {
  try {
    const { firebaseIdToken, phoneNumber } = req.body;
    const result = await auth.forgotVerifyPhone({ firebaseIdToken, phoneNumber });
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

/* -------------------- FIRST-LOGIN PASSWORD CHANGE -------------------- */
export const postChangePasswordFirst = async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ message: 'Mật khẩu mới phải >= 6 ký tự' });
    }
    const result = await auth.changePasswordFirst({ userId: req.user._id, newPassword });
    res.json(result);
  } catch (e) {
    next(e);
  }
};

/* -------------------- ADD PHONE TO GOOGLE USER -------------------- */

export const postAddPhoneToGoogleUser = async (req, res, next) => {
  try {
    const { firebaseIdToken, phoneNumber } = req.body;
    // req.user được gán từ requireAuth -> chứa _id của user hiện tại
    const userId = req.user._id;
    console.log('Adding phone to Google user:', { userId, phoneNumber });
    const result = await auth.addPhoneToGoogleUser({ userId, firebaseIdToken, phoneNumber });
    res.json(result);
  } catch (e) {
    if (e.errors) {
      return res.status(e.status || 400).json({
        message: e.message,
        errors: e.errors,
      });
    }
    next(e);
  }
};

/* -------------------- SOCIAL LOGINS -------------------- */

// Firebase (Google)
export const postFirebaseLogin = async (req, res, next) => {
  try {
    const { idToken } = req.body;

    const result = await auth.firebaseLogin({ idToken });

    setAuthCookie(res, result.token, SEVEN_DAYS);

    res.json({
      user: result.user,
      requiresPhone: result.requiresPhone || false, // FE dùng để biết có cần yêu cầu thêm SĐT không
      message: result.message,
    });
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
export const putChangePassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { oldPassword, newPassword, confirmNewPassword } = req.body;

    const result = await auth.changePassword(id, {
      oldPassword,
      newPassword,
      confirmNewPassword,
    });

    return res.json(result);
  } catch (err) {
    console.error('Change password error:', err);

    return res.status(err.status || 500).json({
      message: err.message || 'Internal server error',
      errors: err.errors || null,
    });
  }
};

export const postAddAddress = async (req, res, next) => {
  try {
    const result = await auth.addAddress(req.user._id, req.body.address);
    res.json(result); // result: { message, addresses }
  } catch (e) {
    next(e);
  }
};

export const postSetDefaultAddress = async (req, res, next) => {
  try {
    const user = await auth.setDefaultAddress(req.user._id, req.body.addressId);
    res.json({ addresses: user.addresses });
  } catch (e) {
    next(e);
  }
};

export const getAddresses = async (req, res, next) => {
  try {
    const list = await auth.getAddresses(req.user._id);
    res.json({ addresses: list });
  } catch (e) {
    next(e);
  }
};

export const putUpdateAddress = async (req, res, next) => {
  try {
    const { addressId } = req.params;
    const result = await auth.updateAddress(req.user._id, addressId, req.body);
    res.json(result);
  } catch (e) {
    next(e);
  }
};

export const deleteAddress = async (req, res, next) => {
  try {
    const { addressId } = req.params;
    const result = await auth.deleteAddress(req.user._id, addressId);
    res.json(result);
  } catch (e) {
    next(e);
  }
};

export const clearAddresses = async (req, res, next) => {
  try {
    const result = await auth.clearAddresses(req.user._id);
    res.json(result);
  } catch (e) {
    next(e);
  }
};

//-------------------- ADMIN UTILITIES --------------------

export const postCreateUser = async (req, res) => {
  try {
    const result = await auth.createUser(req.body);
    return res.status(201).json(result);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const errors = {};
      for (const key in err.errors) {
        errors[key] = err.errors[key].message;
      }
      return res.status(400).json({
        message: 'Validation failed',
        errors,
      });
    }
    return res.status(err.status || 500).json({ message: err.message, errors: err.errors || null });
  }
};

export const putUpdateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await auth.updateUser(id, req.body);
    return res.status(200).json(result);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const errors = {};
      for (const key in err.errors) {
        errors[key] = err.errors[key].message;
      }
      return res.status(400).json({
        message: 'Validation failed',
        errors,
      });
    }
    return res.status(err.status || 500).json({ message: err.message, errors: err.errors || null });
  }
};

export const getUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await auth.getUserById(id);
    return res.json(user);
  } catch (err) {
    return res.status(err.status).json({ message: err.message });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const result = await auth.getUsers(req.query);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message, errors: err.errors || null });
  }
};

export const deleteOneUser = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await auth.deleteUser(id);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message, errors: err.errors || null });
  }
};

// ---- Profile update (name, maybe phone later) ----
export const putProfile = async (req, res, next) => {
  try {
    const { name, email } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (typeof name === 'string' && name.trim()) {
      user.name = name.trim();
    }

    if (typeof email === 'string' && email.trim()) {
      const emailNorm = email.trim().toLowerCase();
      if (!validator.isEmail(emailNorm)) {
        return res.status(400).json({ message: 'Email không hợp lệ' });
      }
      const exists = await User.findOne({ email: emailNorm, _id: { $ne: user._id } });
      if (exists) {
        return res.status(409).json({ message: 'Email đã được sử dụng' });
      }
      user.email = emailNorm;
    }

    await user.save();
    res.json({ user: { _id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (e) {
    next(e);
  }
};
