import { Router } from 'express';
import * as promotionController from '../controllers/promotion.controller.js';

const router = Router();

router.get('/', promotionController.getAllPromotions);
router.get('/:id', promotionController.getPromotionById);
router.post('/', promotionController.postCreatePromotion);
router.put('/:id', promotionController.putUpdatePromotion);
router.delete('/:id', promotionController.deletePromotion);

export default router;