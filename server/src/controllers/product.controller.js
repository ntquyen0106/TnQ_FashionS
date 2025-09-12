import * as svc from "../services/product.service.js";
import Product from "../models/Product.js";
import Category from "../models/Category.js";

export const list = async (req, res, next) => {
  try { res.json(await svc.search(req.query)); }
  catch (e) { next(e); }
};

export const getOne = async (req, res, next) => {
  try { res.json(await svc.getById(req.params.id)); }
  catch (e) { next(e); }
};

export const create = async (req, res, next) => {
  try { res.status(201).json(await svc.create(req.body)); }
  catch (e) { next(e); }
};

export const update = async (req, res, next) => {
  try { res.json(await svc.update(req.params.id, req.body)); }
  catch (e) { next(e); }
};

export const remove = async (req, res, next) => {
  try { res.json(await svc.remove(req.params.id)); }
  catch (e) { next(e); }
};

export const getProductsByCategory = async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    const products = await svc.getProductsByCategory(categoryId);
    res.json(products);
  } catch (err) {
    next(err);
  }
};