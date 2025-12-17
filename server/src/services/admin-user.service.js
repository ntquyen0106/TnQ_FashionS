import bcrypt from 'bcrypt';
import User from '../models/User.js';
import Order from '../models/Order.js';
import mongoose from 'mongoose';
import validator from 'validator';
import { sendWelcomeEmail } from './mail.service.js';
import { randomBytes } from 'crypto';

/* -------------------- CONSTANTS -------------------- */

const DEFAULT_PASSWORD = null; // no longer used as a fixed default

function generateTempPassword(length = 8) {
  const bytes = randomBytes(length);
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

/* -------------------- VALIDATION FUNCTIONS -------------------- */

const validateUserData = async (data, isUpdate = false, currentUserId = null) => {
  const errors = {};
  const { name, email, phoneNumber, role, status } = data;

  // Validate name
  const regex = /^[a-zA-ZÀ-ỹ\s]+$/;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.name = 'Tên không được để trống';
  } else if (name.trim().length < 2) {
    errors.name = 'Tên phải có ít nhất 2 ký tự';
  } else if (name.trim().length > 50) {
    errors.name = 'Tên không được quá 50 ký tự';
  } else if (!regex.test(name.trim())) {
    errors.name = 'Tên chỉ được chứa chữ cái và khoảng trắng';
  }

  // Validate phoneNumber
  if (!phoneNumber || typeof phoneNumber !== 'string' || phoneNumber.trim().length === 0) {
    errors.phoneNumber = 'Số điện thoại không được để trống';
  } else {
    const phoneRegex = /^(0[3|5|7|8|9])[0-9]{8}$/;
    if (!phoneRegex.test(phoneNumber.trim())) {
      errors.phoneNumber = 'Số điện thoại không hợp lệ';
    } else {
      // Check phone exists
      try {
        const query = { phoneNumber: phoneNumber.trim() };
        if (isUpdate && currentUserId) {
          query._id = { $ne: currentUserId };
        }
        const existedUser = await User.findOne(query);
        if (existedUser) {
          errors.phoneNumber = isUpdate
            ? 'Số điện thoại đã tồn tại'
            : 'Số điện thoại đã tồn tại';
        }
      } catch (error) {
        errors.phoneNumber = 'Lỗi kiểm tra số điện thoại';
      }
    }
  }

  // Validate email
  if (!email || typeof email !== 'string' || email.trim().length === 0) {
    errors.email = 'Email không được để trống';
  } else {
    if (!validator.isEmail(email.trim())) {
      errors.email = 'Email không hợp lệ';
    } else {
      // Check email exists
      try {
        const query = { email: email.trim().toLowerCase() };
        if (isUpdate && currentUserId) {
          query._id = { $ne: currentUserId };
        }
        const existedUser = await User.findOne(query);
        if (existedUser) {
          errors.email = isUpdate
            ? 'Email này đã được sử dụng bởi user khác'
            : 'Email đã tồn tại trong hệ thống';
        }
      } catch (error) {
        errors.email = 'Lỗi kiểm tra email';
      }
    }
  }

  // Validate role
  const validRoles = ['user', 'staff', 'admin'];
  if (role && !validRoles.includes(role) && role !== undefined) {
    errors.role = 'Role chỉ được là user, staff hoặc admin';
  } else if (role === '' || role === null) {
    errors.role = 'Role không được để trống';
  }

  // Validate status
  const validStatuses = ['active', 'banned'];
  if (status && !validStatuses.includes(status)) {
    errors.status = 'Status chỉ được là active hoặc banned';
  } else if (status === '' || status === null) {
    errors.status = 'Status không được để trống';
  }

  return errors;
};

/* -------------------- ADMIN USER MANAGEMENT SERVICES -------------------- */

