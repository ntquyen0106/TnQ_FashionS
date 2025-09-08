import Category from "../models/Category.js";


//Lấy toàn bộ danh mục
export const getAllCategories = async (req, res, next) => {
  try {
    const categories = await Category.find();
    res.json(categories);
  } catch (err) {
    next(err);
  }
};

export const createCategory = async (req, res, next) => {
  try {
    const { name, slug, parentId } = req.body;
    const category = await Category.create({ name, slug, parentId: parentId || null });
    res.status(201).json(category);
  } catch (err) {
    next(err);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, slug, parentId } = req.body;
    const category = await Category.findByIdAndUpdate(
      id,
      { name, slug, parentId: parentId || null },
      { new: true }
    );
    if (!category) return res.status(404).json({ message: "Category not found" });
    res.json(category);
  } catch (err) {
    next(err);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    // Xóa category cha và tất cả category con
    await Category.deleteMany({ $or: [{ _id: id }, { parentId: id }] });
    res.json({ message: "Category and its children deleted" });
  } catch (err) {
    next(err);
  }
};