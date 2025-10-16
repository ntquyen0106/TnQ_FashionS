import { Router } from 'express';
import * as orderController from '../controllers/order.controller.js';
import { requireAuth } from '../middlewares/requireAuth.js';

const router = Router();

router.post('/checkout', requireAuth, orderController.postCheckout);
router.get('/mine', requireAuth, orderController.getMine);
router.get('/:id', requireAuth, orderController.getOneMine);
router.post('/:id/cancel', requireAuth, orderController.cancelMine);

export default router;
