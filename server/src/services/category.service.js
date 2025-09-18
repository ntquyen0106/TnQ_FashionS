// services/category.service.js
import mongoose from 'mongoose';
import Category from '../models/Category.js';

const asBool = (v) => v === true || v === 'true' || v === '1';
const byStatus = (status) => (status ? { status } : {});
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Build tree từ danh sách phẳng
function buildTree(list) {
  // map: id -> node có children: []
  const map = new Map(list.map((c) => [String(c._id), { ...c, children: [] }]));
  const roots = [];

  // gắn node vào cha (luôn dùng node từ map)
  list.forEach((c) => {
    const node = map.get(String(c._id));
    if (c.parentId) {
      const parent = map.get(String(c.parentId));
      if (parent) parent.children.push(node);
      else roots.push(node); // nếu thiếu cha do filter -> cho lên root
    } else {
      roots.push(node);
    }
  });

  // sort theo sort rồi name
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
      const err = new Error('Category not found');
      err.status = 404;
      throw err;
    }
    thePath = doc.path;
  }
  if (!thePath) {
    const err = new Error('Missing categoryId or path');
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
  const { name, slug, parentId, sort = 0, status = 'active' } = data;
  let path = slug;

  if (parentId) {
    const parent = await Category.findById(parentId);
    if (!parent) {
      const err = new Error('Parent not found');
      err.status = 400;
      throw err;
    }
    path = `${parent.path}/${slug}`;
  }

  return Category.create({ name, slug, parentId: parentId || null, path, sort, status });
}

export async function update(id, data = {}) {
  const doc = await Category.findById(id);
  if (!doc) {
    const err = new Error('Category not found');
    err.status = 404;
    throw err;
  }

  const { name, slug, parentId, sort, status } = data;
  let newPath = doc.path;

  // Nếu thay slug hoặc parentId -> cập nhật path cả nhánh
  if (slug != null || parentId !== undefined) {
    const newSlug = slug ?? doc.slug;

    let parentPath = '';
    if (parentId) {
      const p = await Category.findById(parentId, { path: 1 });
      if (!p) {
        const err = new Error('Parent not found');
        err.status = 400;
        throw err;
      }
      parentPath = p.path;
    }
    newPath = parentId ? `${parentPath}/${newSlug}` : newSlug;

    const re = new RegExp(`^${esc(doc.path)}`);
    await Category.updateMany({ path: re }, [
      {
        $set: {
          path: { $replaceOne: { input: '$path', find: doc.path, replacement: newPath } },
        },
      },
    ]);
  }

  return Category.findByIdAndUpdate(
    id,
    { name, slug, parentId: parentId ?? doc.parentId, sort, status, path: newPath },
    { new: true },
  );
}

export async function remove(id) {
  const doc = await Category.findById(id);
  if (!doc) {
    const err = new Error('Category not found');
    err.status = 404;
    throw err;
  }
  const re = new RegExp(`^${esc(doc.path)}(?:/|$)`);
  await Category.deleteMany({ path: re });
  return { message: 'Deleted branch' };
}
