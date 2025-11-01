import 'dotenv/config';
import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import validator from 'validator';
import User from '../models/User.js';
import Otp from '../models/Otp.js';
import { sendMail } from './mail.service.js';
import { adminAuth } from '../config/firebase.js';

const TOKEN_AGE = 60 * 60 * 24 * 7; // 7 ngày

/* -------------------- AUTHENTICATION SERVICES -------------------- */

export const login = async ({ identifier, password }) => {
  // identifier có thể là email hoặc phone
  let user;

  // Kiểm tra xem identifier là email hay phone
  const isEmail = validator.isEmail(identifier);
  const isPhone = /^(0|\+84)[3|5|7|8|9]\d{8}$/.test(identifier);

  if (!isEmail && !isPhone) {
    const err = new Error('Email hoặc số điện thoại không hợp lệ');
    err.status = 400;
    throw err;
  }

  // Tìm user theo email hoặc phone
  if (isEmail) {
    user = await User.findOne({ email: identifier.toLowerCase() });
  } else {
    user = await User.findOne({ phoneNumber: identifier });
  }

  if (!user) {
    const err = new Error('Không tìm thấy tài khoản');
    err.status = 401;
    throw err;
  }

  if (user.status !== 'active') {
    const err = new Error('Tài khoản bị khóa');
    err.status = 403;
    throw err;
  }

  // Nếu là tài khoản đăng nhập bằng Google (không có passwordHash), báo lỗi rõ ràng
  if (!user.passwordHash) {
    const err = new Error(
      'Tài khoản này đăng nhập bằng Google. Vui lòng dùng nút Google để đăng nhập.',
    );
    err.status = 400;
    throw err;
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    const err = new Error('Sai mật khẩu');
    err.status = 401;
    throw err;
  }

  const token = jwt.sign({ sub: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: TOKEN_AGE,
  });
  return { token, user: sanitize(user) };
};

