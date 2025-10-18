import mongoose from 'mongoose';

const CartItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  variantSku: { type: String, required: true },
  qty: { type: Number, required: true, min: 1 },
  priceSnapshot: { type: Number, required: true, min: 0 },
  nameSnapshot: { type: String, required: true },
  imageSnapshot: String,
});

const CartSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    sessionId: { type: String, default: null },
    items: { type: [CartItemSchema], default: [] },
    status: { type: String, enum: ['active', 'ordered'], default: 'active' },

    // 👇 THÊM DÒNG NÀY
    promotion: { type: mongoose.Schema.Types.ObjectId, ref: 'Promotion', default: null },
  },
  { timestamps: true },
);

CartSchema.index({ userId: 1, status: 1 });
CartSchema.index({ sessionId: 1, status: 1 });

export default mongoose.model('Cart', CartSchema);
