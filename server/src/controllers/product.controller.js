// server/src/controllers/product.controller.js
import * as svc from "../services/product.service.js";

export const list = async (req, res, next) => {
  try { res.json(await svc.search(req.query)); }
  catch (e) { next(e); }
};

export const detail = async (req, res, next) => {
  try {
    const item = await svc.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json(item);
  } catch (e) { next(e); }
};

export const create = async (req, res, next) => {
  try { res.status(201).json(await svc.create(req.body)); }
  catch (e) { next(e); }
};

export const update = async (req, res, next) => {
  try {
    const item = await svc.update(req.params.id, req.body);
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json(item);
  } catch (e) { next(e); }
};

export const remove = async (req, res, next) => {
  try {
    const ok = await svc.removeById(req.params.id);
    if (!ok) return res.status(404).json({ message: "Not found" });
    res.json({ message: "Deleted" });
  } catch (e) { next(e); }
};
