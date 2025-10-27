import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/requireAuth.js';
import * as orderCtl from '../controllers/order.controller.js';
import mongoose from 'mongoose';

const router = Router();

// ⛔ Block GET /api/orders/checkout (rất quan trọng)
router.get('/checkout', (req, res) => {
  res.status(405).json({ message: 'Use POST /api/order/checkout' });
});

router.get('/', requireAuth, requireRole('staff', 'admin'), orderCtl.list);
router.get('/stats/me', requireAuth, requireRole('staff', 'admin'), orderCtl.statsMe);

// ✅ /:id sau mọi path cụ thể
router.get('/:id', requireAuth, requireRole('staff', 'admin'), async (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid order id' });
  }
  return orderCtl.getOneAny(req, res, next);
});

router.post('/:id/claim', requireAuth, requireRole('staff', 'admin'), orderCtl.claim);
router.patch('/:id/assign', requireAuth, requireRole('admin'), orderCtl.assign);
router.patch('/:id/status', requireAuth, requireRole('staff', 'admin'), orderCtl.updateStatus);
router.patch(
  '/:id/items/:index',
  requireAuth,
  requireRole('staff', 'admin'),
  orderCtl.updateItemVariant,
);

export default router;
