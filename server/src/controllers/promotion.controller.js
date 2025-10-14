import Promotion from '../models/Promotion.js';

export const listAvailable = async (req, res, next) => {
  try {
    const now = new Date();
    const subtotal = Number(req.query.subtotal || 0);
    const includeAll = String(req.query.all || '').toLowerCase();
    const wantAll = includeAll === 'true' || includeAll === '1';

    const promos = await Promotion.find({
      status: 'active',
      startAt: { $lte: now },
      endAt: { $gte: now },
    })
      .sort({ createdAt: -1 })
      .lean();

    const data = promos.map((p) => {
      const min = Number(p.minOrder || 0);
      const eligible = subtotal >= min;
      return {
        id: String(p._id),
        code: p.code,
        type: p.type,
        value: p.value,
        minOrder: min,
        eligible,
        startAt: p.startAt,
        endAt: p.endAt,
      };
    });

    res.json(wantAll ? data : data.filter((x) => x.eligible));
  } catch (e) {
    next(e);
  }
};
import * as promotionService from '../services/promotion.service.js';

export const getAllPromotions = async (req, res, next) => {
  try {
    const list = await promotionService.listPromotions(req.query);
    res.json(list);
  } catch (e) {
    next(e);
  }
};

export const getPromotionById = async (req, res, next) => {
  try {
    const promo = await promotionService.getPromotion(req.params.id);
    if (!promo) return res.status(404).json({ message: 'Not found' });
    res.json(promo);
  } catch (e) {
    next(e);
  }
};

export const postCreatePromotion = async (req, res, next) => {
  try {
    const promo = await promotionService.createPromotion(req.body);
    res.status(201).json(promo);
  } catch (e) {
    next(e);
  }
};

export const putUpdatePromotion = async (req, res, next) => {
  try {
    const promo = await promotionService.updatePromotion(req.params.id, req.body);
    res.json(promo);
  } catch (e) {
    next(e);
  }
};

export const deletePromotion = async (req, res, next) => {
  try {
    await promotionService.deletePromotion(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (e) {
    next(e);
  }
};
