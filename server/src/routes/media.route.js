import { Router } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/media/upload
router.post('/media/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Missing file' });

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'products', // <-- tuỳ bạn
          resource_type: 'image',
          use_filename: true,
          unique_filename: true,
          overwrite: false,
        },
        (err, r) => (err ? reject(err) : resolve(r)),
      );
      stream.end(req.file.buffer);
    });

    return res.json({
      publicId: result.public_id, // <-- FE/DB dùng cái này
      url: result.secure_url,
      width: result.width,
      height: result.height,
      format: result.format,
    });
  } catch (e) {
    next(e);
  }
});

export default router;
