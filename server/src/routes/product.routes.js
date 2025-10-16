import { Router } from 'express';
import * as ctrl from '../controllers/product.controller.js';
import { requireAuth, requireRole, optionalAuth } from '../middlewares/requireAuth.js';

const router = Router();

//All role
router.get('/', ctrl.list);
router.get('/slug/:slug', ctrl.getOneBySlug);
router.get('/category/:categoryId', ctrl.listByCategory ?? ctrl.getProductsByCategory);
router.get('/:id', optionalAuth, ctrl.getOne);

//admin, staff role
router.post('/', requireAuth, requireRole('admin', 'staff'), ctrl.create);
router.put('/:id', requireAuth, requireRole('admin', 'staff'), ctrl.update);
router.delete('/:id', requireAuth, requireRole('admin'), ctrl.remove);

export default router;
