// services/category.service.js
import mongoose from 'mongoose';
import Category from '../models/Category.js';

const asBool = (v) => v === true || v === 'true' || v === '1';
const byStatus = (status) => (status ? { status } : {});
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Slug helper (fallback khi FE không gửi slug)
const toSlug = (s = '') =>
  String(s)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// Build tree từ danh sách phẳng
function buildTree(list) {
  const map = new Map(list.map((c) => [String(c._id), { ...c, children: [] }]));
  const roots = [];
  list.forEach((c) => {
    const node = map.get(String(c._id));
    if (c.parentId) {
      const parent = map.get(String(c.parentId));
      if (parent) parent.children.push(node);
      else roots.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortFn = (a, b) =>
    (a?.sort ?? 0) - (b?.sort ?? 0) || (a?.name || '').localeCompare(b?.name || '');

  const dfsSort = (n) => {
    n.children.sort(sortFn);
    n.children.forEach(dfsSort);
  };

  roots.sort(sortFn);
  roots.forEach(dfsSort);
  return roots;
}

// ========== Public APIs ==========

export async function list(query = {}) {
  const { status = 'active', asTree, parentId, path } = query;

  const filter = { ...byStatus(status) };
  if (parentId) filter.parentId = new mongoose.Types.ObjectId(parentId);
  if (path) filter.path = new RegExp(`^${esc(path)}(?:/|$)`, 'i');

  const docs = await Category.find(filter).sort({ sort: 1, name: 1 }).lean();
  return asBool(asTree) ? buildTree(docs) : docs;
}

export async function children(query = {}) {
  const { parentId, path, status = 'active' } = query;
  let pid = parentId;

  if (!pid && path) {
    const p = await Category.findOne({ path, ...byStatus(status) }, { _id: 1 });
    if (p) pid = String(p._id);
  }
  if (!pid) {
    const err = new Error('Missing parentId or path');
    err.status = 400;
    throw err;
  }

  return Category.find({ parentId: new mongoose.Types.ObjectId(pid), ...byStatus(status) }, null, {
    sort: { sort: 1, name: 1 },
  }).lean();
}

export async function breadcrumb(query = {}) {
  const { categoryId, path, status = 'active' } = query;
  let thePath = path;

  if (!thePath && categoryId) {
    const doc = await Category.findOne(
      { _id: new mongoose.Types.ObjectId(categoryId), ...byStatus(status) },
      { path: 1 },
    ).lean();
    if (!doc) {
      const err = new Error('Không tìm thấy danh mục');
      err.status = 404;
      throw err;
    }
    thePath = doc.path;
  }
  if (!thePath) {
    const err = new Error('Thiếu đường dẫn danh mục');
    err.status = 400;
    throw err;
  }

  const segments = thePath.split('/').filter(Boolean);
  const result = [];
  let prefix = '';
  for (const seg of segments) {
    prefix = prefix ? `${prefix}/${seg}` : seg;
    const node = await Category.findOne({ path: prefix, ...byStatus(status) }).lean();
    if (node) result.push(node);
  }
  return result;
}

export async function create(data = {}) {
  const { name, sort = 0, status = 'active' } = data;

  // 1) Validate cơ bản
  if (!name || !String(name).trim()) {
    const err = new Error('Tên danh mục là bắt buộc');
    err.status = 400;
    throw err;
  }

  // 2) Slug fallback từ name (nếu FE không gửi slug)
  const toSlug = (s = '') =>
    String(s)
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const rawSlug = (data.slug && String(data.slug).trim()) || toSlug(name);
  if (!rawSlug) {
    const err = new Error('Slug là bắt buộc');
    err.status = 400;
    throw err;
  }

  // 3) Xử lý parent (nếu có) và dựng path
  let parent = null;
  let path = rawSlug;

  if (data.parentId) {
    parent = await Category.findById(data.parentId);
    if (!parent) {
      const err = new Error('Không tìm thấy danh mục cha');
      err.status = 400;
      throw err;
    }
    path = `${parent.path}/${rawSlug}`;
  }

  // 4) Chống trùng path → trả 409
  const exists = await Category.exists({ path });
  if (exists) {
    const err = new Error('Đường dẫn danh mục đã tồn tại');
    err.status = 409;
    throw err;
  }

  // 5) Tự gán sort nếu không truyền hoặc = 0 → maxSibling + 10
  let sortVal = Number(sort) || 0;
  if (!sortVal) {
    const maxSibling = await Category.find({ parentId: parent ? parent._id : null })
      .sort({ sort: -1 })
      .limit(1)
      .lean();
    const max = maxSibling?.[0]?.sort ? Number(maxSibling[0].sort) : 0;
    sortVal = max + 10;
  }

  // 6) depth (nếu schema có dùng): tính từ path
  const depth = parent
    ? (parent.depth ?? (parent.path?.split('/').filter(Boolean).length || 1)) + 1
    : 1;

  // 7) Tạo
  return Category.create({
    name,
    slug: rawSlug,
    parentId: parent ? parent._id : null,
    path,
    sort: sortVal,
    status,
    depth,
  });
}

export async function update(id, data = {}) {
  const doc = await Category.findById(id);
  if (!doc) {
    const err = new Error('Không tìm thấy danh mục');
    err.status = 404;
    throw err;
  }

  // Chỉ set các field được gửi từ FE (tránh set undefined)
  const patch = {};
  if ('name' in data && data.name !== undefined) patch.name = data.name;
  if ('slug' in data && data.slug !== undefined) patch.slug = data.slug;
  if ('sort' in data && data.sort !== undefined) patch.sort = data.sort;
  if ('status' in data && data.status !== undefined) patch.status = data.status;

  // xử lý parentId (có thể null => về root)
  const parentIdProvided = Object.prototype.hasOwnProperty.call(data, 'parentId');
  let parentIdToSet = doc.parentId;
  if (parentIdProvided) parentIdToSet = data.parentId ?? null;

  const slugToUse = 'slug' in data && data.slug != null ? data.slug : doc.slug;
  let newPath = doc.path;

  // Nếu đổi slug hoặc đổi parent → cập nhật path toàn nhánh
  if ('slug' in data || parentIdProvided) {
    if (parentIdToSet) {
      const p = await Category.findById(parentIdToSet, { path: 1 });
      if (!p) {
        const err = new Error('Không tìm thấy danh mục cha');
        err.status = 400;
        throw err;
      }
      newPath = `${p.path}/${slugToUse}`;
    } else {
      newPath = slugToUse;
    }

    // Kiểm tra trùng path mới (trừ chính node hiện tại)
    const dup = await Category.findOne({ _id: { $ne: doc._id }, path: newPath }, { _id: 1 });
    if (dup) {
      const err = new Error('Đường dẫn danh mục đã tồn tại');
      err.status = 409;
      throw err;
    }

    // Update path toàn subtree bằng $replaceOne
    const re = new RegExp(`^${esc(doc.path)}`);
    await Category.updateMany({ path: re }, [
      {
        $set: {
          path: { $replaceOne: { input: '$path', find: doc.path, replacement: newPath } },
        },
      },
    ]);
  }

  patch.parentId = parentIdToSet ?? null;
  patch.path = newPath;

  return Category.findByIdAndUpdate(id, { $set: patch }, { new: true });
}

export async function remove(id) {
  const doc = await Category.findById(id);
  if (!doc) {
    const err = new Error('Không tìm thấy danh mục');
    err.status = 404;
    throw err;
  }
  const re = new RegExp(`^${esc(doc.path)}(?:/|$)`);
  await Category.deleteMany({ path: re });
  return { message: 'Đã xóa nhánh' };
}
