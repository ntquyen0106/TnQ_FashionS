import Product from '../models/Product.js';
import InventoryLog from '../models/InventoryLog.js';
import Category from '../models/Category.js';
import mongoose from 'mongoose';

export const list = async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    const categoryId = req.query.categoryId || '';
    const categoryPath = req.query.categoryPath || '';

    const cond = {};
    if (q) cond.name = { $regex: q, $options: 'i' };

    // Filter by category: exact id or by path (include descendants)
    if (categoryId) {
      cond.categoryId = new mongoose.Types.ObjectId(categoryId);
    } else if (categoryPath) {
      const cats = await Category.find({ path: new RegExp(`^${categoryPath}(?:/|$)`, 'i') })
        .select('_id')
        .lean();
      const ids = cats.map((c) => c._id);
      if (ids.length === 0) return res.json({ items: [] });
      cond.categoryId = { $in: ids };
    }

    const items = await Product.find(cond)
      .select('name slug variants status images.publicId images.isPrimary')
      .limit(200)
      .lean();
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

// POST /api/inventory/adjust
// body: { sku: string, delta: number, reason?: string }
export const adjust = async (req, res, next) => {
  try {
    const { sku, delta, reason } = req.body || {};
    if (!sku || typeof sku !== 'string') {
      const err = new Error('Missing or invalid sku');
      err.status = 400;
      throw err;
    }
    const nDelta = Number(delta);
    if (!Number.isFinite(nDelta) || Math.floor(nDelta) !== nDelta) {
      const err = new Error('delta must be an integer');
      err.status = 400;
      throw err;
    }

    // Get current stock of the matched variant
    const doc = await Product.findOne(
      { 'variants.sku': sku },
      { name: 1, slug: 1, 'variants.$': 1 },
    ).lean();
    if (!doc || !doc.variants || !doc.variants[0]) {
      const err = new Error('Variant not found');
      err.status = 404;
      throw err;
    }
    const v = doc.variants[0];
    const oldStock = Number(v.stock || 0);
    const newStock = Math.max(0, oldStock + nDelta);

    await Product.updateOne({ 'variants.sku': sku }, { $set: { 'variants.$.stock': newStock } });

    // Write audit log
    try {
      await InventoryLog.create({
        sku,
        productId: doc._id,
        productName: doc.name,
        userId: req.user?._id || null,
        userEmail: req.user?.email || '',
        delta: nDelta,
        oldStock,
        newStock,
        reason: reason || '',
      });
    } catch (e) {
      // do not block on log failures
    }

    // Optionally, you could write an audit log here with req.user and reason
    res.json({
      message: 'Stock updated',
      product: { _id: doc._id, name: doc.name, slug: doc.slug },
      sku,
      oldStock,
      newStock,
      reason: reason || '',
    });
  } catch (e) {
    next(e);
  }
};

// PATCH /api/inventory/reorder-point
// body: { sku: string, reorderPoint: number }
export const setReorderPoint = async (req, res, next) => {
  try {
    const { sku, reorderPoint } = req.body || {};
    if (!sku || typeof sku !== 'string') {
      const err = new Error('Missing or invalid sku');
      err.status = 400;
      throw err;
    }
    const rp = Number(reorderPoint);
    if (!Number.isFinite(rp) || rp < 0) {
      const err = new Error('Invalid reorderPoint');
      err.status = 400;
      throw err;
    }
    const upd = await Product.updateOne(
      { 'variants.sku': sku },
      { $set: { 'variants.$.reorderPoint': rp } },
    );
    if (upd.matchedCount === 0) {
      const err = new Error('Variant not found');
      err.status = 404;
      throw err;
    }
    res.json({ message: 'Updated', sku, reorderPoint: rp });
  } catch (e) {
    next(e);
  }
};
