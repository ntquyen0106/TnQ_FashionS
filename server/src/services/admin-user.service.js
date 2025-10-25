import bcrypt from 'bcrypt';
import User from '../models/User.js';
import mongoose from 'mongoose';
import validator from 'validator';
import { sendWelcomeEmail } from './mail.service.js';

/* -------------------- CONSTANTS -------------------- */

const DEFAULT_PASSWORD = 'P@ssw0rd';

/* -------------------- VALIDATION FUNCTIONS -------------------- */

const validateUserData = async (data, isUpdate = false, currentUserId = null) => {
  const errors = {};
  const { name, email, phoneNumber, role, status } = data;

  // Validate name
  const regex= /^[a-zA-ZÀ-ỹ\s]+$/;
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
      errors.phoneNumber = 'Số điện thoại không hợp lệ (VD: 0901234567)';
    } else {
      // Check phone exists
      try {
        const query = { phoneNumber: phoneNumber.trim() };
        if (isUpdate && currentUserId) {
          query._id = { $ne: currentUserId };
        }
        const existedUser = await User.findOne(query);
        if (existedUser) {
          errors.phoneNumber = isUpdate ? 'Số điện thoại này đã được sử dụng bởi user khác' : 'Số điện thoại đã tồn tại trong hệ thống';
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
          errors.email = isUpdate ? 'Email này đã được sử dụng bởi user khác' : 'Email đã tồn tại trong hệ thống';
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
  }else if(role === '' || role === null) {
    errors.role = 'Role không được để trống';
  }

  // Validate status
  const validStatuses = ['active', 'banned'];
  if (status && !validStatuses.includes(status)) {
    errors.status = 'Status chỉ được là active hoặc banned';
  } else if(status === '' || status === null) {
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

  // Create user with validated data
  const user = new User({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phoneNumber: phoneNumber.trim(),
    passwordHash: await bcrypt.hash(DEFAULT_PASSWORD, 10),
    role: role || 'user',
    status: status || 'active',
  });

  await user.save();

  // Send welcome email to new user
  await sendWelcomeEmail(user.email, user.name, DEFAULT_PASSWORD);

  return {
    message: 'Tạo người dùng thành công với mật khẩu mặc định: P@ssw0rd. Email thông báo đã được gửi.',
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
  const regex= /^[a-zA-ZÀ-ỹ\s]+$/;

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
        errors.phoneNumber = 'Số điện thoại không hợp lệ (VD: 0901234567)';
      } else {
        // Check phone exists for other users
        try {
          const existedUser = await User.findOne({ 
            phoneNumber: phoneNumber.trim(),
            _id: { $ne: currentUserId }
          });
          if (existedUser) {
            errors.phoneNumber = 'Số điện thoại này đã được sử dụng bởi user khác';
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
            _id: { $ne: currentUserId }
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
      errors: { id: 'User ID không hợp lệ' } 
    };
  }

  // Find current user first
  const currentUser = await User.findById(id);
  if (!currentUser) {
    throw { 
      status: 404, 
      message: 'Không tìm thấy người dùng', 
      errors: { id: 'User không tồn tại' } 
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
      message: 'Không có thay đổi nào được phát hiện',
      errors: { general: 'Dữ liệu mới phải khác với dữ liệu hiện tại' },
    };
  }

  try {
    // Update user with only changed fields
    const updatedUser = await User.findByIdAndUpdate(
      id, 
      changes, 
      {
        new: true,
        runValidators: true,
        context: 'query',
      }
    ).select('-passwordHash');

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
      }
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
    search, name, email, phoneNumber, role, status,
    fromDate, toDate,
    // Pagination parameters
    page = 1, size = 10,
    // Sorting parameters
    sortBy = 'createdAt', sortDirection = 'desc'
  } = query;

  // Build search filter
  const filter = {};
  
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
  const validSortFields = ['name', 'email', 'phoneNumber', 'role', 'status', 'createdAt', 'updatedAt'];
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
    const formattedUsers = users.map(user => ({
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
        direction: sortDirection.toLowerCase()
      }
    };
  } catch (error) {
    console.error('Get users error:', error);
    throw {
      status: 500,
      message: 'Lỗi khi lấy danh sách người dùng',
      errors: { database: error.message }
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