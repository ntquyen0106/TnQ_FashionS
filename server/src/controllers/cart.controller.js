import * as cartService from '../services/cart.service.js';

export const getCart = async (req, res, next) => {
  try {
    const userId = req.user?._id || null;
    const sessionId = req.query.sessionId || req.body?.sessionId || null;

    const result = await cartService.getCart({
      userId,
      sessionId,
      allowFallback: true,
      // Nếu có cả user và sessionId thì cho phép merge luôn
      mergeFallback: !!(userId && sessionId),
    });

    res.json(result);
  } catch (e) {
    next(e);
  }
};

export const postAddToCart = async (req, res, next) => {
  try {
    const { productId, variantSku, qty } = req.body;
    const userId = req.user?._id || null;
    const sessionId = req.body?.sessionId || null;

    const result = await cartService.addToCart({
      userId,
      sessionId,
      productId,
      variantSku,
      qty: parseInt(qty, 10),
    });

    res.json(result);
  } catch (e) {
    next(e);
  }
};

export const getCartTotal = async (req, res, next) => {
  try {
    // Ưu tiên user từ middleware nếu có (đã đăng nhập)
    const authUserId = req.user?._id || req.userId || null;
    const isGet = req.method === 'GET';
    const src = isGet ? req.query : req.body;
    const userId = authUserId || src.userId || null;
    const sessionId = src.sessionId || null;
    let selectedItems = src.selectedItems;
    if (typeof selectedItems === 'string') {
      try {
        selectedItems = JSON.parse(selectedItems);
      } catch {
        selectedItems = undefined;
      }
    }

    const total = await cartService.getCartTotal({ userId, sessionId, selectedItems });
    res.json(total);
  } catch (e) {
    next(e);
  }
};

export const postUpdateQty = async (req, res, next) => {
  try {
    const userId = req.user?._id || null;
    const sessionId = req.body.sessionId || req.query.sessionId || null;
    const { id } = req.params; // cartItemId
    const { qty } = req.body; // số lượng mới
    const data = await cartService.updateQty({ userId, sessionId, cartItemId: id, qty });
    res.json(data);
  } catch (e) {
    next(e);
  }
};

export const postUpdateVariant = async (req, res, next) => {
  try {
    const userId = req.user?._id || null;
    const sessionId = req.body.sessionId || req.query.sessionId || null;
    const { id } = req.params; // cartItemId
    const { variantSku } = req.body; // SKU mới
    const data = await cartService.updateVariant({ userId, sessionId, cartItemId: id, variantSku });
    res.json(data);
  } catch (e) {
    next(e);
  }
};

export const postApplyPromotion = async (req, res, next) => {
  try {
    const authUserId = req.user?._id || req.userId || null;
    let { userId, sessionId, code, selectedItems } = req.body;
    userId = authUserId || userId || null;
    if (typeof selectedItems === 'string') {
      try {
        selectedItems = JSON.parse(selectedItems);
      } catch {
        selectedItems = undefined;
      }
    }
    const result = await cartService.applyPromotion({ userId, sessionId, code, selectedItems });
    res.json(result);
  } catch (e) {
    next(e);
  }
};

export const postMergeGuestCart = async (req, res, next) => {
  try {
    const sessionId = req.body?.sessionId || null;
    const userId = req.user?._id || null;

    const cart = await cartService.mergeGuestCartToUser({ userId, sessionId });
    res.json(cart);
  } catch (e) {
    next(e);
  }
};

export const deleteCartItem = async (req, res, next) => {
  try {
    const userId = req.user?._id || null;
    const sessionId = req.body?.sessionId || req.query?.sessionId || null;
    const { id } = req.params; // cartItemId
    const data = await cartService.removeItem({ userId, sessionId, cartItemId: id });
    res.json(data);
  } catch (e) {
    next(e);
  }
};

export const deleteManyCartItems = async (req, res, next) => {
  try {
    const userId = req.user?._id || null;
    const sessionId = req.body?.sessionId || req.query?.sessionId || null;
    const { ids } = req.body || {}; // array cartItemIds
    const data = await cartService.removeMany({ userId, sessionId, ids: ids || [] });
    res.json(data);
  } catch (e) {
    next(e);
  }
};

export const postClearPromotion = async (req, res, next) => {
  try {
    const userId = req.user?._id || null;
    const sessionId = req.body?.sessionId || req.query?.sessionId || null;
    const data = await cartService.clearPromotion({ userId, sessionId });
    res.json(data);
  } catch (e) {
    next(e);
  }
};
