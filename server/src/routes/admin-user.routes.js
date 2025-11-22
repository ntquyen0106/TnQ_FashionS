import { Router } from 'express';
import * as adminUserController from '../controllers/admin-user.controller.js';
import { requireAuth, requireRole } from '../middlewares/requireAuth.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));

/* ==================== USER ANALYTICS ROUTES ==================== */
router.get('/analytics/new-users', adminUserController.getNewUsersByTime); // GET /admin/users/analytics/new-users?period=today|7days|thisMonth|custom&from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/analytics/overview', adminUserController.getUsersOverview); // GET /admin/users/analytics/overview
router.get('/analytics/top-customers', adminUserController.getTopCustomers); // GET /admin/users/analytics/top-customers?limit=10&from=YYYY-MM-DD&to=YYYY-MM-DD&sortBy=revenue|orders|avgOrder
router.get('/analytics/login-heatmap', adminUserController.getLoginHeatmap); // GET /admin/users/analytics/login-heatmap?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/analytics/geography', adminUserController.getUsersByGeography); // GET /admin/users/analytics/geography?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/analytics/online', adminUserController.getOnlineUsers); // GET /admin/users/analytics/online (Real-time Socket.IO stats)

/* ==================== USER CRUD OPERATIONS ==================== */
router.get('/', adminUserController.getAllUsers); // GET /admin/users?name&email&role&fromDate&toDate&page=1&size=10&sortBy&sortDirection=(asc|desc)
router.post('/', adminUserController.postCreateUser); // POST /admin/users { email, name, password, role?, status? }
router.get('/:id', adminUserController.getUser); // GET /admin/users/:id
router.put('/:id', adminUserController.putUpdateUser); // PUT /admin/users/:id { email?, name?, role?, status? }
router.delete('/:id', adminUserController.deleteOneUser); // DELETE /admin/users/:id
// Patch status (active/banned)
router.patch('/:id/status', adminUserController.putUpdateUser); // PATCH /admin/users/:id/status { status }
// Send set-password OTP/link to user
router.post('/:id/send-set-password', adminUserController.postSendSetPassword);

export default router;
