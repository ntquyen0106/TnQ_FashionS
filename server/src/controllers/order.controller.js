import * as orderService from '../services/order.service.js';
import Order from '../models/Order.js';

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
    const items = await Order.find({ userId }).sort({ createdAt: -1 }).limit(100).lean();
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