export const firebaseSocialLogin = async ({ idToken }) => {
  console.log('\n🔐 [Firebase Social Login] Starting...');
  
  if (!idToken) {
    const err = new Error('Thiếu Firebase ID token');
    err.status = 400;
    throw err;
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch (error) {
    console.error('❌ [Firebase] Token verification failed:', error.message);
    const err = new Error('Firebase token không hợp lệ');
    err.status = 401;
    throw err;
  }

  const { email, name, picture, uid, firebase } = decoded;

  if (!email) {
    const err = new Error('Firebase token không chứa email');
    err.status = 400;
    throw err;
  }

  console.log(`   Email từ Firebase: ${email}`);
  console.log(`   Firebase UID: ${uid}`);

  let user = await User.findOne({ email: email.toLowerCase() });
  
  if (!user) {
    console.log('   ℹ️ User chưa tồn tại, tạo mới với email...');
    user = await User.create({
      email: email.toLowerCase(),
      name: name || 'Google User',
      avatar: picture,
      status: 'active',
      role: 'user',
      provider: firebase?.sign_in_provider || 'google.com',
      firebaseUid: uid,
      phoneNumber: '', // Tạm thời để trống, sẽ yêu cầu bổ sung sau
      phoneVerified: false,
    });
    
    console.log('   ✅ User mới được tạo (chưa có SĐT)');
  } else {
    console.log('   ℹ️ User đã tồn tại trong hệ thống');
    
    // Cập nhật thông tin nếu cần
    let updated = false;
    if (!user.name && name) {
      user.name = name;
      updated = true;
    }
    if (!user.firebaseUid && uid) {
      user.firebaseUid = uid;
      updated = true;
    }
    if (updated) {
      await user.save();
      console.log('   ✅ Đã cập nhật thông tin user');
    }
  }

  // Nếu Firebase token có kèm số điện thoại đã xác thực, tự động liên kết cho user nếu có thể
  try {
    const firebasePhone = decoded.phone_number; // ví dụ: +84xxxxxxxxx
    if (firebasePhone) {
      const toVariants = (p) => {
        const s = String(p).trim();
        if (s.startsWith('+84')) return [s, '0' + s.slice(3)];
        if (s.startsWith('0')) return [s, '+84' + s.slice(1)];
        return [s, s];
      };

      const [verA, verB] = toVariants(firebasePhone);

      // Nếu user CHƯA có phoneNumber => thử gán từ Firebase
      if (!user.phoneNumber || String(user.phoneNumber).trim() === '') {
        const conflict = await User.findOne({
          _id: { $ne: user._id },
          $or: [{ phoneNumber: verA }, { phoneNumber: verB }],
        });
        if (!conflict) {
          // Ưu tiên lưu dạng 0xxxxxxxxx cho UI VN
          const localPhone = firebasePhone.startsWith('+84')
            ? '0' + firebasePhone.slice(3)
            : firebasePhone;
          user.phoneNumber = localPhone;
          user.phoneVerified = true;
          if (!user.firebaseUid && uid) user.firebaseUid = uid;
          await user.save();
          console.log('   ✅ Đã tự động liên kết SĐT từ Firebase cho user');
        } else {
          console.log('   ⚠️ Không thể auto-link SĐT từ Firebase do đã thuộc về tài khoản khác');
        }
      } else if (user.phoneVerified !== true) {
        // User đã có phoneNumber nhưng chưa verified: nếu trùng số trên Firebase thì auto verify
        const [userA, userB] = toVariants(user.phoneNumber);
        if (userA === verA || userA === verB || userB === verA || userB === verB) {
          user.phoneVerified = true;
          await user.save();
          console.log('   ✅ Đã tự động đánh dấu phoneVerified vì trùng số với Firebase');
        }
      }
    }
  } catch (autoLinkErr) {
    console.warn('   ⚠️ Auto-link phone from Firebase failed (ignored):', autoLinkErr.message);
  }

  const JWT_SECRET = process.env.JWT_SECRET;
  const token = jwt.sign({ sub: user._id.toString(), role: user.role }, JWT_SECRET, {
    expiresIn: '7d',
  });

  // Kiểm tra số điện thoại
  const hasPhone = user.phoneNumber && user.phoneNumber.trim() !== '';
  const isPhoneVerified = user.phoneVerified === true;

  if (!hasPhone || !isPhoneVerified) {
    console.log('   ⚠️ User chưa có số điện thoại hoặc chưa xác thực');
    console.log('   ✅ Vẫn trả về token, nhưng yêu cầu xác thực SĐT\n');
    
    return {
      user: sanitize(user),
      token,
      requiresPhone: true, // Flag để FE biết cần yêu cầu SĐT
      message: 'Đăng nhập thành công. Vui lòng xác thực số điện thoại để tiếp tục.',
    };
  }

  console.log('   ✅ User có đủ thông tin, login hoàn tất!\n');
  return { 
    user: sanitize(user), 
    token,
    requiresPhone: false,
  };
};

// Alias để controller gọi tên nào cũng được
export const firebaseLogin = firebaseSocialLogin;

/* -------------------- REGISTER WITH PHONE VERIFICATION -------------------- */

export const register = async ({ phoneNumber, email, password, confirmPassword, name }) => {
  console.log('\n📝 [Register] Starting registration process...');
  console.log(`   Phone: ${phoneNumber}`);
  console.log(`   Email: ${email || 'N/A'}`);
  console.log(`   Name: ${name}`);

  const errors = {};

  if (!phoneNumber) {
    errors.phoneNumber = 'Số điện thoại là bắt buộc';
  } else if (!/^(0|\+84)[3|5|7|8|9]\d{8}$/.test(phoneNumber)) {
    errors.phoneNumber = 'Số điện thoại không đúng định dạng';
  }

  // Validate email (optional nhưng phải hợp lệ nếu có)
  if (email && !validator.isEmail(email)) {
    errors.email = 'Email không đúng định dạng';
  }

  const regexName = /^[a-zA-ZÀ-ỹ\s]+$/;
  if (!name || name.trim() === '') {
    errors.name = 'Tên là bắt buộc';
  } else if (!regexName.test(name)) {
    errors.name = 'Tên chỉ được chứa chữ cái và khoảng trắng';
  }

  if (!password) {
    errors.password = 'Mật khẩu là bắt buộc';
  } else if (password.length < 6) {
    errors.password = 'Mật khẩu phải có ít nhất 6 ký tự';
  }

  if (!confirmPassword) {
    errors.confirmPassword = 'Xác nhận mật khẩu là bắt buộc';
  } else if (password && password !== confirmPassword) {
    errors.confirmPassword = 'Mật khẩu xác nhận không khớp';
  }

  if (Object.keys(errors).length > 0) {
    const err = new Error('Dữ liệu không hợp lệ');
    err.status = 400;
    err.errors = errors;
    throw err;
  }

  const existingPhone = await User.findOne({ phoneNumber });
  if (existingPhone) {
    const err = new Error('Số điện thoại đã được đăng ký');
    err.status = 400;
    err.errors = { phoneNumber: 'Số điện thoại đã được đăng ký' };
    throw err;
  }

  // Kiểm tra email đã tồn tại chưa (nếu có email)
  if (email) {
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      const err = new Error('Email đã được đăng ký');
      err.status = 400;
      err.errors = { email: 'Email đã được đăng ký' };
      throw err;
    }
  }

  console.log('✅ [Register] Phone and email available');
  console.log('📱 [Register] Please verify phone via Firebase on client side\n');

  // Trả về thông báo để client thực hiện Firebase phone authentication
  return {
    message: 'Vui lòng xác thực số điện thoại qua SMS',
    phoneNumber,
    nextStep: 'verify-phone',
  };
};

