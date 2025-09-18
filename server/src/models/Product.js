import mongoose from 'mongoose';
const { Schema } = mongoose;

const ImageSchema = new Schema(
  {
    publicId: { type: String, required: true }, // "products/basic-t-shirt/cover_main"
    alt: { type: String, default: '' },
    width: Number,
    height: Number,
    format: String, // "jpg" | "png" | "webp"
    isPrimary: { type: Boolean, default: false },
    variant: String, // optional: "Black", "White", ...
  },
  { _id: false },
);

const ProductVariantSchema = new Schema(
  {
    sku: { type: String, required: true, index: true },
    color: String,
    size: String,
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, default: 0 },
    imagePublicId: String, // thay cho image: String
  },
  { _id: false },
);

const ProductSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },
    description: String,
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', index: true },
    images: { type: [ImageSchema], default: [] }, // thay [String]
    attributes: { type: Map, of: String },
    variants: { type: [ProductVariantSchema], default: [] },
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'hidden'], default: 'active' },
  },
  { timestamps: true },
);

export default mongoose.model('Product', ProductSchema);
