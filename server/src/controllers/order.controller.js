import * as orderService from '../services/order.service.js';
import Order from '../models/Order.js';
import Review from '../models/Review.js';

export const postCheckout = async (req, res, next) => {
  try {
    const body = { ...req.body, userId: req.user?._id };
    const order = await orderService.checkout(body);
    res.json(order);
  } catch (e) {
    next(e);
  }
};

export const getMine = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    const orders = await Order.find({ userId }).sort({ createdAt: -1 }).limit(100).lean();
    
    // Get all reviewed orderIds
    const orderIds = orders.map(o => o._id);
    const reviews = await Review.find({ 
      orderId: { $in: orderIds },
      userId 
    }).distinct('orderId').lean();
    
    const reviewedOrderIds = new Set(reviews.map(id => id.toString()));
    
    // Add canReview field
    const items = orders.map(order => ({
      ...order,
      canReview: (order.status === 'DONE' || order.status === 'RETURNED') 
        && !reviewedOrderIds.has(order._id.toString())
    }));
    
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const getOneMine = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;
    const one = await Order.findOne({ _id: id, userId }).lean();
    if (!one) return res.status(404).json({ message: 'Order not found' });
    res.json(one);
  } catch (e) {
    next(e);
  }
};

// Staff/Admin: get any order by id
export const getOneAny = async (req, res, next) => {
  try {
    const { id } = req.params;
    const one = await Order.findById(id).lean();
    if (!one) return res.status(404).json({ message: 'Order not found' });
    res.json(one);
  } catch (e) {
    next(e);
  }
};

export const cancelMine = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;
    const { reasons = [], other } = req.body || {};
    const one = await Order.findOne({ _id: id, userId }).lean();
    if (!one) return res.status(404).json({ message: 'Order not found' });
    if (!['PENDING', 'pending'].includes(String(one.status))) {
      return res.status(400).json({ message: 'Chỉ được hủy khi đơn đang chờ xác nhận' });
    }
    const list = Array.isArray(reasons) ? reasons.filter(Boolean) : [];
    const noteParts = list.slice(0);
    if (other && String(other).trim()) noteParts.push(`Khác: ${String(other).trim()}`);
    const noteText = noteParts.length
      ? `Customer cancel: ${noteParts.join(', ')}`
      : 'Customer cancel';
    const updated = await Order.findByIdAndUpdate(
      id,
      {
        $set: { status: 'CANCELLED' },
        $push: {
          history: {
            action: 'CANCEL',
            fromStatus: one.status,
            toStatus: 'CANCELLED',
            byUserId: userId,
            note: noteText,
          },
        },
      },
      { new: true },
    ).lean();
    res.json(updated);
  } catch (e) {
    next(e);
  }
};

// Staff/Admin features
export const list = async (req, res, next) => {
  try {
    const { status, unassigned, assignee, limit } = req.query;
    const data = await orderService.list({
      status,
      unassigned: unassigned === 'true' || unassigned === true,
      assignee,
      meId: req.userId,
      limit: Number(limit) || 100,
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
};

export const claim = async (req, res, next) => {
  try {
    const { id } = req.params;
    const out = await orderService.claim({ orderId: id, staffId: req.userId });
    res.json(out);
  } catch (e) {
    next(e);
  }
};

export const assign = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { staffId } = req.body;
    const out = await orderService.assign({ orderId: id, staffId, byUserId: req.userId });
    res.json(out);
  } catch (e) {
    next(e);
  }
};

export const updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const out = await orderService.updateStatus({ orderId: id, status, byUserId: req.userId });
    res.json(out);
  } catch (e) {
    next(e);
  }
};

export const statsMe = async (req, res, next) => {
  try {
    const { from, to, status } = req.query;
    const data = await orderService.statsForUser({ staffId: req.userId, from, to, status });
    res.json(data);
  } catch (e) {
    next(e);
  }
};

// PATCH /api/orders/:id/items/:index
// body: { sku?: string, color?: string, size?: string }
export const updateItemVariant = async (req, res, next) => {
  try {
    const { id, index } = req.params;
    const { sku, color, size } = req.body || {};
    const out = await orderService.updateItemVariant({
      orderId: id,
      index: Number(index),
      sku,
      color,
      size,
      byUserId: req.userId,
    });
    res.json(out);
  } catch (e) {
    next(e);
  }
};
