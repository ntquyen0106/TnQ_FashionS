import bcrypt from 'bcrypt';
import User from '../models/User.js';
import mongoose from 'mongoose';

/* -------------------- ADMIN USER MANAGEMENT SERVICES -------------------- */

export const createUser = async (data) => {
  const { name, email, password, role, status } = data;

  const existed = await User.findOne({ email });
  if (existed) {
    throw {
      status: 400,
      message: 'Email already exists',
      errors: { email: 'Email already exists' },
    };
  }

  if (!password) {
    throw {
      status: 400,
      message: 'password is required',
      errors: { password: 'Password is required' },
    };
  }
  const passwordHash = password ? await bcrypt.hash(password, 10) : undefined;
  const user = new User({
    name,
    email,
    passwordHash,
    role: role || 'user',
    status: status || 'active',
  });

  await user.save();

  return {
    message: 'User created successfully',
    data: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
    },
  };
};

//  UPDATE USER — chỉ cập nhật trường có nhập
export const updateUser = async (id, updates) => {
  if (!mongoose.isValidObjectId(id)) {
    throw { status: 400, message: 'Validation failed', errors: { id: 'User ID is invalid' } };
  }

  const allowed = ['name', 'email', 'role', 'status'];
  const payload = {};
  for (const key of allowed) {
    if (updates[key] !== undefined && updates[key] !== null && updates[key] !== '') {
      payload[key] = updates[key];
    }
  }

  try {
    const user = await User.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
      context: 'query',
    }).select('-passwordHash');

    if (!user) {
      throw { status: 404, message: 'User not found', errors: { id: 'User not found' } };
    }

    return { message: 'User updated successfully', data: user };
  } catch (error) {
    const errors = {};

    // Duplicate email
    if (error.code === 11000 && error.keyPattern?.email) {
      errors.email = 'Email already exists';
    }

    // Validation errors
    if (error.name === 'ValidationError') {
      for (const field in error.errors) {
        errors[field] = error.errors[field].message;
      }
    }

    if (Object.keys(errors).length > 0) {
      throw { status: 400, message: 'Validation failed', errors };
    }

    throw { status: 500, message: error.message };
  }
};

export const getUserById = async (id) => {
  if (!mongoose.isValidObjectId(id)) {
    throw { status: 400, message: 'Invalid user id' };
  }

  const user = await User.findById(id).select('-passwordHash');
  if (!user) {
    throw { status: 404, message: 'User not found' };
  }

  return user;
};

export const getUsers = async (query) => {
  const { name, email, role, fromDate, toDate, page = 1, limit = 10 } = query;

  const filter = {};
  if (name) filter.name = new RegExp(name, 'i');

  if (email) filter.email = new RegExp(email, 'i');
  if (role) filter.role = role;
  if (fromDate || toDate) {
    filter.createdAt = {};
    if (fromDate) filter.createdAt.$gte = new Date(fromDate);
    if (toDate) filter.createdAt.$lte = new Date(toDate);
  }

  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('-passwordHash -addresses')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    User.countDocuments(filter),
  ]);

  return {
    total,
    page: Number(page),
    limit: Number(limit),
    users,
  };
};

export const deleteUser = async (id) => {
  if (!mongoose.isValidObjectId(id)) {
    throw { status: 400, message: 'Invalid user id' };
  }

  const user = await User.findByIdAndDelete(id);
  if (!user) {
    throw { status: 404, message: 'User not found' };
  }

  return { message: 'User deleted successfully' };
};

// Utility function for sanitizing user data
export const sanitize = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  status: u.status,
  createdAt: u.createdAt,
  updatedAt: u.updatedAt,
});