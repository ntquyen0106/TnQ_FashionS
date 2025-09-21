import { Router } from 'express';
import * as cartController from '../controllers/cart.controller.js';

const router = Router();

router.post('/add', cartController.postAddToCart);
router.post('/apply-promo', cartController.postApplyPromotion);
router.get('/total', cartController.getCartTotal);
router.post('/merge', cartController.postMergeGuestCart);

export default router;