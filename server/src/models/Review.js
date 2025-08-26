import mongoose from "mongoose";

const ReviewSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", index: true, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: String
  },
  { timestamps: true }
);

// mỗi user chỉ review 1 lần / product (nếu bạn muốn)
ReviewSchema.index({ productId: 1, userId: 1 }, { unique: true });

export default mongoose.model("Review", ReviewSchema);