export const createUser = async (data) => {
  const { name, email, phoneNumber, role, status } = data;

  // Validate input data (bao gồm cả check email và phone trùng)
  const validationErrors = await validateUserData(data);
  if (Object.keys(validationErrors).length > 0) {
    throw {
      status: 400,
      message: 'Dữ liệu không hợp lệ',
      errors: validationErrors,
    };
  }

  // Generate a temporary password and require first-change on login
  const tempPassword = generateTempPassword(8);

  // Create user with validated data
  const user = new User({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phoneNumber: phoneNumber.trim(),
    passwordHash: await bcrypt.hash(tempPassword, 10),
    role: role || 'user',
    status: status || 'active',
    mustChangePassword: true,
  });

  await user.save();

  // Send welcome email to new user with temp password
  // Gửi email nền để không làm chậm phản hồi API; log nếu thất bại
  sendWelcomeEmail(user.email, user.name, tempPassword).catch((err) => {
    console.error('Welcome email failed (non-blocking):', err?.message || err);
  });

  return {
    message: 'Tạo người dùng thành công. Đã gửi mật khẩu tạm và link đăng nhập tới email.',
    data: {
      id: user._id,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    },
  };
};

const validateUpdateData = async (updates, currentUserId) => {
  const errors = {};
  const { name, email, phoneNumber, role, status } = updates;
  const regex = /^[a-zA-ZÀ-ỹ\s]+$/;

  // Validate name if provided
  if (name !== undefined) {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      errors.name = 'Tên không được để trống';
    } else if (name.trim().length < 2) {
      errors.name = 'Tên phải có ít nhất 2 ký tự';
    } else if (name.trim().length > 50) {
      errors.name = 'Tên không được quá 50 ký tự';
    } else if (!regex.test(name.trim())) {
      errors.name = 'Tên chỉ được chứa chữ cái và khoảng trắng';
    }
  }

  // Validate phoneNumber if provided
  if (phoneNumber !== undefined) {
    if (!phoneNumber || typeof phoneNumber !== 'string' || phoneNumber.trim().length === 0) {
      errors.phoneNumber = 'Số điện thoại không được để trống';
    } else {
      const phoneRegex = /^(0[3|5|7|8|9])[0-9]{8}$/;
      if (!phoneRegex.test(phoneNumber.trim())) {
        errors.phoneNumber = 'Số điện thoại không hợp lệ';
      } else {
        // Check phone exists for other users
        try {
          const existedUser = await User.findOne({
            phoneNumber: phoneNumber.trim(),
            _id: { $ne: currentUserId },
          });
          if (existedUser) {
            errors.phoneNumber = 'Số điện thoại đã tồn tại';
          }
        } catch (error) {
          errors.phoneNumber = 'Lỗi kiểm tra số điện thoại';
        }
      }
    }
  }

  // Validate email if provided
  if (email !== undefined) {
    if (!email || typeof email !== 'string' || email.trim().length === 0) {
      errors.email = 'Email không được để trống';
    } else {
      if (!validator.isEmail(email.trim())) {
        errors.email = 'Email không hợp lệ';
      } else {
        // Check email exists for other users
        try {
          const existedUser = await User.findOne({
            email: email.trim().toLowerCase(),
            _id: { $ne: currentUserId },
          });
          if (existedUser) {
            errors.email = 'Email này đã được sử dụng bởi user khác';
          }
        } catch (error) {
          errors.email = 'Lỗi kiểm tra email';
        }
      }
    }
  }

  // Validate role if provided
  if (role !== undefined) {
    const validRoles = ['user', 'staff', 'admin'];
    if (!role || !validRoles.includes(role)) {
      errors.role = 'Role chỉ được là user, staff hoặc admin';
    }
  }

  // Validate status if provided
  if (status !== undefined) {
    const validStatuses = ['active', 'banned'];
    if (!status || !validStatuses.includes(status)) {
      errors.status = 'Status chỉ được là active hoặc banned';
    }
  }

  return errors;
};

const checkDataChanges = (currentUser, updates) => {
  const changes = {};
  let hasChanges = false;

  if (updates.name && updates.name.trim() !== currentUser.name) {
    changes.name = updates.name.trim();
    hasChanges = true;
  }

  if (updates.email && updates.email.trim().toLowerCase() !== currentUser.email) {
    changes.email = updates.email.trim().toLowerCase();
    hasChanges = true;
  }

  if (updates.phoneNumber && updates.phoneNumber.trim() !== currentUser.phoneNumber) {
    changes.phoneNumber = updates.phoneNumber.trim();
    hasChanges = true;
  }

  if (updates.role && updates.role !== currentUser.role) {
    changes.role = updates.role;
    hasChanges = true;
  }

  if (updates.status && updates.status !== currentUser.status) {
    changes.status = updates.status;
    hasChanges = true;
  }

  return { changes, hasChanges };
};

