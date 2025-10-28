import { Router } from 'express';
import {
  listAvailable,
  getAllPromotions,
  getPromotionById,
  postCreatePromotion,
  putUpdatePromotion,
  deletePromotion,
} from '../controllers/promotion.controller.js';
import { requireAuth, requireRole } from '../middlewares/requireAuth.js';

const router = Router();

// Public/user-facing
router.get('/available', listAvailable);

// Admin management
router.use(requireAuth, requireRole('admin'));
router.get('/', getAllPromotions);
router.get('/:id', getPromotionById);
router.post('/', postCreatePromotion);
router.put('/:id', putUpdatePromotion);
router.delete('/:id', deletePromotion);

export default router;
