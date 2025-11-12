import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/requireAuth.js';
import * as ctl from '../controllers/reports.controller.js';

const router = Router();

router.get('/overview', requireAuth, requireRole('admin'), ctl.overview);
router.get('/slow-moving', requireAuth, requireRole('admin'), ctl.slowMoving);
router.get('/orders-by-staff', requireAuth, requireRole('admin'), ctl.ordersByStaff);
router.get('/top-products', requireAuth, requireRole('admin'), ctl.topProducts);
router.get('/daily-orders', requireAuth, requireRole('admin'), ctl.dailyOrders);

// API báo cáo doanh thu theo tháng
router.get('/monthly-revenue', requireAuth, requireRole('admin'), ctl.monthlyRevenueSummary); //query params: year, month. nếu không có params thì lấy tháng hiện tại
router.get('/monthly-revenue/export', requireAuth, requireRole('admin'), ctl.monthlyRevenueExport); //query params: year, month. nếu không có params thì lấy tháng hiện tại

export default router;
