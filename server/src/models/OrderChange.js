import mongoose from "mongoose";

const OrderChangeSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    type: { type: String, enum: ["EDIT", "CANCEL"], required: true },
    byUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reason: String,
    payloadBefore: { type: mongoose.Schema.Types.Mixed },
    payloadAfter: { type: mongoose.Schema.Types.Mixed },
    at: { type: Date, default: Date.now }
  },
  { timestamps: false }
);

export default mongoose.model("OrderChange", OrderChangeSchema);
