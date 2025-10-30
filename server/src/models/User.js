import mongoose from 'mongoose';
import validator from 'validator';

const AddressSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Full name must be at least 2 characters'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      validate: {
        validator: (v) => /^0\d{9,10}$/.test(v),
        message: 'Invalid phone number format',
      },
    },
    line1: { type: String, required: [true, 'Address line is required'] },
    ward: { type: String, default: '' },
    district: { type: String, default: '' },
    city: { type: String, default: '' },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true },
);

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
    },
    email: {
      type: String,
      required: false, 
      unique: true,
      sparse: true,
      index: true,
      lowercase: true,
      validate: [validator.isEmail, 'Invalid email format'],
    },
    passwordHash: {
      type: String,
      required: false,
      minlength: [6, 'Password must be at least 6 characters'],
    },
    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      index: true,
      validate: {
        validator: (v) => /^(0|\+84)[3|5|7|8|9]\d{8}$/.test(v),
        message: 'Invalid phone number format (must be Vietnamese phone)',
      },
    },
    phoneVerified: {
      type: Boolean,
      default: false, // Trạng thái xác thực SĐT
    },
    firebaseUid: {
      type: String,
      sparse: true, // UID từ Firebase Authentication
      index: true,
    },
    role: {
      type: String,
      enum: {
        values: ['user', 'admin', 'staff'],
        message: 'Role must be either user, admin, or staff',
      },
      default: 'user',
    },
    status: {
      type: String,
      enum: {
        values: ['active', 'banned'],
        message: 'Status must be either active or banned',
      },
      default: 'active',
    },
    addresses: {
      type: [AddressSchema],
      default: [],
      validate: [
        {
          validator: (v) => Array.isArray(v),
          message: 'Addresses must be an array',
        },
      ],
    },
    mustChangePassword: { type: Boolean, default: false },
    passwordChangedAt: { type: Date },
  },
  { timestamps: true },
);

UserSchema.pre('save', function (next) {
  if (this.name) this.name = this.name.trim();
  if (this.email) this.email = this.email.trim().toLowerCase();
  next();
});

export default mongoose.model('User', UserSchema);
