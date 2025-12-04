// services/product.service.js
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import Category from '../models/Category.js';

const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function categoryIdsFromPath(path) {
  if (!path) return null;
  const re = new RegExp(`^${esc(path)}(?:/|$)`, 'i');
  const rows = await Category.find({ path: re }, { _id: 1 }).lean();
  return rows.map((r) => r._id);
}

function normalizeImages(images = []) {
  if (!Array.isArray(images)) return [];
  let primarySeen = false;
  return images
    .map((im, idx) => {
      const isPrimary = Boolean(im.isPrimary) && !primarySeen;
      if (isPrimary) primarySeen = true;
      return {
        publicId: im.publicId, // bắt buộc có
        alt: im.alt || '',
        width: im.width,
        height: im.height,
        format: im.format,
        isPrimary,
        variant: im.variant,
      };
    })
    .filter((im) => !!im.publicId); // bỏ những item chưa có publicId
}

function normalizeVariants(variants = []) {
  if (!Array.isArray(variants)) return [];
  return variants.map((v) => ({
    sku: v.sku,
    color: v.color,
    size: v.size,
    price: Number(v.price ?? 0),
    stock: Number(v.stock ?? 0),
    imagePublicId: v.imagePublicId || undefined, // thay cho v.image
  }));
}

const buildFilter = async ({
  q,
  categoryId,
  path,
  minPrice,
  maxPrice,
  colors,
  sizes,
  onlyInStock,
  status,
}) => {
  const f = {};
  if (q)
    f.$or = [{ name: { $regex: q, $options: 'i' } }, { description: { $regex: q, $options: 'i' } }];
  if (status) f.status = status; // 'active' | 'hidden'
  if (onlyInStock) f['variants.stock'] = { $gt: 0 };

  // Ưu tiên path -> tìm toàn bộ descendants
  if (path) {
    const ids = await categoryIdsFromPath(path);
    // nếu không có id nào thì match rỗng để trả về empty
    f.categoryId = ids?.length
      ? { $in: ids }
      : new mongoose.Types.ObjectId('000000000000000000000000');
  } else if (categoryId) {
    f.categoryId = new mongoose.Types.ObjectId(categoryId);
  }

  const varAnd = [];
  if (colors && colors.length) varAnd.push({ 'variants.color': { $in: colors } });
  if (sizes && sizes.length) varAnd.push({ 'variants.size': { $in: sizes } });

  if (minPrice || maxPrice) {
    const priceCond = {};
    if (minPrice) priceCond.$gte = Number(minPrice);
    if (maxPrice) priceCond.$lte = Number(maxPrice);
    varAnd.push({ 'variants.price': priceCond });
  }

  if (varAnd.length) f.$and = (f.$and || []).concat(varAnd);
  return f;
};

const sortStage = (sort) => {
  // Hỗ trợ cả "price_asc"/"price_desc" và "price:asc"/"price:desc"
  if (sort === 'price_asc' || sort === 'price:asc') return { minPrice: 1, createdAt: -1 };
  if (sort === 'price_desc' || sort === 'price:desc') return { minPrice: -1, createdAt: -1 };
  if (sort === 'rating') return { ratingAvg: -1, ratingCount: -1, createdAt: -1 };
  if (sort === 'newest' || sort === 'new') return { createdAt: -1 };
  return { createdAt: -1 };
};

export const search = async (query) => {
  const {
    q,
    categoryId,
    path,
    minPrice,
    maxPrice,
    page = 1,
    limit = 20,
    sort = 'new',
    colors,
    sizes,
    onlyInStock,
    status = 'active',
  } = query;

  const filter = await buildFilter({
    q,
    categoryId,
    path, // <-- thêm path
    minPrice,
    maxPrice,
    colors: toArr(colors),
    sizes: toArr(sizes),
    onlyInStock: parseBool(onlyInStock),
    status,
  });

  const p = Number(page) > 0 ? Number(page) : 1;
  const l = Math.min(100, Number(limit) || 20);
  const skip = (p - 1) * l;

  const pipeline = [
    { $match: filter }, // chú ý: filter nay là async -> nhớ await buildFilter bên dưới
    {
      $addFields: {
        // tạo mảng giá (double) và mảng stock (int)
        priceArr: {
          $map: {
            input: '$variants',
            as: 'v',
            in: { $convert: { input: '$$v.price', to: 'double', onError: null, onNull: null } },
          },
        },
        stockArr: {
          $map: {
            input: '$variants',
            as: 'v',
            in: { $convert: { input: '$$v.stock', to: 'int', onError: 0, onNull: 0 } },
          },
        },
        coverPublicId: {
          $let: {
            vars: {
              primary: {
                $first: {
                  $filter: { input: '$images', as: 'im', cond: { $eq: ['$$im.isPrimary', true] } },
                },
              },
            },
            in: { $ifNull: ['$$primary.publicId', { $first: '$images.publicId' }] },
          },
        },
      },
    },
    {
      $addFields: {
        minPrice: { $min: '$priceArr' },
        maxPrice: { $max: '$priceArr' },
        inStock: { $gt: [{ $sum: '$stockArr' }, 0] },
      },
    },
    {
      $project: { priceArr: 0, stockArr: 0 },
    },

    { $sort: sortStage(sort) },
    {
      $facet: {
        items: [
          { $skip: skip },
          { $limit: l },
          {
            $project: {
              name: 1,
              slug: 1,
              categoryId: 1,
              minPrice: 1,
              maxPrice: 1,
              inStock: 1,
              ratingAvg: 1,
              ratingCount: 1,
              coverPublicId: 1,
              status: 1,
              images: 1,
              'variants.color': 1,
              'variants.size': 1,
              'variants.sku': 1,
              'variants.price': 1,
              'variants.stock': 1,
            },
          },
        ],
        total: [{ $count: 'count' }],
      },
    },
    { $project: { items: 1, total: { $ifNull: [{ $arrayElemAt: ['$total.count', 0] }, 0] } } },
  ];

  const [result] = await Product.aggregate(pipeline);
  const total = result?.total || 0;
  return {
    items: result?.items || [],
    total,
    page: p,
    limit: l,
    pages: Math.ceil(total / l),
  };
};

