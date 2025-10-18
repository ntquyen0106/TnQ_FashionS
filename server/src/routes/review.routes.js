import { Router } from 'express';
import * as reviewController from '../controllers/review.controller.js';
import { requireAuth } from '../middlewares/requireAuth.js';

const router = Router();

router.get('/product/:productId', reviewController.getReviewsByProduct);

router.post('/', requireAuth, reviewController.postCreateReview);
router.get('/me', requireAuth, reviewController.getMyReviews);

export default router;
