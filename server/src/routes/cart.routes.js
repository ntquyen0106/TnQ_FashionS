// server/src/routes/cart.routes.js
import { Router } from 'express';
import {
  getCart,
  postAddToCart,
  postApplyPromotion,
  getCartTotal,
  postMergeGuestCart,
  // 👇 NHỚ import thêm 2 hàm mới
  postUpdateQty,
  postUpdateVariant,
  deleteCartItem,
  deleteManyCartItems,
  postClearPromotion,
} from '../controllers/cart.controller.js';
import { optionalAuth, requireAuth } from '../middlewares/requireAuth.js';

const router = Router();

router.get('/', optionalAuth, getCart);
router.post('/add', optionalAuth, postAddToCart);
router.get('/total', optionalAuth, getCartTotal);
router.post('/apply-promo', optionalAuth, postApplyPromotion);
router.post('/merge-guest', requireAuth, postMergeGuestCart);
router.post('/clear-promo', optionalAuth, postClearPromotion);

// 👇 2 route mới để đổi số lượng & biến thể
router.patch('/item/:id/qty', optionalAuth, postUpdateQty);
router.patch('/item/:id/variant', optionalAuth, postUpdateVariant);
router.delete('/item/:id', optionalAuth, deleteCartItem);
router.post('/items/delete', optionalAuth, deleteManyCartItems);

export default router;
