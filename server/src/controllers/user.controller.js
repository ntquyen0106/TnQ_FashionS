import * as userService from '../services/user.service.js';
import User from '../models/User.js';
import validator from 'validator';

/* -------------------- USER PROFILE MANAGEMENT -------------------- */

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-passwordHash -__v').lean();
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json({ user });
  } catch (err) {
    console.error('Get profile error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const putChangePassword = async (req, res) => {
  try {
    const id = req.user._id;
    const { oldPassword, newPassword, confirmNewPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'Mật khẩu mới phải >= 6 ký tự' });
    }
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ message: 'Xác nhận mật khẩu không khớp' });
    }

    const result = await userService.changePassword(id, { oldPassword, newPassword });
    return res.json(result);
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(err.status || 500).json({
      message: err.message || 'Internal server error',
      errors: err.errors || null,
    });
  }
};

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

/* -------------------- ADDRESS MANAGEMENT -------------------- */

export const postAddAddress = async (req, res, next) => {
  try {
    const result = await userService.addAddress(req.user._id, req.body.address);
    res.json(result);
  } catch (e) {
    next(e);
  }
};

export const postSetDefaultAddress = async (req, res, next) => {
  try {
    const addressId = req.params.addressId; // Get from URL params for PATCH /addresses/:addressId/default
    const user = await userService.setDefaultAddress(req.user._id, addressId);
    res.json({ addresses: user.addresses });
  } catch (e) {
    next(e);
  }
};

export const getAddresses = async (req, res, next) => {
  try {
    const list = await userService.getAddresses(req.user._id);
    res.json({ addresses: list });
  } catch (e) {
    next(e);
  }
};

export const putUpdateAddress = async (req, res, next) => {
  try {
    const { addressId } = req.params;
    const result = await userService.updateAddress(req.user._id, addressId, req.body);
    res.json(result);
  } catch (e) {
    next(e);
  }
};

export const deleteAddress = async (req, res, next) => {
  try {
    const { addressId } = req.params;
    const result = await userService.deleteAddress(req.user._id, addressId);
    res.json(result);
  } catch (e) {
    next(e);
  }
};

export const clearAddresses = async (req, res, next) => {
  try {
    const result = await userService.clearAddresses(req.user._id);
    res.json(result);
  } catch (e) {
    next(e);
  }
};

/* -------------------- ADMIN USER MANAGEMENT REMOVED -------------------- */
