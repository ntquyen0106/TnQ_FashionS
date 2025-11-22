import { Router } from 'express';
import * as orderCtl from '../controllers/order.controller.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { trackLastLogin } from '../middlewares/trackLastLogin.js';
import mongoose from 'mongoose';

const router = Router();

router.use(requireAuth, trackLastLogin);

// ⛔ Block GET /api/order/checkout để không rơi vào /:id
router.get('/checkout', (req, res) => {
  res.status(405).json({ message: 'Use POST /api/order/checkout' });
});

// ✅ Đặt hàng
router.post('/checkout', orderCtl.postCheckout);

// ✅ Đơn của tôi
router.get('/mine', orderCtl.getMine);

// ✅ Hủy đơn (khách hàng)
// đặt trước `/:id` để không bị bắt nhầm bởi route `/:id`
router.post('/:id/cancel', orderCtl.cancelMine);

// ✅ /:id phải ở CUỐI và validate trước khi find
router.get('/:id', async (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid order id' });
  }
  return orderCtl.getOneMine(req, res, next);
});

export default router;
