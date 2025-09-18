// models/Category.js
import mongoose from 'mongoose';

const CategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // Tên hiển thị (có dấu)
    slug: { type: String, required: true, trim: true, lowercase: true }, // tên không dấu
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    path: { type: String, required: true }, // ví dụ: "nam/ao-nam/ao-khoac"
    depth: { type: Number, required: true }, // cấp độ (1=root, 2=con, 3=cháu)
    sort: { type: Number, default: 0 }, // thứ tự hiển thị
    status: { type: String, enum: ['active', 'hidden'], default: 'active' },
  },
  { timestamps: true },
);

// 🔑 Index
// Một slug chỉ cần unique trong cùng 1 parentId
CategorySchema.index({ slug: 1, parentId: 1 }, { unique: true });
// Tìm kiếm theo path nhanh
CategorySchema.index({ path: 1 });
// Lấy theo parentId nhanh
CategorySchema.index({ parentId: 1 });

export default mongoose.model('Category', CategorySchema);
