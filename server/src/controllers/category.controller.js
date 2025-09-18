// controllers/category.controller.js
import * as svc from '../services/category.service.js';

export const getAllCategories = async (req, res, next) => {
  try {
    res.json(await svc.list(req.query));
  } catch (e) {
    next(e);
  }
};

export const getChildren = async (req, res, next) => {
  try {
    res.json(await svc.children(req.query));
  } catch (e) {
    next(e);
  }
};

export const getBreadcrumb = async (req, res, next) => {
  try {
    res.json(await svc.breadcrumb(req.query));
  } catch (e) {
    next(e);
  }
};

export const createCategory = async (req, res, next) => {
  try {
    res.status(201).json(await svc.create(req.body));
  } catch (e) {
    next(e);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    res.json(await svc.update(req.params.id, req.body));
  } catch (e) {
    next(e);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    res.json(await svc.remove(req.params.id));
  } catch (e) {
    next(e);
  }
};
