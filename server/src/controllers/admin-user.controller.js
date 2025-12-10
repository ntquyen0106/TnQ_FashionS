import * as adminUserService from '../services/admin-user.service.js';
import { getOnlineStats } from '../config/socket.js';
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

    const pickFrontendUrl = () => {
      const sources = [process.env.FRONTEND_URL, process.env.CLIENT_URL, process.env.CLIENT_ORIGIN];
      for (const raw of sources) {
        if (!raw) continue;
        const first = String(raw).split(',')[0].trim();
        if (first) return first.replace(/\/$/, '');
      }
      return 'http://localhost:5173';
    };

    const base = pickFrontendUrl();
    // Client route is /forgot/reset and expects query param 'resetToken'
    const link = `${base}/forgot/reset?resetToken=${resetToken}`;

    const subject = 'Link đặt lại mật khẩu - TnQ Fashion';
    const html = `
      <p>Xin chào ${user.name || ''},</p>
      <p>Quản trị viên đã gửi yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Nhấn vào liên kết bên dưới để đặt mật khẩu mới (hết hạn trong 10 phút):</p>
      <p><a href="${link}">${link}</a></p>
      <p>Nếu bạn không yêu cầu thay đổi này, vui lòng bỏ qua email.</p>
    `;

    try {
      await sendMail(user.email, subject, `Link đặt lại mật khẩu: ${link}`, html);
      return res
        .status(200)
        .json({ message: 'Đã gửi link đặt lại mật khẩu tới email người dùng.' });
    } catch (mailErr) {
      console.error('Send set-password mail failed:', mailErr?.message || mailErr);
      // Không chặn thao tác, trả về 202 để FE hiển thị cảnh báo nhưng không timeout
      return res
        .status(202)
        .json({ message: 'Tạo link thành công nhưng gửi email thất bại, thử lại sau.' });
    }
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
  }
};

/* -------------------- USER ANALYTICS -------------------- */

/* ==================== USER ANALYTICS CONTROLLERS ==================== */

/**
 * 1. Thống kê user mới theo thời gian (today, 7days, thisMonth, custom)
 * GET /api/admin/users/analytics/new-users?period=today|7days|thisMonth|custom&from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export const getNewUsersByTime = async (req, res) => {
  try {
    const { period, from, to } = req.query;
    const data = await adminUserService.getNewUsersByTime({ period, from, to });
    return res.status(200).json(data);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
  }
};

/**
 * 2. Tổng quan hệ thống user (totalUsers, phoneVerifiedUsers, phoneUnverifiedUsers)
 * GET /api/admin/users/analytics/overview
 */
export const getUsersOverview = async (req, res) => {
  try {
    const data = await adminUserService.getUsersOverview();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
  }
};

/**
 * 2.5. Top khách hàng mua nhiều nhất
 * GET /api/admin/users/analytics/top-customers?limit=10&from=YYYY-MM-DD&to=YYYY-MM-DD&sortBy=revenue|orders|avgOrder
 */
export const getTopCustomers = async (req, res) => {
  try {
    const { limit, from, to, sortBy } = req.query;
    const data = await adminUserService.getTopCustomers({ limit, from, to, sortBy });
    return res.status(200).json(data);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
  }
};

/**
 * 3. Heatmap thời gian hoạt động (Login Activity Heatmap)
 * GET /api/admin/users/analytics/login-heatmap?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export const getLoginHeatmap = async (req, res) => {
  try {
    const { from, to } = req.query;
    const data = await adminUserService.getLoginHeatmap({ from, to });
    return res.status(200).json(data);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
  }
};

/**
 * 4. Thống kê địa lý (user thường ở đâu khi đặt hàng)
 * GET /api/admin/users/analytics/geography?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export const getUsersByGeography = async (req, res) => {
  try {
    const { from, to } = req.query;
    const data = await adminUserService.getUsersByGeography({ from, to });
    return res.status(200).json(data);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
  }
};

/**
 * 5. Real-time online users (Socket.IO)
 * GET /api/admin/users/analytics/online
 */
export const getOnlineUsers = async (req, res) => {
  try {
    const data = getOnlineStats();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
  }
};