//  UPDATE USER — với validation đầy đủ
export const updateUser = async (id, updates) => {
  // Validate user ID
  if (!mongoose.isValidObjectId(id)) {
    throw {
      status: 400,
      message: 'ID người dùng không hợp lệ',
      errors: { id: 'User ID không hợp lệ' },
    };
  }

  // Find current user first
  const currentUser = await User.findById(id);
  if (!currentUser) {
    throw {
      status: 404,
      message: 'Không tìm thấy người dùng',
      errors: { id: 'User không tồn tại' },
    };
  }

  // Validate input data (bao gồm cả check email trùng)
  const validationErrors = await validateUpdateData(updates, id);
  if (Object.keys(validationErrors).length > 0) {
    throw {
      status: 400,
      message: 'Dữ liệu không hợp lệ',
      errors: validationErrors,
    };
  }

  // Check for actual changes
  const { changes, hasChanges } = checkDataChanges(currentUser, updates);

  if (!hasChanges) {
    throw {
      status: 400,
      message: 'Không có thay đổi nào',
      errors: { general: 'Dữ liệu mới phải khác với dữ liệu hiện tại' },
    };
  }

  try {
    // Update user with only changed fields
    const updatedUser = await User.findByIdAndUpdate(id, changes, {
      new: true,
      runValidators: true,
      context: 'query',
    }).select('-passwordHash');

    return {
      message: 'Cập nhật người dùng thành công',
      data: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        phoneNumber: updatedUser.phoneNumber,
        role: updatedUser.role,
        status: updatedUser.status,
        updatedAt: updatedUser.updatedAt,
      },
    };
  } catch (error) {
    const errors = {};

    // Duplicate email error
    if (error.code === 11000 && error.keyPattern?.email) {
      errors.email = 'Email đã tồn tại trong hệ thống';
    }

    // Duplicate phone error
    if (error.code === 11000 && error.keyPattern?.phoneNumber) {
      errors.phoneNumber = 'Số điện thoại đã tồn tại trong hệ thống';
    }

    // Mongoose validation errors
    if (error.name === 'ValidationError') {
      for (const field in error.errors) {
        errors[field] = error.errors[field].message;
      }
    }

    if (Object.keys(errors).length > 0) {
      throw { status: 400, message: 'Lỗi validation', errors };
    }

    throw { status: 500, message: 'Lỗi server: ' + error.message };
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
  const {
    // Search parameters
    search,
    name,
    email,
    phoneNumber,
    role,
    status,
    excludeRole,
    excludeRoles,
    fromDate,
    toDate,
    // Pagination parameters
    page = 1,
    size = 10,
    // Sorting parameters
    sortBy = 'createdAt',
    sortDirection = 'desc',
  } = query;

  // Build search filter
  const filter = {};

  // Collect roles that should be excluded (comma-separated or array)
  const excludedRoles = new Set();
  const collectExcluded = (input) => {
    if (!input) return;
    if (Array.isArray(input)) {
      input.forEach((entry) => collectExcluded(entry));
      return;
    }
    String(input)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => excludedRoles.add(item));
  };
  collectExcluded(excludeRole);
  collectExcluded(excludeRoles);

  // Global search across multiple fields
  if (search) {
    const searchRegex = new RegExp(search, 'i');
    filter.$or = [
      { name: searchRegex },
      { email: searchRegex },
      { phoneNumber: searchRegex },
      { role: searchRegex },
      { status: searchRegex },
    ];
  }

  // Specific field filters
  if (name) filter.name = new RegExp(name, 'i');
  if (email) filter.email = new RegExp(email, 'i');
  if (phoneNumber) filter.phoneNumber = new RegExp(phoneNumber, 'i');
  if (role) filter.role = role;
  else if (excludedRoles.size > 0) filter.role = { $nin: Array.from(excludedRoles) };
  if (status) filter.status = status;

  // Date range filter
  if (fromDate || toDate) {
    filter.createdAt = {};
    if (fromDate) filter.createdAt.$gte = new Date(fromDate);
    if (toDate) filter.createdAt.$lte = new Date(toDate);
  }

  // Pagination calculations
  const pageNum = Math.max(1, Number(page));
  const pageSize = Math.max(1, Math.min(100, Number(size))); // Max 100 items per page
  const skip = (pageNum - 1) * pageSize;

  // Build sort object
  const validSortFields = [
    'name',
    'email',
    'phoneNumber',
    'role',
    'status',
    'createdAt',
    'updatedAt',
  ];
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
  const sortDir = sortDirection.toLowerCase() === 'asc' ? 1 : -1;
  const sortObject = { [sortField]: sortDir };

  try {
    // Execute queries in parallel
    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-passwordHash -addresses')
        .sort(sortObject)
        .skip(skip)
        .limit(pageSize)
        .lean(),
      User.countDocuments(filter),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / pageSize);
    const hasNext = pageNum < totalPages;
    const hasPrevious = pageNum > 1;
    const isFirst = pageNum === 1;
    const isLast = pageNum === totalPages || total === 0;

    // Format user data
    const formattedUsers = users.map((user) => ({
      id: user._id,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));

    return {
      // Data
      content: formattedUsers,
      // Pagination info
      page: pageNum,
      size: pageSize,
      totalElements: total,
      totalPages,
      // Navigation flags
      first: isFirst,
      last: isLast,
      hasNext,
      hasPrevious,
      // Sorting info
      sort: {
        field: sortField,
        direction: sortDirection.toLowerCase(),
      },
    };
  } catch (error) {
    console.error('Get users error:', error);
    throw {
      status: 500,
      message: 'Lỗi khi lấy danh sách người dùng',
      errors: { database: error.message },
    };
  }
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

