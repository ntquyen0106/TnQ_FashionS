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
  getCartRecommendations,
} from '../controllers/cart.controller.js';
import { optionalAuth, requireAuth } from '../middlewares/requireAuth.js';
import { trackLastLogin } from '../middlewares/trackLastLogin.js';

const router = Router();

router.get('/', optionalAuth, trackLastLogin, getCart);
router.post('/add', optionalAuth, trackLastLogin, postAddToCart);
router.get('/total', optionalAuth, trackLastLogin, getCartTotal);
router.post('/apply-promo', optionalAuth, trackLastLogin, postApplyPromotion);
router.post('/merge-guest', requireAuth, trackLastLogin, postMergeGuestCart);
router.post('/clear-promo', optionalAuth, postClearPromotion);
router.get('/recommendations', optionalAuth, getCartRecommendations);

// 👇 2 route mới để đổi số lượng & biến thể
router.patch('/item/:id/qty', optionalAuth, postUpdateQty);
router.patch('/item/:id/variant', optionalAuth, postUpdateVariant);
router.delete('/item/:id', optionalAuth, deleteCartItem);
router.post('/items/delete', optionalAuth, deleteManyCartItems);

export default router;
