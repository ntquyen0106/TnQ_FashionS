import { Router } from 'express';
import * as cartController from '../controllers/cart.controller.js';
import { optionalAuth } from '../middlewares/requireAuth.js';

const router = Router();

router.post('/add', optionalAuth, cartController.postAddToCart);
router.post('/apply-promo', cartController.postApplyPromotion);
router.post('/merge', cartController.postMergeGuestCart);
router.get('/total', cartController.getCartTotal); 

export default router;