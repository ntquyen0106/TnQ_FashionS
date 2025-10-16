import * as svc from '../services/product.service.js';

// GET /api/products?path=nam/quan-nam&q=...&sort=price:asc&page=1&limit=24
export const list = async (req, res, next) => {
  try {
    res.json(await svc.search(req.query));
  } catch (e) {
    next(e);
  }
};

// GET /api/products/:id
export const getOne = async (req, res, next) => {
  try {
    const includeHidden = req.userRole === 'admin' || req.userRole === 'staff';
    res.json(await svc.getById(req.params.id, { includeHidden }));
  } catch (e) {
    next(e);
  }
};

// GET /api/products/slug/:slug  (dùng cho trang chi tiết /product/:slug)
export const getOneBySlug = async (req, res, next) => {
  try {
    res.json(await svc.getBySlug(req.params.slug));
  } catch (e) {
    next(e);
  }
};

export const create = async (req, res, next) => {
  try {
    res.status(201).json(await svc.create(req.body));
  } catch (e) {
    next(e);
  }
};

export const update = async (req, res, next) => {
  try {
    res.json(await svc.update(req.params.id, req.body));
  } catch (e) {
    next(e);
  }
};

export const remove = async (req, res, next) => {
  try {
    res.json(await svc.remove(req.params.id));
  } catch (e) {
    next(e);
  }
};
export const listByCategory = async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    const { page = 1, limit = 24 } = req.query;
    const result = await svc.getProductsByCategory(categoryId, { page, limit });
    res.json(result);
  } catch (e) {
    next(e);
  }
};