/* ==================== USER ANALYTICS FUNCTIONS ==================== */

/**
 * 1. Thống kê user mới theo thời gian
 * Hỗ trợ: today, 7days, thisMonth, custom (from-to)
 * GET /api/admin/users/analytics/new-users?period=today|7days|thisMonth|custom&from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export const getNewUsersByTime = async ({ period = '7days', from, to } = {}) => {
  const now = new Date();
  let fromDate, toDate;

  // Xác định khoảng thời gian
  switch (period) {
    case 'today':
      fromDate = new Date(now.setHours(0, 0, 0, 0));
      toDate = new Date(now.setHours(23, 59, 59, 999));
      break;
    case '7days':
      toDate = new Date(now.setHours(23, 59, 59, 999));
      fromDate = new Date(toDate.getTime() - 6 * 24 * 60 * 60 * 1000);
      fromDate.setHours(0, 0, 0, 0);
      break;
    case 'thisMonth':
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    case 'custom':
      if (!from || !to) {
        throw new Error('Custom period requires from and to dates');
      }
      fromDate = new Date(from);
      toDate = new Date(to);
      fromDate.setHours(0, 0, 0, 0);
      toDate.setHours(23, 59, 59, 999);
      break;
    default:
      throw new Error('Invalid period. Use: today, 7days, thisMonth, or custom');
  }

  const pipeline = [
    {
      $match: {
        createdAt: { $gte: fromDate, $lte: toDate },
        role: 'user', // Chỉ đếm user thường, không đếm admin/staff
      },
    },
    {
      $facet: {
        // Tổng số user mới
        summary: [
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
            },
          },
        ],
        // Phân tích theo ngày
        byDay: [
          {
            $group: {
              _id: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$createdAt',
                  timezone: 'Asia/Ho_Chi_Minh',
                },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ],
      },
    },
  ];

  const [result] = await User.aggregate(pipeline);

  return {
    period: period,
    dateRange: {
      from: fromDate,
      to: toDate,
    },
    totalNewUsers: result.summary[0]?.total || 0,
    dailyBreakdown: result.byDay.map((d) => ({
      date: d._id,
      count: d.count,
    })),
  };
};

/**
 * 2. Tổng quan hệ thống user
 * GET /api/admin/users/analytics/overview
 */
