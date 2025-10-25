import mongoose from "mongoose";

const ReviewSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", index: true, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: String
  },
  { timestamps: true }
);

// Mỗi đơn hàng chỉ được đánh giá một lần duy nhất (kiểm tra bằng orderId)
// Nhưng tạo nhiều bản ghi review - mỗi sản phẩm trong đơn một bản
ReviewSchema.index({ orderId: 1, productId: 1 }, { unique: true });

export default mongoose.model("Review", ReviewSchema);
