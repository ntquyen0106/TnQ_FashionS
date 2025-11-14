import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/requireAuth.js';
import * as staffCtl from '../controllers/staff.controller.js';

const router = Router();

// GET /api/staff/stats/me - Get personal stats for logged-in staff
router.get('/stats/me', requireAuth, requireRole('staff', 'admin'), staffCtl.getMyStats);

export default router;