export const getUsersOverview = async () => {
  const [summary] = await User.aggregate([
    {
      $facet: {
        total: [{ $count: 'count' }],
        // Phân loại phone verified (vì user đăng ký bắt buộc bằng SĐT)
        phoneVerified: [{ $match: { phoneVerified: true } }, { $count: 'count' }],
        phoneUnverified: [
          { $match: { $or: [{ phoneVerified: false }, { phoneVerified: { $exists: false } }] } },
          { $count: 'count' },
        ],
        // Phân loại theo role
        byRole: [
          {
            $group: {
              _id: '$role',
              count: { $sum: 1 },
            },
          },
        ],
        // Phân loại theo status
        byStatus: [
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
            },
          },
        ],
      },
    },
  ]);

  return {
    totalUsers: summary.total[0]?.count || 0,
    phoneVerifiedUsers: summary.phoneVerified[0]?.count || 0,
    phoneUnverifiedUsers: summary.phoneUnverified[0]?.count || 0,
    byRole: summary.byRole.map((r) => ({
      role: r._id,
      count: r.count,
    })),
    byStatus: summary.byStatus.map((s) => ({
      status: s._id,
      count: s.count,
    })),
  };
};

/**
 * 3. Heatmap thời gian hoạt động (Login Activity Heatmap)
 * GET /api/admin/users/analytics/login-heatmap?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export const getLoginHeatmap = async ({ from, to } = {}) => {
  const now = new Date();
  const toDate = to ? new Date(to) : now;
  const fromDate = from ? new Date(from) : new Date(toDate.getTime() - 29 * 24 * 60 * 60 * 1000);
  fromDate.setHours(0, 0, 0, 0);
  toDate.setHours(23, 59, 59, 999);

  const pipeline = [
    {
      $match: {
        lastLoginAt: { $gte: fromDate, $lte: toDate, $ne: null },
      },
    },
    {
      $project: {
        dayOfWeek: { $dayOfWeek: '$lastLoginAt' }, // 1=Sunday, 7=Saturday
        hour: { $hour: { date: '$lastLoginAt', timezone: 'Asia/Ho_Chi_Minh' } },
      },
    },
    {
      $group: {
        _id: {
          dayOfWeek: '$dayOfWeek',
          hour: '$hour',
        },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { '_id.dayOfWeek': 1, '_id.hour': 1 },
    },
  ];

  const heatmapData = await User.aggregate(pipeline);

  // Chuyển đổi sang format dễ dùng cho FE
  const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const heatmapMatrix = [];

  // Group by hour
  const byHour = {};
  heatmapData.forEach((item) => {
    const hour = item._id.hour;
    const day = item._id.dayOfWeek;
    if (!byHour[hour]) byHour[hour] = {};
    byHour[hour][day] = item.count;
  });

  // Tạo matrix 24 giờ x 7 ngày
  for (let hour = 0; hour < 24; hour++) {
    const hourData = { hour, days: [] };
    for (let day = 1; day <= 7; day++) {
      hourData.days.push({
        day: dayNames[day - 1],
        dayIndex: day,
        count: byHour[hour]?.[day] || 0,
      });
    }
    heatmapMatrix.push(hourData);
  }

  // Tìm giờ và ngày login nhiều nhất
  const hourlyTotal = {};
  const dailyTotal = {};
  heatmapData.forEach((item) => {
    const hour = item._id.hour;
    const day = item._id.dayOfWeek;
    hourlyTotal[hour] = (hourlyTotal[hour] || 0) + item.count;
    dailyTotal[day] = (dailyTotal[day] || 0) + item.count;
  });

  const peakHour = Object.entries(hourlyTotal).sort((a, b) => b[1] - a[1])[0];
  const peakDay = Object.entries(dailyTotal).sort((a, b) => b[1] - a[1])[0];

  return {
    period: {
      from: fromDate,
      to: toDate,
    },
    heatmapMatrix, // 24 hours x 7 days
    peakHour: peakHour ? { hour: parseInt(peakHour[0]), count: peakHour[1] } : null,
    peakDay: peakDay
      ? {
          day: dayNames[parseInt(peakDay[0]) - 1],
          dayIndex: parseInt(peakDay[0]),
          count: peakDay[1],
        }
      : null,
    totalLogins: heatmapData.reduce((sum, item) => sum + item.count, 0),
  };
};

/**
 * 4. Thống kê địa lý (user thường ở đâu khi đặt hàng)
 * Phân tích dựa trên shippingAddress từ Order
 * GET /api/admin/users/analytics/geography?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export const getUsersByGeography = async ({ from, to } = {}) => {
  const Order = mongoose.model('Order');

  const matchStage = { status: { $in: ['DONE', 'SHIPPING', 'DELIVERING'] } };

  // Thêm filter theo thời gian nếu có
  if (from || to) {
    const fromDate = from ? new Date(from) : new Date('2020-01-01');
    const toDate = to ? new Date(to) : new Date();
    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);
    matchStage.createdAt = { $gte: fromDate, $lte: toDate };
  }

  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: {
          city: '$shippingAddress.city',
          district: '$shippingAddress.district',
        },
        orderCount: { $sum: 1 },
        uniqueUsers: { $addToSet: '$userId' },
      },
    },
    {
      $addFields: {
        userCount: { $size: '$uniqueUsers' },
      },
    },
    {
      $project: {
        _id: 0,
        city: '$_id.city',
        district: '$_id.district',
        orderCount: 1,
        userCount: 1,
      },
    },
    { $sort: { orderCount: -1 } },
  ];

  const geoData = await Order.aggregate(pipeline);

  // Tổng hợp theo city
  const byCity = geoData.reduce((acc, item) => {
    const city = item.city || 'Unknown';
    if (!acc[city]) {
      acc[city] = { city, orderCount: 0, userCount: 0, districts: [] };
    }
    acc[city].orderCount += item.orderCount;
    acc[city].userCount += item.userCount;
    if (item.district) {
      acc[city].districts.push({
        district: item.district,
        orderCount: item.orderCount,
        userCount: item.userCount,
      });
    }
    return acc;
  }, {});

  // Chuyển object thành array và sort
  const citiesSorted = Object.values(byCity).sort((a, b) => b.orderCount - a.orderCount);

  return {
    topCities: citiesSorted.slice(0, 10).map((c) => ({
      city: c.city,
      orderCount: c.orderCount,
      userCount: c.userCount,
    })),
    detailedByCity: citiesSorted.map((c) => ({
      city: c.city,
      orderCount: c.orderCount,
      userCount: c.userCount,
      topDistricts: c.districts.sort((a, b) => b.orderCount - a.orderCount).slice(0, 5),
    })),
  };
};

/**
 * 2.5. Top khách hàng mua nhiều nhất
 * GET /api/admin/users/analytics/top-customers?limit=10&from=YYYY-MM-DD&to=YYYY-MM-DD&sortBy=revenue|orders|avgOrder
 */
