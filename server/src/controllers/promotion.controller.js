import Promotion from '../models/Promotion.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';

const escapeRegex = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const listAvailable = async (req, res, next) => {
  try {
    const now = new Date();
    const subtotal = Number(req.query.subtotal || 0);
    const includeAll = String(req.query.all || '').toLowerCase();
    const wantAll = includeAll === 'true' || includeAll === '1';
    // optional filtering by cart contents
    const rawProductIds = String(req.query.productIds || '').trim();
    const rawCategoryIds = String(req.query.categoryIds || '').trim();
    const productIds = rawProductIds ? rawProductIds.split(',').map((s) => s.trim()) : [];
    const categoryIds = rawCategoryIds ? rawCategoryIds.split(',').map((s) => s.trim()) : [];

    const promos = await Promotion.find({
      status: 'active',
      startAt: { $lte: now },
      endAt: { $gte: now },
    })
      .sort({ createdAt: -1 })
      .lean();

    // If productIds provided, fetch products to derive their categoryIds and build a product->category map
    let derivedCategoryIds = [];
    const prodCategoryMap = new Map();
    if (productIds && productIds.length) {
      try {
        const prods = await Product.find({ _id: { $in: productIds } })
          .select('categoryId')
          .lean();
        for (const pr of prods || []) {
          const pid = String(pr._id);
          const cid = pr.categoryId ? String(pr.categoryId) : null;
          if (cid) {
            derivedCategoryIds.push(cid);
            prodCategoryMap.set(pid, cid);
          }
        }
        derivedCategoryIds = Array.from(new Set(derivedCategoryIds));
      } catch (err) {
        derivedCategoryIds = [];
      }
    }

    const data = [];
    for (const p of promos) {
      const min = Number(p.minOrder || 0);
      const eligible = subtotal >= min;

      // determine applicability toward provided cart/product/category ids
      let applicable = true; // default: applicable to all when no cart context provided
      if ((productIds && productIds.length) || (categoryIds && categoryIds.length)) {
        if (p.appliesTo === 'all' || !p.appliesTo) {
          applicable = true;
        } else if (p.appliesTo === 'product') {
          const targets = (p.targetIds || []).map((t) => String(t));
          // require that ALL products in the cart are within the promo target list
          if (!productIds || productIds.length === 0) {
            applicable = false;
          } else {
            applicable = productIds.every((pid) => targets.includes(String(pid)));
          }
        } else if (p.appliesTo === 'category') {
          // For category promos: require that ALL products in the cart belong to the promo categories (including descendants)
          const targets = (p.targetIds || []).map((t) => String(t));
          const catsToCheck = categoryIds && categoryIds.length ? categoryIds : derivedCategoryIds;
          if (!catsToCheck || catsToCheck.length === 0) {
            applicable = false;
          } else {
            // Build list of allowed category ids = all descendants of target categories (including the targets)
            let allowedCategoryIds = [];
            try {
              const targetCats = await Category.find({ _id: { $in: targets } })
                .select('path')
                .lean();
              if (targetCats && targetCats.length) {
                const orClauses = targetCats.map((tc) => ({
                  path: { $regex: `^${escapeRegex(tc.path)}` },
                }));
                const matched = await Category.find({ $or: orClauses }).select('_id').lean();
                allowedCategoryIds = (matched || []).map((c) => String(c._id));
              }
            } catch (err) {
              allowedCategoryIds = [];
            }
            if (!allowedCategoryIds.length) applicable = false;
            else {
              // check against the categories present in the cart (catsToCheck)
              applicable = true;
              for (const checkCid of catsToCheck) {
                if (!checkCid || !allowedCategoryIds.includes(String(checkCid))) {
                  applicable = false;
                  break;
                }
              }
            }
          }
        } else {
          applicable = true;
        }
      }

      data.push({
        id: String(p._id),
        code: p.code,
        type: p.type,
        value: p.value,
        minOrder: min,
        eligible,
        applicable,
        appliesTo: p.appliesTo || 'all',
        targetIds: p.targetIds || [],
        startAt: p.startAt,
        endAt: p.endAt,
      });
    }

    // Return promotions but preserve applicable/eligible flags so the client can show
    // vouchers that don't fully apply as "not eligible" instead of hiding them.
    let out;
    if (wantAll) {
      // client explicitly requested all promotions (e.g. VoucherPicker) — return full list
      out = data;
    } else {
      // default: only return promotions that are both applicable to the cart and eligible by subtotal
      out = data.filter((x) => x.applicable && x.eligible);
    }

    res.json(out);
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