export const verifyPhoneAndCreateUser = async ({
  firebaseIdToken,
  phoneNumber,
  email,
  password,
  name,
}) => {
  console.log('\n🔐 [Verify Phone] Verifying Firebase token...');

  const errors = {};

  if (!firebaseIdToken) {
    errors.firebaseIdToken = 'Thiếu Firebase ID token';
  }

  if (!phoneNumber) {
    errors.phoneNumber = 'Số điện thoại là bắt buộc';
  }

  if (!password) {
    errors.password = 'Mật khẩu là bắt buộc';
  }

  if (!name || name.trim() === '') {
    errors.name = 'Tên là bắt buộc';
  }

  if (Object.keys(errors).length > 0) {
    const err = new Error('Dữ liệu không hợp lệ');
    err.status = 400;
    err.errors = errors;
    throw err;
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(firebaseIdToken);
    const { phone_number: verifiedPhone, uid: firebaseUid } = decodedToken;

    console.log(`   Firebase UID: ${firebaseUid}`);
    console.log(`   Verified Phone: ${verifiedPhone}`);

    // Kiểm tra phone number có khớp không
    const normalizedPhone = phoneNumber.startsWith('0')
      ? phoneNumber.replace('0', '+84')
      : phoneNumber;

    const normalizedVerifiedPhone = verifiedPhone.startsWith('+84') ? verifiedPhone : verifiedPhone;

    if (normalizedVerifiedPhone !== normalizedPhone && verifiedPhone !== phoneNumber) {
      console.error(`❌ Phone mismatch: ${verifiedPhone} !== ${phoneNumber}`);
      const err = new Error('Số điện thoại xác thực không khớp');
      err.status = 400;
      err.errors = { phoneNumber: 'Số điện thoại xác thực không khớp' };
      throw err;
    }

    console.log('✅ [Verify Phone] Phone number verified');

    // Kiểm tra lại phone và email chưa bị đăng ký
    const existingPhone = await User.findOne({ phoneNumber });
    if (existingPhone) {
      const err = new Error('Số điện thoại đã được đăng ký');
      err.status = 400;
      err.errors = { phoneNumber: 'Số điện thoại đã được đăng ký' };
      throw err;
    }

    if (email) {
      const existingEmail = await User.findOne({ email: email.toLowerCase() });
      if (existingEmail) {
        const err = new Error('Email đã được đăng ký');
        err.status = 400;
        err.errors = { email: 'Email đã được đăng ký' };
        throw err;
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Tạo user mới
    const user = await User.create({
      phoneNumber,
      email: email ? email.toLowerCase() : undefined,
      passwordHash,
      name,
      phoneVerified: true,
      firebaseUid,
      status: 'active',
      role: 'user',
    });

    console.log(`✅ [Verify Phone] User created: ${user._id}`);

    // Tạo JWT token
    const token = jwt.sign({ sub: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: TOKEN_AGE,
    });

    console.log('✅ [Verify Phone] Registration completed\n');

    return {
      message: 'Đăng ký thành công',
      token,
      user: sanitize(user),
    };
  } catch (error) {
    console.error('❌ [Verify Phone] Error:', error.message);

    if (error.errors) {
      throw error;
    }

    // Xử lý Firebase errors
    if (error.code === 'auth/id-token-expired') {
      const err = new Error('Token xác thực đã hết hạn. Vui lòng thử lại');
      err.status = 401;
      err.errors = { firebaseIdToken: 'Token xác thực đã hết hạn. Vui lòng thử lại' };
      throw err;
    }
    if (error.code === 'auth/argument-error') {
      const err = new Error('Firebase ID token không hợp lệ');
      err.status = 400;
      err.errors = { firebaseIdToken: 'Firebase ID token không hợp lệ' };
      throw err;
    }

    throw error;
  }
};

/* -------------------- ADD PHONE TO GOOGLE USER -------------------- */

export const addPhoneToGoogleUser = async ({ userId, firebaseIdToken, phoneNumber }) => {
  console.log('\n📱 [Add Phone] Adding phone to Google user...');
  console.log(`   User ID: ${userId}`);
  console.log(`   Phone: ${phoneNumber}`);

  const errors = {};

  if (!userId) {
    errors.userId = 'User ID là bắt buộc';
  }

  if (!firebaseIdToken) {
    errors.firebaseIdToken = 'Thiếu Firebase ID token';
  }

  if (!phoneNumber) {
    errors.phoneNumber = 'Số điện thoại là bắt buộc';
  } else if (!/^(0|\+84)[3|5|7|8|9]\d{8}$/.test(phoneNumber)) {
    errors.phoneNumber = 'Số điện thoại không đúng định dạng';
  }

  if (Object.keys(errors).length > 0) {
    const err = new Error('Dữ liệu không hợp lệ');
    err.status = 400;
    err.errors = errors;
    throw err;
  }

  try {
    // Verify Firebase token
    const decodedToken = await adminAuth.verifyIdToken(firebaseIdToken);
    const { phone_number: verifiedPhone, uid: firebaseUid } = decodedToken;

    console.log(`   Firebase UID: ${firebaseUid}`);
    console.log(`   Verified Phone: ${verifiedPhone}`);

    // Kiểm tra phone number có khớp không
    const normalizedPhone = phoneNumber.startsWith('0')
      ? phoneNumber.replace('0', '+84')
      : phoneNumber;

    const normalizedVerifiedPhone = verifiedPhone.startsWith('+84') ? verifiedPhone : verifiedPhone;

    if (normalizedVerifiedPhone !== normalizedPhone && verifiedPhone !== phoneNumber) {
      console.error(`❌ Phone mismatch: ${verifiedPhone} !== ${phoneNumber}`);
      const err = new Error('Số điện thoại xác thực không khớp');
      err.status = 400;
      err.errors = { phoneNumber: 'Số điện thoại xác thực không khớp' };
      throw err;
    }

    console.log('✅ [Add Phone] Phone number verified with Firebase');

    // Tìm user
    const user = await User.findById(userId);
    if (!user) {
      const err = new Error('Không tìm thấy tài khoản');
      err.status = 404;
      throw err;
    }

    // Kiểm tra phone chưa bị đăng ký bởi user khác
    const existingPhone = await User.findOne({ 
      phoneNumber, 
      _id: { $ne: userId } // Không phải user hiện tại
    });
    if (existingPhone) {
      const err = new Error('Số điện thoại đã được đăng ký bởi tài khoản khác');
      err.status = 400;
      err.errors = { phoneNumber: 'Số điện thoại đã được đăng ký bởi tài khoản khác' };
      throw err;
    }

    user.phoneNumber = phoneNumber;
    user.phoneVerified = true;
    if (!user.firebaseUid) {
      user.firebaseUid = firebaseUid;
    }
    await user.save();

    console.log('✅ [Add Phone] Phone added successfully\n');

    return {
      message: 'Thêm số điện thoại thành công',
      user: sanitize(user),
    };
  } catch (error) {
    console.error('❌ [Add Phone] Error:', error.message);

    if (error.errors) {
      throw error;
    }

    // Xử lý Firebase errors
    if (error.code === 'auth/id-token-expired') {
      const err = new Error('Token xác thực đã hết hạn. Vui lòng thử lại');
      err.status = 401;
      err.errors = { firebaseIdToken: 'Token xác thực đã hết hạn. Vui lòng thử lại' };
      throw err;
    }
    if (error.code === 'auth/argument-error') {
      const err = new Error('Firebase ID token không hợp lệ');
      err.status = 400;
      err.errors = { firebaseIdToken: 'Firebase ID token không hợp lệ' };
      throw err;
    }

    throw error;
  }
};

/* -------------------- RESEND OTP -------------------- */

export const resendOtp = async ({ email }) => {
  if (!email) throw new Error('Thiếu email');

  const otpDoc = await Otp.findOne({ email });
  if (otpDoc && otpDoc.expiresAt > new Date()) {
    const now = Date.now();
    const lastSent = otpDoc.lastSentAt ? otpDoc.lastSentAt.getTime() : 0;
    if (now - lastSent < 30 * 1000) {
      throw new Error('Vui lòng chờ 30 giây trước khi gửi lại OTP');
    }
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const lastSentAt = new Date();

  await Otp.findOneAndUpdate(
    { email },
    { otpHash, expiresAt, lastSentAt },
    { upsert: true, new: true },
  );

  await sendMail(email, 'Mã xác thực đăng ký', `Mã OTP của bạn là: ${otp}`);

  return { message: 'Đã gửi lại OTP xác thực đến email' };
};

export const forgotPassword = async ({ email }) => {
  const user = await User.findOne({ email });
  if (!user) throw new Error('Email không tồn tại');

  // Rate limit 30s
  const otpDoc = await Otp.findOne({ email, type: 'forgot' });
  if (otpDoc && otpDoc.lastSentAt && Date.now() - otpDoc.lastSentAt.getTime() < 30 * 1000) {
    throw new Error('Vui lòng chờ 30 giây trước khi gửi lại OTP');
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const lastSentAt = new Date();

  await Otp.findOneAndUpdate(
    { email, type: 'forgot' },
    { otpHash, expiresAt, lastSentAt, usedAt: null, resetToken: null, resetTokenExpiresAt: null },
    { upsert: true, new: true },
  );

  await sendMail(email, 'Mã OTP đặt lại mật khẩu', `Mã OTP của bạn là: ${otp}`);

  return { message: 'Đã gửi OTP đặt lại mật khẩu về email' };
};
export const forgotVerify = async ({ email, otp }) => {
  const otpDoc = await Otp.findOne({ email, type: 'forgot' });
  if (!otpDoc || otpDoc.expiresAt < new Date() || otpDoc.usedAt) {
    throw new Error('OTP không hợp lệ hoặc đã hết hạn');
  }

  // 🔧 THIẾU await → phải thêm await
  const ok = await bcrypt.compare(otp, otpDoc.otpHash);
  if (!ok) throw new Error('OTP không hợp lệ hoặc đã hết hạn');

  const resetToken = randomBytes(32).toString('hex');
  const resetTokenExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

  otpDoc.resetToken = resetToken;
  otpDoc.resetTokenExpiresAt = resetTokenExpiresAt;
  otpDoc.usedAt = new Date();
  await otpDoc.save();

  return { resetToken };
};

export const forgotReset = async ({ resetToken, newPassword }) => {
  const otpDoc = await Otp.findOne({ resetToken, type: 'forgot' });
  if (!otpDoc || otpDoc.resetTokenExpiresAt < new Date()) {
    throw new Error('resetToken không hợp lệ hoặc đã hết hạn');
  }

  // Support both email-based and phone-based reset
  let user = null;
  if (otpDoc.email) {
    user = await User.findOne({ email: otpDoc.email });
  } else if (otpDoc.phoneNumber) {
    user = await User.findOne({ phoneNumber: otpDoc.phoneNumber });
  }
  if (!user) throw new Error('User không tồn tại');

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();

  // Xóa OTP sau khi dùng
  await Otp.deleteOne({ _id: otpDoc._id });

  return { message: 'Đổi mật khẩu thành công' };
};

// Forgot password via phone: verify Firebase token then issue a resetToken
export const forgotVerifyPhone = async ({ firebaseIdToken, phoneNumber }) => {
  if (!firebaseIdToken) {
    const err = new Error('Thiếu Firebase ID token');
    err.status = 400;
    throw err;
  }
  if (!phoneNumber) {
    const err = new Error('Thiếu số điện thoại');
    err.status = 400;
    throw err;
  }

  // Normalize both inputs to compare (+84 vs leading 0)
  const toVariants = (p) => {
    const s = String(p).trim();
    if (s.startsWith('+84')) return [s, '0' + s.slice(3)];
    if (s.startsWith('0')) return [s, '+84' + s.slice(1)];
    return [s, s];
  };

  const decoded = await adminAuth.verifyIdToken(firebaseIdToken);
  const verifiedPhone = decoded.phone_number; // e.g. +84...
  if (!verifiedPhone) {
    const err = new Error('Token không có phone_number');
    err.status = 400;
    throw err;
  }

  const [inputA, inputB] = toVariants(phoneNumber);
  const [verA, verB] = toVariants(verifiedPhone);
  if (!(inputA === verA || inputA === verB || inputB === verA || inputB === verB)) {
    const err = new Error('Số điện thoại xác thực không khớp');
    err.status = 400;
    throw err;
  }

  // Find user by phoneNumber (accept both variants)
  const user = await User.findOne({ $or: [{ phoneNumber: inputA }, { phoneNumber: inputB }] });
  if (!user) {
    const err = new Error('Không tìm thấy tài khoản với số điện thoại này');
    err.status = 404;
    throw err;
  }

  // Issue reset token (10 minutes)
  const resetToken = randomBytes(32).toString('hex');
  const resetTokenExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await Otp.findOneAndUpdate(
    { phoneNumber: user.phoneNumber, type: 'forgot' },
    { resetToken, resetTokenExpiresAt, usedAt: new Date() },
    { upsert: true, new: true },
  );

  return { resetToken };
};

/* -------------------- UTILITY FUNCTIONS -------------------- */

export const changePasswordFirst = async ({ userId, newPassword }) => {
  if (!userId) throw new Error('Thiếu userId');
  if (!newPassword || String(newPassword).length < 6) {
    const err = new Error('Mật khẩu mới phải >= 6 ký tự');
    err.status = 400;
    throw err;
  }

  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('User không tồn tại');
    err.status = 404;
    throw err;
  }
  if (!user.passwordHash) {
    const err = new Error('Không thể đổi mật khẩu cho tài khoản đăng nhập bằng Google');
    err.status = 400;
    throw err;
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.mustChangePassword = false;
  user.passwordChangedAt = new Date();
  await user.save();

  return { message: 'Đổi mật khẩu thành công' };
};

export const sanitize = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  status: u.status,
  mustChangePassword: Boolean(u.mustChangePassword),
  createdAt: u.createdAt,
  updatedAt: u.updatedAt,
});
