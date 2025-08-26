import mongoose from "mongoose";

const CategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null }
  },
  { timestamps: true }
);

export default mongoose.model("Category", CategorySchema);
