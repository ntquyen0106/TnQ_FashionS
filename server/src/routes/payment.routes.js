import { Router } from 'express';
import * as paymentController from '../controllers/payment.controller.js';
import {requireAuth} from '../middlewares/requireAuth.js';

const router = Router();

// PayOS Webhook (không cần auth, PayOS sẽ gọi)
router.post('/payos/webhook', paymentController.handlePayOSWebhook);

router.get('/check/:orderId', requireAuth, paymentController.checkPaymentStatus);

router.post('/cancel/:orderId', requireAuth, paymentController.cancelUnpaidOrder);

export default router;
