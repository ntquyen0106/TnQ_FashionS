// controllers/category.controller.js
import * as svc from '../services/category.service.js';

function sendErr(res, e) {
  const code = e?.status || (e?.name === 'ValidationError' ? 400 : e?.code === 11000 ? 409 : 500);
  return res.status(code).json({ message: e?.message || 'Error', code });
}

export const getAllCategories = async (req, res, next) => {
  try {
    res.json(await svc.list(req.query));
  } catch (e) {
    sendErr(res, e);
  }
};

export const getChildren = async (req, res, next) => {
  try {
    res.json(await svc.children(req.query));
  } catch (e) {
    sendErr(res, e);
  }
};

export const getBreadcrumb = async (req, res, next) => {
  try {
    res.json(await svc.breadcrumb(req.query));
  } catch (e) {
    sendErr(res, e);
  }
};

export const createCategory = async (req, res, next) => {
  try {
    const out = await svc.create(req.body);
    res.status(201).json(out);
  } catch (e) {
    sendErr(res, e);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    res.json(await svc.update(req.params.id, req.body));
  } catch (e) {
    sendErr(res, e);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    res.json(await svc.remove(req.params.id));
  } catch (e) {
    sendErr(res, e);
  }
};
