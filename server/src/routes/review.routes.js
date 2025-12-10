import { Router } from 'express';
import * as reviewController from '../controllers/review.controller.js';
import { requireAuth, requireRole } from '../middlewares/requireAuth.js';

const router = Router();

// Public - Get reviews by product
router.get('/product/:productId', reviewController.getReviewsByProduct);

// Customer routes
router.post('/', requireAuth, reviewController.postCreateReview);
router.get('/me', requireAuth, reviewController.getMyReviews);

// Admin/Staff routes - Reply management
router.post(
  '/:reviewId/replies',
  requireAuth,
  requireRole('admin', 'staff'),
  reviewController.postReplyToReview
); //body: { comment }

router.put(
  '/:reviewId/replies/:replyId',
  requireAuth,
  requireRole('admin', 'staff'),
  reviewController.putUpdateReply
); // body: { comment }

router.delete(
  '/:reviewId/replies/:replyId',
  requireAuth,
  requireRole('admin', 'staff'),
  reviewController.deleteReply
);

export default router;