export const getTopCustomers = async ({ limit = 10, from, to, sortBy = 'revenue' } = {}) => {
  const lim = Math.max(1, Math.min(100, Number(limit) || 10));

  const matchCondition = {
    status: 'DONE',
  };

  // Thêm filter theo thời gian nếu có
  if (from || to) {
    matchCondition.createdAt = {};
    if (from) {
      const fromDate = new Date(from);
      fromDate.setHours(0, 0, 0, 0);
      matchCondition.createdAt.$gte = fromDate;
    }
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      matchCondition.createdAt.$lte = toDate;
    }
  }

  // Aggregate để tính toán
  const topCustomers = await Order.aggregate([
    { $match: matchCondition },
    {
      $group: {
        _id: '$userId',
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$amounts.subtotal' }, // Doanh thu từ khách (chưa VAT)
        totalDiscount: { $sum: '$amounts.discount' },
        totalShipping: { $sum: '$amounts.shippingFee' },
        avgOrderValue: { $avg: '$amounts.subtotal' },
        lastOrderDate: { $max: '$createdAt' },
      },
    },
    {
      $sort:
        sortBy === 'orders'
          ? { totalOrders: -1 }
          : sortBy === 'avgOrder'
          ? { avgOrderValue: -1 }
          : { totalRevenue: -1 }, // Default: sort by revenue
    },
    { $limit: lim },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'userInfo',
      },
    },
    { $unwind: { path: '$userInfo', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        userId: '$_id',
        name: '$userInfo.name',
        email: '$userInfo.email',
        phone: '$userInfo.phoneNumber',
        totalOrders: 1,
        totalRevenue: 1,
        totalDiscount: 1,
        totalShipping: 1,
        avgOrderValue: { $round: ['$avgOrderValue', 0] },
        lastOrderDate: 1,
        registeredDate: '$userInfo.createdAt',
      },
    },
  ]);

  return {
    sortBy,
    limit: lim,
    total: topCustomers.length,
    customers: topCustomers,
  };
};
