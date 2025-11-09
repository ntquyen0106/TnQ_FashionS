import express from 'express';
import { requireAuth, requireRole } from '../middlewares/requireAuth.js';
import {
  getAllPolicies,
  createPolicy,
  getPolicyById,
  updatePolicy,
  deletePolicy,
  togglePolicyStatus,
} from '../controllers/training.controller.js';

const router = express.Router();

// ============ Policy CRUD ============
/**
 * GET /api/training/policies
 * Get all policies (grouped by type)
 */
router.get('/policies', requireAuth, requireRole('staff', 'admin'), getAllPolicies);

/**
 * POST /api/training/policies
 * Create new policy
 */
router.post('/policies', requireAuth, requireRole('staff', 'admin'), createPolicy);

/**
 * GET /api/training/policies/:id
 * Get single policy by ID
 */
router.get('/policies/:id', requireAuth, requireRole('staff', 'admin'), getPolicyById);

/**
 * PUT /api/training/policies/:id
 * Update policy
 */
router.put('/policies/:id', requireAuth, requireRole('staff', 'admin'), updatePolicy);

/**
 * DELETE /api/training/policies/:id
 * Delete policy (admin only)
 */
router.delete('/policies/:id', requireAuth, requireRole(['admin']), deletePolicy);

/**
 * PATCH /api/training/policies/:id/toggle
 * Toggle policy active/inactive
 */
router.patch('/policies/:id/toggle', requireAuth, requireRole('staff', 'admin'), togglePolicyStatus);

export default router;
