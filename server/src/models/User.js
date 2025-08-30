import mongoose from "mongoose";

const AddressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    line1: { type: String, required: true },
    ward: String,
    district: String,
    city: String,
    isDefault: { type: Boolean, default: false }
  },
  { _id: true }
);

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["user", "admin", "staff"], default: "user" },
    status: { type: String, enum: ["active", "banned"], default: "active" },
  },
  { timestamps: true }
);

export default mongoose.model("User", UserSchema);
