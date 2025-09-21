import * as orderService from '../services/order.service.js';

export const postCheckout = async (req, res, next) => {
  try {
    const order = await orderService.checkout(req.body);
    res.json(order);
  } catch (e) { next(e); }
};