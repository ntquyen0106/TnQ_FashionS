import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/requireAuth.js';
import * as ctl from '../controllers/reports.controller.js';

const router = Router();

router.get('/overview', requireAuth, requireRole('admin'), ctl.overview);
router.get('/slow-moving', requireAuth, requireRole('admin'), ctl.slowMoving);
router.get('/orders-by-staff', requireAuth, requireRole('admin'), ctl.ordersByStaff);
router.get('/top-products', requireAuth, requireRole('admin'), ctl.topProducts);
router.get('/daily-orders', requireAuth, requireRole('admin'), ctl.dailyOrders);

export default router;
