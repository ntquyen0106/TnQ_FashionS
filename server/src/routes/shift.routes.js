import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/requireAuth.js';
import * as ctrl from '../controllers/shift.controller.js';

const router = Router();

router.use(requireAuth);

// Templates
router.get('/templates', requireRole('admin', 'staff'), ctrl.listTemplates);
router.post('/templates', requireRole('admin'), ctrl.createTemplate);
router.put('/templates/:id', requireRole('admin'), ctrl.updateTemplate);
router.delete('/templates/:id', requireRole('admin'), ctrl.deleteTemplate);

// Shift assignments
router.get('/', requireRole('admin', 'staff'), ctrl.listShifts);
router.post('/', requireRole('admin'), ctrl.createShifts);
router.put('/:id', requireRole('admin'), ctrl.updateShift);
router.delete('/:id', requireRole('admin'), ctrl.deleteShift);

// Staff personal view
router.get('/my', requireRole('admin', 'staff'), ctrl.getMyShifts);

// Swap requests
router.post('/swaps', requireRole('staff', 'admin'), ctrl.createSwapRequest);
router.get('/swaps', requireRole('admin'), ctrl.listSwapRequests);
router.post('/swaps/:id/cancel', requireRole('staff', 'admin'), ctrl.cancelSwapRequest);
router.post('/swaps/:id/resolve', requireRole('admin'), ctrl.resolveSwapRequest);

export default router;
