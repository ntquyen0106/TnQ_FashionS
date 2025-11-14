import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/requireAuth.js';
import * as ctl from '../controllers/attendance.controller.js';

const router = Router();

router.use(requireAuth, requireRole('staff', 'admin'));

router.get('/my-status', ctl.myStatus);
router.post('/check-in', ctl.checkIn);
router.post('/check-out', ctl.checkOut);

export default router;
