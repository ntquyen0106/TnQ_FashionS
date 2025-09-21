import { Router } from 'express';
import * as cartController from '../controllers/cart.controller.js';

const router = Router();

router.post('/add', cartController.postAddToCart);
router.post('/apply-promo', cartController.postApplyPromotion);
router.post('/merge', cartController.postMergeGuestCart);
router.post('/total', cartController.getCartTotal);

export default router;