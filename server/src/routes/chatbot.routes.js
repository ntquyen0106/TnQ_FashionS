import express from 'express';
import { optionalAuth, requireAuth, requireRole } from '../middlewares/requireAuth.js';
import {
  postSendMessage,
  getHistory,
  postRequestStaff,
  postResolveSession,
  deleteClearSession,
  postStaffSendMessage,
  getStaffSessions,
  postToggleAI,
  postTrainingData,
  putTrainingData,
  getTrainingData,
  deleteTrainingData,
} from '../controllers/chatbot.controller.js';

const router = express.Router();

// ============ Customer/Public routes ============
router.post('/message', optionalAuth, postSendMessage);
router.get('/history/:sessionId', getHistory);
router.post('/request-staff', postRequestStaff);
router.post('/resolve', postResolveSession);
router.delete('/session/:sessionId', deleteClearSession);

// ============ Staff routes ============
router.post('/staff/message', requireAuth, requireRole('staff', 'admin'), postStaffSendMessage);
router.get('/staff/sessions', requireAuth, requireRole('staff', 'admin'), getStaffSessions);
router.post('/staff/toggle-ai', requireAuth, requireRole('staff', 'admin'), postToggleAI);

// ============ Training/Admin routes ============
router.post('/training/policy', requireAuth, requireRole('staff', 'admin'), postTrainingData);
router.put('/training/policy/:id', requireAuth, requireRole('staff', 'admin'), putTrainingData);
router.get('/training/policies', requireAuth, requireRole('staff', 'admin'), getTrainingData);
router.delete('/training/policy/:id', requireAuth, requireRole('admin'), deleteTrainingData);

export default router;
