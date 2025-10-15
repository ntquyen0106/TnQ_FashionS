import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/requireAuth.js';
import * as orderCtl from '../controllers/order.controller.js';

const router = Router();

// List orders with filters (staff/admin)
router.get('/', requireAuth, requireRole('staff', 'admin'), orderCtl.list);

// Personal stats for current staff — must be before '/:id'
router.get('/stats/me', requireAuth, requireRole('staff', 'admin'), orderCtl.statsMe);

// Get one order by id (staff/admin)
router.get('/:id', requireAuth, requireRole('staff', 'admin'), orderCtl.getOneAny);

// Claim an unassigned order (PENDING)
router.post('/:id/claim', requireAuth, requireRole('staff', 'admin'), orderCtl.claim);

// Assign to a staff (admin only)
router.patch('/:id/assign', requireAuth, requireRole('admin'), orderCtl.assign);

// Update status (staff/admin)
router.patch('/:id/status', requireAuth, requireRole('staff', 'admin'), orderCtl.updateStatus);

export default router;
