import mongoose from "mongoose";

const ProductVariantSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true, index: true },
    color: String,
    size: String,
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, default: 0 },
    image: String
  },
  { _id: false }
);

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },
    description: String,
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", index: true },
    images: [String],
    attributes: { type: Map, of: String }, // brand, material, ...
    variants: [ProductVariantSchema],
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    status: { type: String, enum: ["active", "hidden"], default: "active" }
  },
  { timestamps: true }
);

export default mongoose.model("Product", ProductSchema);
