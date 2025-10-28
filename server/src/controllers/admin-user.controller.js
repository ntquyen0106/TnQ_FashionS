import * as adminUserService from '../services/admin-user.service.js';
import Otp from '../models/Otp.js';
import { randomBytes } from 'crypto';
import { sendMail } from '../services/mail.service.js';

/* -------------------- ADMIN USER MANAGEMENT -------------------- */

export const postCreateUser = async (req, res) => {
  try {
    const result = await adminUserService.createUser(req.body);
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
    return res.status(err.status || 500).json({
      message: err.message,
      errors: err.errors || null,
    });
  }
};

export const putUpdateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await adminUserService.updateUser(id, req.body);
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
    return res.status(err.status || 500).json({
      message: err.message,
      errors: err.errors || null,
    });
  }
};

export const getUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await adminUserService.getUserById(id);
    return res.json(user);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const result = await adminUserService.getUsers(req.query);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(err.status || 500).json({
      message: err.message,
      errors: err.errors || null,
    });
  }
};

export const deleteOneUser = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await adminUserService.deleteUser(id);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(err.status || 500).json({
      message: err.message,
      errors: err.errors || null,
    });
  }
};

// Send one-click reset password link to a user (admin action)
export const postSendSetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    // reuse service to fetch user (will throw if not found)
    const user = await adminUserService.getUserById(id);

    // generate a secure reset token
    const resetToken = randomBytes(32).toString('hex');
    const resetTokenExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // upsert into Otp collection for forgot type
    await Otp.findOneAndUpdate(
      { email: user.email, type: 'forgot' },
      { resetToken, resetTokenExpiresAt, lastSentAt: new Date(), usedAt: null },
      { upsert: true, new: true },
    );

    const frontendUrl =
      process.env.FRONTEND_URL || process.env.CLIENT_ORIGIN || 'http://localhost:5173';
    const base = frontendUrl.replace(/\/$/, '');
    // Client route is /forgot/reset and expects query param 'resetToken'
    const link = `${base}/forgot/reset?resetToken=${resetToken}`;

    const subject = 'Link đặt lại mật khẩu - TnQ Fashion';
    const html = `
      <p>Xin chào ${user.name || ''},</p>
      <p>Quản trị viên đã gửi yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Nhấn vào liên kết bên dưới để đặt mật khẩu mới (hết hạn trong 10 phút):</p>
      <p><a href="${link}">${link}</a></p>
      <p>Nếu bạn không yêu cầu thay đổi này, vui lòng bỏ qua email.</p>
    `;

    await sendMail(user.email, subject, `Link đặt lại mật khẩu: ${link}`, html);

    return res.status(200).json({ message: 'Đã gửi link đặt lại mật khẩu tới email người dùng.' });
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
  }
};
