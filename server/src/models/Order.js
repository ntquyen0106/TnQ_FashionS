import mongoose from "mongoose";

const AddressSnapshotSchema = new mongoose.Schema(
  {
    fullName: String,
    phone: String,
    line1: String,
    ward: String,
    district: String,
    city: String
  },
  { _id: false }
);

const OrderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    variantSku: String,
    nameSnapshot: String,
    imageSnapshot: String,
    price: { type: Number, required: true, min: 0 },
    qty: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const AmountsSchema = new mongoose.Schema(
  {
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, required: true, min: 0, default: 0 },
    shippingFee: { type: Number, required: true, min: 0, default: 0 },
    grandTotal: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const OrderHistorySchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    byUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    action: { type: String, required: true }, // CREATE/STATUS_CHANGE/EDIT/CANCEL...
    fromStatus: { type: String, enum: ["PENDING","CONFIRMED","PACKING","SHIPPING","DONE","CANCELLED"], default: null },
    toStatus: { type: String, enum: ["PENDING","CONFIRMED","PACKING","SHIPPING","DONE","CANCELLED"], default: null },
    note: String
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: { type: [OrderItemSchema], default: [] },
    amounts: { type: AmountsSchema, required: true },
    shippingAddress: { type: AddressSnapshotSchema, required: true },
    paymentMethod: { type: String, enum: ["COD", "BANK"], required: true, default: "COD" },
    status: {
      type: String,
      enum: ["PENDING","CONFIRMED","PACKING","SHIPPING","DONE","CANCELLED"],
      default: "PENDING",
      index: true
    },
    assignedStaffId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    trackingCode: { type: String, default: null },
    history: { type: [OrderHistorySchema], default: [] }
  },
  { timestamps: true }
);

OrderSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model("Order", OrderSchema);
