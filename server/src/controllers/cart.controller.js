import * as cartService from '../services/cart.service.js';

export const postAddToCart = async (req, res, next) => {
  try {
    const cart = await cartService.addToCart(req.body);
    res.json(cart);
  } catch (e) { next(e); }
};

export const getCartTotal = async (req, res, next) => {
  try {
    // Hỗ trợ lấy từ body hoặc query (FE gửi selectedItems qua body)
    const { userId, sessionId, selectedItems } = req.method === 'GET' ? req.query : req.body;
    const total = await cartService.getCartTotal({
      userId,
      sessionId,
      selectedItems: selectedItems ? JSON.parse(selectedItems) : undefined
    });
    res.json(total);
  } catch (e) { next(e); }
};

export const postApplyPromotion = async (req, res, next) => {
  try {
    const { userId, sessionId, code, selectedItems } = req.body;
    const result = await cartService.applyPromotion({ userId, sessionId, code, selectedItems });
    res.json(result);
  } catch (e) { next(e); }
};

export const postMergeGuestCart = async (req, res, next) => {
  try {
    const cart = await cartService.mergeGuestCartToUser(req.body);
    res.json(cart);
  } catch (e) { next(e); }
};