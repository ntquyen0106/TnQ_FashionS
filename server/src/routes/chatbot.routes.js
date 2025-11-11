import express from 'express';
import multer from 'multer';
import cloudinary from '../config/cloudinary.js';
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
  postToggleAIPublic,
  postStaffAccept,
  postTrainingData,
  putTrainingData,
  getTrainingData,
  deleteTrainingData,
} from '../controllers/chatbot.controller.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Ensure Socket.IO instance is available on every chatbot request
router.use((req, res, next) => {
  if (!req.io) {
    req.io = req.app?.get('io');
  }
  next();
});

// ============ Customer/Public routes ============
// Upload media for customers (no auth required, but optionalAuth to track user)
router.post('/upload-media', optionalAuth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Missing file' });

    // Determine resource type from mimetype
    const mimeType = req.file.mimetype || '';
    let resourceType = 'image';
    if (mimeType.startsWith('video/')) {
      resourceType = 'video';
    }

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'chatbot-media',
          resource_type: resourceType,
          use_filename: true,
          unique_filename: true,
          overwrite: false,
        },
        (err, r) => (err ? reject(err) : resolve(r)),
      );
      stream.end(req.file.buffer);
    });

    return res.json({
      publicId: result.public_id,
      url: result.secure_url,
      width: result.width,
      height: result.height,
      format: result.format,
      resourceType: result.resource_type,
      duration: result.duration,
    });
  } catch (e) {
    next(e);
  }
});

router.post('/message', optionalAuth, postSendMessage);
router.get('/history/:sessionId', getHistory);
router.post('/request-staff', postRequestStaff);
router.post('/toggle-ai', postToggleAIPublic);
router.post('/resolve', postResolveSession);
router.delete('/session/:sessionId', deleteClearSession);

// ============ Staff routes ============
router.post(
  '/staff/upload-media',
  requireAuth,
  requireRole('staff', 'admin'),
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Missing file' });

      // Determine resource type from mimetype
      const mimeType = req.file.mimetype || '';
      let resourceType = 'image';
      if (mimeType.startsWith('video/')) {
        resourceType = 'video';
      }

      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'chatbot-media',
            resource_type: resourceType,
            use_filename: true,
            unique_filename: true,
            overwrite: false,
          },
          (err, r) => (err ? reject(err) : resolve(r)),
        );
        stream.end(req.file.buffer);
      });

      return res.json({
        publicId: result.public_id,
        url: result.secure_url,
        width: result.width,
        height: result.height,
        format: result.format,
        resourceType: result.resource_type,
        duration: result.duration,
      });
    } catch (e) {
      next(e);
    }
  },
);

router.post('/staff/message', requireAuth, requireRole('staff', 'admin'), postStaffSendMessage);
router.get('/staff/sessions', requireAuth, requireRole('staff', 'admin'), getStaffSessions);
router.post('/staff/toggle-ai', requireAuth, requireRole('staff', 'admin'), postToggleAI);
router.post('/staff/accept', requireAuth, requireRole('staff', 'admin'), postStaffAccept);

// ============ Training/Admin routes ============
router.post('/training/policy', requireAuth, requireRole('staff', 'admin'), postTrainingData);
router.put('/training/policy/:id', requireAuth, requireRole('staff', 'admin'), putTrainingData);
router.get('/training/policies', requireAuth, requireRole('staff', 'admin'), getTrainingData);
router.delete('/training/policy/:id', requireAuth, requireRole('admin'), deleteTrainingData);

export default router;
