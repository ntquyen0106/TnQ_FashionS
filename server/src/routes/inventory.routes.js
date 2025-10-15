import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/requireAuth.js';
import * as inv from '../controllers/inventory.controller.js';

const router = Router();

router.get('/', requireAuth, requireRole('staff', 'admin'), inv.list);
router.post('/adjust', requireAuth, requireRole('staff', 'admin'), inv.adjust);
router.patch('/reorder-point', requireAuth, requireRole('staff', 'admin'), inv.setReorderPoint);

export default router;
