import mongoose from 'mongoose';
const { Schema } = mongoose;

const InventoryLogSchema = new Schema(
  {
    sku: { type: String, required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', index: true },
    productName: String,
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    userEmail: String,
    delta: Number,
    oldStock: Number,
    newStock: Number,
    reason: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export default mongoose.model('InventoryLog', InventoryLogSchema);
