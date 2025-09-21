import * as promotionService from '../services/promotion.service.js';

export const getAllPromotions = async (req, res, next) => {
  try {
    const list = await promotionService.listPromotions(req.query);
    res.json(list);
  } catch (e) { next(e); }
};

export const getPromotionById = async (req, res, next) => {
  try {
    const promo = await promotionService.getPromotion(req.params.id);
    if (!promo) return res.status(404).json({ message: 'Not found' });
    res.json(promo);
  } catch (e) { next(e); }
};

export const postCreatePromotion = async (req, res, next) => {
  try {
    const promo = await promotionService.createPromotion(req.body);
    res.status(201).json(promo);
  } catch (e) { next(e); }
};

export const putUpdatePromotion = async (req, res, next) => {
  try {
    const promo = await promotionService.updatePromotion(req.params.id, req.body);
    res.json(promo);
  } catch (e) { next(e); }
};

export const deletePromotion = async (req, res, next) => {
  try {
    await promotionService.deletePromotion(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (e) { next(e); }
};