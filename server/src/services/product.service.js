// services/product.service.js
import mongoose from "mongoose";
import Product from "../models/Product.js";
import Category from "../models/Category.js";
// build filter cho aggregate
const buildFilter = ({ q, categoryId, minPrice, maxPrice, colors, sizes, onlyInStock, status }) => {
  const f = {};
  if (q) {
    f.$or = [
      { name: { $regex: q, $options: "i" } },
      { description: { $regex: q, $options: "i" } },
    ];
  }
  if (categoryId) f.categoryId = new mongoose.Types.ObjectId(categoryId);
  if (status) f.status = status; // 'active' | 'hidden' (admin/staff có thể xem hidden)
  if (onlyInStock) f["variants.stock"] = { $gt: 0 };

  // lọc theo màu/size (nằm trong mảng variants)
  const varAnd = [];
  if (colors && colors.length) varAnd.push({ "variants.color": { $in: colors } });
  if (sizes && sizes.length) varAnd.push({ "variants.size": { $in: sizes } });

  // lọc theo price trong variants
  if (minPrice || maxPrice) {
    const priceCond = {};
    if (minPrice) priceCond.$gte = Number(minPrice);
    if (maxPrice) priceCond.$lte = Number(maxPrice);
    varAnd.push({ "variants.price": priceCond });
  }

  if (varAnd.length) f.$and = (f.$and || []).concat(varAnd);
  return f;
};

// sort map: frontend gửi sort param: 'new', 'price_asc', 'price_desc', 'rating'
const sortStage = (sort) => {
  switch (sort) {
    case "price_asc":  return { "minPrice": 1 };
    case "price_desc": return { "maxPrice": -1 };
    case "rating":     return { ratingAvg: -1, ratingCount: -1 };
    default:           return { createdAt: -1 }; // newest
  }
};

/**
 * Search products (public: status=active; admin/staff có thể truyền status khác)
 * Trả về: items (kèm minPrice,maxPrice, inStock), total, page, pages, limit
 */
export const search = async (query) => {
  const {
    q, categoryId, minPrice, maxPrice, page = 1, limit = 20,
    sort = "new", colors, sizes, onlyInStock, // FE có thể truyền mảng: colors=[], sizes=[]
    // admin có thể truyền status='hidden' để xem
    status = "active",
  } = query;

  const filter = buildFilter({
    q, categoryId, minPrice, maxPrice,
    colors: toArr(colors), sizes: toArr(sizes),
    onlyInStock: parseBool(onlyInStock),
    status,
  });

  const p = Number(page) > 0 ? Number(page) : 1;
  const l = Math.min(100, Number(limit) || 20);
  const skip = (p - 1) * l;

  // aggregate để tính min/max price & inStock theo variants
  const pipeline = [
    { $match: filter },
    {
      $addFields: {
        minPrice: { $min: "$variants.price" },
        maxPrice: { $max: "$variants.price" },
        inStock:  { $gt: [ { $sum: "$variants.stock" }, 0 ] },
      }
    },
    { $sort: sortStage(sort) },
    {
      $facet: {
        items: [
          { $skip: skip },
          { $limit: l },
          // có thể project bớt fields nếu muốn
        ],
        total: [{ $count: "count" }]
      }
    },
    {
      $project: {
        items: 1,
        total: { $ifNull: [ { $arrayElemAt: ["$total.count", 0] }, 0 ] }
      }
    }
  ];

  const [result] = await Product.aggregate(pipeline);
  const total = result?.total || 0;
  return {
    items: result?.items || [],
    total,
    page: p,
    limit: l,
    pages: Math.ceil(total / l)
  };
};

export const getById = async (id, { includeHidden = false } = {}) => {
  const f = { _id: new mongoose.Types.ObjectId(id) };
  if (!includeHidden) f.status = "active";
  const doc = await Product.findOne(f);
  if (!doc) {
    const err = new Error("Product not found");
    err.status = 404;
    throw err;
  }
  return doc;
};

export const getBySlug = async (slug, { includeHidden = false } = {}) => {
  const f = { slug };
  if (!includeHidden) f.status = "active";
  const doc = await Product.findOne(f);
  if (!doc) {
    const err = new Error("Product not found");
    err.status = 404;
    throw err;
  }
  return doc;
};

export const create = async (data) => {
  // đảm bảo sku trong variants là duy nhất trong cùng product
  if (data.variants?.length) {
    const skus = data.variants.map(v => v.sku);
    const set = new Set(skus);
    if (set.size !== skus.length) {
      const err = new Error("SKU variants must be unique");
      err.status = 400;
      throw err;
    }
  }
  return Product.create(data);
};

export const update = async (id, data) => {
  if (data.variants?.length) {
    const skus = data.variants.map(v => v.sku);
    const set = new Set(skus);
    if (set.size !== skus.length) {
      const err = new Error("SKU variants must be unique");
      err.status = 400;
      throw err;
    }
  }
  const doc = await Product.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  if (!doc) {
    const err = new Error("Product not found");
    err.status = 404;
    throw err;
  }
  return doc;
};

export const remove = async (id) => {
  const doc = await Product.findByIdAndDelete(id);
  if (!doc) {
    const err = new Error("Product not found");
    err.status = 404;
    throw err;
  }
  return { message: "Deleted" };
};

// helpers
function toArr(x) {
  if (x == null) return [];
  if (Array.isArray(x)) return x;
  // nếu FE gửi 'red,blue'
  return String(x).split(",").map(s => s.trim()).filter(Boolean);
}
function parseBool(v) {
  if (v === true || v === "true" || v === "1") return true;
  return false;
}

export const getProductsByCategory = async (categoryId) => {
  // Lấy tất cả danh mục con 1 cấp
  const children = await Category.find({ parentId: categoryId });
  const childIds = children.map(cat => cat._id.toString());
  // Lấy tất cả _id cần tìm: chính nó + các con
  const allCategoryIds = [categoryId, ...childIds];
  // Lấy sản phẩm thuộc các danh mục này
  return Product.find({ categoryId: { $in: allCategoryIds } });
};