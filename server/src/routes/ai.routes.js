import express from 'express';
import { getProductsForAI } from '../controllers/ai-products.controller.js';

const router = express.Router();

/**
 * @route   GET /api/ai/products
 * @desc    Get products formatted for AI context
 * @access  Internal (for chatbot service)
 */
router.get('/products', getProductsForAI);

export default router;
