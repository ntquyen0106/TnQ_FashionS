import { Router } from 'express';
import { listAvailable } from '../controllers/promotion.controller.js';

const router = Router();

router.get('/available', listAvailable);

export default router;
