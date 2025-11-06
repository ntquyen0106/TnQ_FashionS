import 'dotenv/config';
import { Router } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { requireAuth, requireRole } from '../middlewares/requireAuth.js';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/media/upload
router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Missing file' });

    // Determine resource type from mimetype
    const mimeType = req.file.mimetype || '';
    let resourceType = 'image'; // default
    if (mimeType.startsWith('video/')) {
      resourceType = 'video';
    } else if (mimeType.startsWith('audio/')) {
      resourceType = 'raw'; // or 'video' depending on use case
    }

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'products',
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
      duration: result.duration, // For videos
    });
  } catch (e) {
    next(e);
  }
});

// GET /api/media/search?prefix=products&page=1&pageSize=30
router.get('/search', requireAuth, requireRole('admin', 'staff'), async (req, res, next) => {
  try {
    const { prefix = 'products', nextCursor, max = 30 } = req.query;
    const result = await cloudinary.search
      .expression(`folder:${prefix} AND resource_type:image`)
      .sort_by('created_at', 'desc')
      .max_results(Math.min(100, Number(max) || 30))
      .next_cursor(nextCursor || undefined)
      .execute();

    const items = result.resources.map((r) => ({
      publicId: r.public_id,
      format: r.format,
      width: r.width,
      height: r.height,
      url: r.secure_url,
      createdAt: r.created_at,
    }));
    res.json({ items, nextCursor: result.next_cursor || null });
  } catch (e) {
    next(e);
  }
});

export default router;
