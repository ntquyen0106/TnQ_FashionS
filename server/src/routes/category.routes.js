// routes/category.routes.js
import { Router } from 'express';
import * as ctrl from '../controllers/category.controller.js';
import { requireAuth, requireRole } from '../middlewares/requireAuth.js';
const router = Router();

router.get('/', ctrl.getAllCategories);
router.get('/children', ctrl.getChildren);
router.get('/breadcrumb', ctrl.getBreadcrumb);
router.post('/', requireAuth, requireRole('admin'), ctrl.createCategory);
router.put('/:id', requireAuth, requireRole('admin'), ctrl.updateCategory);
router.delete('/:id', requireAuth, requireRole('admin'), ctrl.deleteCategory);
export default router;
