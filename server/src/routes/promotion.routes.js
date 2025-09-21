import { Router } from 'express';
import * as promotionController from '../controllers/promotion.controller.js';
import { requireAuth, requireRole } from '../middlewares/requireAuth.js'; 

const router = Router();

router.use(requireAuth);
router.use(requireRole('admin')); 
router.get('/', promotionController.getAllPromotions);

router.get('/:id', promotionController.getPromotionById);

router.post('/', /* requireAuth, requireRole('admin'), */ promotionController.postCreatePromotion);

router.put('/:id', promotionController.putUpdatePromotion);

router.delete('/:id', promotionController.deletePromotion);

export default router;