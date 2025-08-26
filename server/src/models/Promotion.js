import mongoose from "mongoose";

const PromotionSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    type: { type: String, enum: ["percent", "amount"], required: true },
    value: { type: Number, required: true, min: 0 },
    minOrder: { type: Number, default: 0, min: 0 },
    appliesTo: { type: String, enum: ["all", "category", "product"], default: "all" },
    targetIds: [{ type: mongoose.Schema.Types.ObjectId }], // categoryId hoặc productId
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    status: { type: String, enum: ["active", "inactive"], default: "inactive" }
  },
  { timestamps: true }
);

export default mongoose.model("Promotion", PromotionSchema);
