import { Router } from 'express';
import * as paymentController from '../controllers/payment.controller.js';
import { requireAuth } from '../middlewares/requireAuth.js';

const router = Router();

// PayOS Webhook (không cần auth, PayOS sẽ gọi)
router.post('/payos/webhook', paymentController.handlePayOSWebhook);

// Client gọi để sync status với PayOS
router.get('/check/:orderId', requireAuth, paymentController.checkPaymentStatus);

// Client gọi khi user hủy thanh toán (không cần auth vì user có thể chưa login)
router.post('/cancel-payment/:orderId', paymentController.handleUserCancelPayment);

// User đã login muốn hủy đơn hàng
router.post('/cancel/:orderId', requireAuth, paymentController.cancelUnpaidOrder);

// Tạo (hoặc tạo lại) link thanh toán cho đơn đang chờ thanh toán
router.post('/create-link/:orderId', requireAuth, paymentController.createPaymentLinkForOrder);

export default router;