export const getById = async (id, { includeHidden = false } = {}) => {
  const f = { _id: new mongoose.Types.ObjectId(id) };
  if (!includeHidden) f.status = 'active';
  const doc = await Product.findOne(f);
  if (!doc) {
    const err = new Error('Product not found');
    err.status = 404;
    throw err;
  }
  return doc;
};

export const getBySlug = async (slug, { includeHidden = false } = {}) => {
  const f = { slug };
  if (!includeHidden) f.status = 'active';
  const doc = await Product.findOne(f);
  if (!doc) {
    const err = new Error('Product not found');
    err.status = 404;
    throw err;
  }
  return doc;
};

export const create = async (data) => {
  if (data.variants?.length) {
    const skus = data.variants.map((v) => v.sku);
    if (new Set(skus).size !== skus.length) {
      const err = new Error('SKU variants must be unique');
      err.status = 400;
      throw err;
    }
  }
  const payload = {
    ...data,
    images: normalizeImages(data.images),
    variants: normalizeVariants(data.variants),
  };
  return Product.create(payload);
};

export const update = async (id, data) => {
  if (data.variants?.length) {
    const skus = data.variants.map((v) => v.sku);
    if (new Set(skus).size !== skus.length) {
      const err = new Error('SKU variants must be unique');
      err.status = 400;
      throw err;
    }
  }
  const patch = { ...data };
  if (Array.isArray(data.images)) patch.images = normalizeImages(data.images);
  if (Array.isArray(data.variants)) patch.variants = normalizeVariants(data.variants);

  const doc = await Product.findByIdAndUpdate(id, patch, { new: true, runValidators: true });

  if (!doc) {
    const err = new Error('Product not found');
    err.status = 404;
    throw err;
  }
  return doc;
};

export const remove = async (id) => {
  const doc = await Product.findByIdAndDelete(id);
  if (!doc) {
    const err = new Error('Product not found');
    err.status = 404;
    throw err;
  }
  return { message: 'Deleted' };
};

export const searchByKeyword = async (
  keyword,
  { limit = 10, minPrice, maxPrice, sizes, colors, categoryPath, includeOutOfStock = true } = {},
) => {
  const query = {
    q: keyword,
    limit: Math.min(Math.max(Number(limit) || 10, 1), 20),
    page: 1,
    status: 'active',
  };

  if (minPrice != null) query.minPrice = Number(minPrice);
  if (maxPrice != null) query.maxPrice = Number(maxPrice);
  if (categoryPath) query.path = categoryPath;
  if (sizes?.length) query.sizes = sizes;
  if (colors?.length) query.colors = colors;
  if (!includeOutOfStock) query.onlyInStock = true;

  const { items = [] } = await search(query);

  return items.slice(0, query.limit).map((item) => {
    const variantSizes = Array.from(
      new Set((item.variants || []).map((v) => v.size).filter(Boolean)),
    );
    const variantColors = Array.from(
      new Set((item.variants || []).map((v) => v.color).filter(Boolean)),
    );
    const min = Number(item.minPrice) || 0;
    const max = Number(item.maxPrice) || min;
    const hasStock =
      typeof item.inStock === 'boolean'
        ? item.inStock
        : (item.variants || []).some((v) => Number(v?.stock) > 0);

    return {
      id: String(item._id),
      name: item.name,
      slug: item.slug,
      minPrice: min,
      maxPrice: max,
      inStock: hasStock,
      rating: Number(item.ratingAvg) || 0,
      image: item.coverPublicId || item.images?.[0]?.publicId || '',
      sizes: variantSizes,
      colors: variantColors,
    };
  });
};

// helpers
function toArr(x) {
  if (x == null) return [];
  if (Array.isArray(x)) return x;
  // nếu FE gửi 'red,blue'
  return String(x)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
function parseBool(v) {
  if (v === true || v === 'true' || v === '1') return true;
  return false;
}

export const getProductsByCategory = async (categoryId) => {
  // bảo vệ kiểu
  const cid = new mongoose.Types.ObjectId(categoryId);

  // lấy toàn bộ nhánh dựa vào path của category gốc
  const cat = await Category.findById(cid, { path: 1 }).lean();
  if (!cat) return [];

  const re = new RegExp(`^${esc(cat.path)}(?:/|$)`, 'i');
  const allCats = await Category.find({ path: re }, { _id: 1 }).lean();
  const allIds = allCats.map((c) => c._id);

  return Product.find({ categoryId: { $in: allIds } }).lean();
};

export const getSalesCount = async (ids = []) => {
  const objIds = (Array.isArray(ids) ? ids : [])
    .map((id) => {
      try {
        return new mongoose.Types.ObjectId(String(id));
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  if (!objIds.length) return {};

  const agg = await Order.aggregate([
    { $match: { status: { $in: ['DONE', 'done'] } } },
    { $unwind: '$items' },
    { $match: { 'items.productId': { $in: objIds } } },
    { $group: { _id: '$items.productId', qty: { $sum: '$items.qty' } } },
  ]);

  const map = {};
  for (const it of agg) map[String(it._id)] = it.qty || 0;
  return map;
};
