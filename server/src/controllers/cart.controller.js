import * as cartService from '../services/cart.service.js';

export const postAddToCart = async (req, res, next) => {
  try {
    const cart = await cartService.addToCart(req.body);
    res.json(cart);
  } catch (e) { next(e); }
};

export const postApplyPromotion = async (req, res, next) => {
  try {
    const cart = await cartService.applyPromotion(req.body);
    res.json(cart);
  } catch (e) { next(e); }
};

export const getCartTotal = async (req, res, next) => {
  try {
    const total = await cartService.getCartTotal(req.query);
    res.json(total);
  } catch (e) { next(e); }
};

export const postMergeGuestCart = async (req, res, next) => {
  try {
    const cart = await cartService.mergeGuestCartToUser(req.body);
    res.json(cart);
  } catch (e) { next(e); }
};