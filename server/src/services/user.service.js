import bcrypt from 'bcrypt';
import User from '../models/User.js';
import mongoose from 'mongoose';

/* -------------------- USER PROFILE & ADDRESS SERVICES -------------------- */

export const addAddress = async (userId, addressData) => {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  // Nếu là địa chỉ đầu tiên hoặc addressData.isDefault, set mặc định
  let isDefault = user.addresses.length === 0;
  if (addressData.isDefault === true) isDefault = true;

  if (isDefault) {
    user.addresses.forEach((addr) => (addr.isDefault = false));
  }

  user.addresses.push({ ...addressData, isDefault });
  await user.save();
  return {
    message: 'Thêm địa chỉ thành công',
    addresses: user.addresses,
  };
};

export const setDefaultAddress = async (userId, addressId) => {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  user.addresses = user.addresses.map((addr) => ({
    ...addr.toObject(),
    isDefault: addr._id.toString() === addressId,
  }));

  await user.save();
  return user;
};

export const getAddresses = async (userId) => {
  const user = await User.findById(userId).select('addresses').lean();
  if (!user) throw { status: 404, message: 'User not found' };
  return user.addresses || [];
};

export const updateAddress = async (userId, addressId, data) => {
  const user = await User.findById(userId);
  if (!user) throw { status: 404, message: 'User not found' };
  const addr = user.addresses.id(addressId);
  if (!addr) throw { status: 404, message: 'Address not found' };

  const allowed = ['fullName', 'phone', 'line1', 'ward', 'district', 'city', 'isDefault'];
  for (const k of allowed) if (k in data) addr[k] = data[k];

  // nếu đặt mặc định
  if (data.isDefault === true) {
    user.addresses.forEach((a) => {
      if (String(a._id) !== String(addressId)) a.isDefault = false;
    });
  }

  await user.save();
  return { message: 'Address updated', addresses: user.addresses };
};

export const deleteAddress = async (userId, addressId) => {
  const user = await User.findById(userId);
  if (!user) throw { status: 404, message: 'User not found' };
  const addr = user.addresses.id(addressId);
  if (!addr) throw { status: 404, message: 'Address not found' };
  addr.deleteOne();
  await user.save();
  return { message: 'Address deleted', addresses: user.addresses };
};

export const clearAddresses = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw { status: 404, message: 'User not found' };
  user.addresses = [];
  await user.save();
  return { message: 'All addresses deleted', addresses: [] };
};

export const changePassword = async (id, { oldPassword, newPassword }) => {
  // --- Validation ---
  const errors = {};

  if (!id || !mongoose.isValidObjectId(id)) {
    errors.id = 'ID người dùng không hợp lệ';
  }
  if (!oldPassword) {
    errors.oldPassword = 'Vui lòng nhập mật khẩu cũ';
  }
  if (!newPassword) {
    errors.newPassword = 'Vui lòng nhập mật khẩu mới';
  } else if (newPassword.length < 6) {
    errors.newPassword = 'Mật khẩu mới phải có ít nhất 6 ký tự';
  }

  // --- Kiểm tra user tồn tại ---
  const user = await User.findById(id);
  if (!user) {
    throw {
      status: 404,
      message: 'Không tìm thấy người dùng',
      errors: { id: 'Không tìm thấy người dùng' },
    };
  }

  // --- Kiểm tra user có password không (không phải đăng nhập bằng Google) ---
  if (!user.passwordHash) {
    throw {
      status: 400,
      message: 'Không thể đổi mật khẩu cho tài khoản đăng nhập bằng Google',
      errors: { oldPassword: 'Tài khoản này đăng nhập bằng Google' },
    };
  }

  // --- Kiểm tra mật khẩu cũ ---
  const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!isMatch) {
    throw {
      status: 400,
      message: 'Mật khẩu cũ không chính xác',
      errors: { oldPassword: 'Mật khẩu cũ không chính xác' },
    };
  }

  // --- Kiểm tra mật khẩu mới phải khác mật khẩu cũ ---
  if (newPassword === oldPassword) {
    throw {
      status: 400,
      message: 'Mật khẩu mới phải khác mật khẩu cũ',
      errors: { newPassword: 'Mật khẩu mới phải khác mật khẩu cũ' },
    };
  }

  if (Object.keys(errors).length > 0) {
    throw { status: 400, message: 'Dữ liệu không hợp lệ', errors };
  }

  // --- Hash và lưu ---
  const hashed = await bcrypt.hash(newPassword, 10);
  user.passwordHash = hashed;
  user.mustChangePassword = false;
  user.passwordChangedAt = new Date();
  await user.save();

  return { message: 'Đổi mật khẩu thành công' };
};
