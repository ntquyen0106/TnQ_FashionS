import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import productRoutes from './routes/product.routes.js';
import categoryRoutes from './routes/category.routes.js';
import mediaRoute from './routes/media.route.js';
import cartRoutes from './routes/cart.routes.js';
import orderRoutes from './routes/order.routes.js'; // user-facing orders
import staffOrdersRoutes from './routes/orders.routes.js'; // staff/admin order management
import paymentRoutes from './routes/payment.routes.js';
import promotionRoutes from './routes/promotion.routes.js';
import inventoryRoutes from './routes/inventory.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import reviewRoutes from './routes/review.routes.js';
import shiftRoutes from './routes/shift.routes.js';
import { startShiftAutoCompleteJob } from './jobs/shift-auto-complete.js';
import attendanceRoutes from './routes/attendance.routes.js';
import { scheduleAutoConfirmJob } from './jobs/order-auto-confirm.js';

import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import adminUserRoutes from './routes/admin-user.routes.js';

import chatbotRoutes from './routes/chatbot.routes.js';
import trainingRoutes from './routes/training.routes.js';
import aiRoutes from './routes/ai.routes.js';

import swaggerUi from 'swagger-ui-express';
import { specs } from './config/swagger.js';

import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';

export const createApp = (clientUrl) => {
  const app = express();

  // Serve static files cho uploads
  app.use('/uploads', express.static('uploads'));

  // Log mọi request vào server
  app.use((req, res, next) => {
    console.log('[IN]', req.method, req.originalUrl);
    next();
  });

  app.set('trust proxy', 1);
  app.use(
    helmet({
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(morgan('dev'));
  app.use(express.json());
  app.use(cookieParser());

  const allowList = [clientUrl, 'http://localhost:5173', 'http://localhost:3000'].filter(Boolean);
  const allowPatterns = [/^http:\/\/localhost(?::\d+)?$/, /^http:\/\/127\.0\.0\.1(?::\d+)?$/];

  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true); // allow non-browser or same-origin
        if (allowList.includes(origin) || allowPatterns.some((re) => re.test(origin))) {
          return cb(null, true);
        }
        return cb(new Error('CORS not allowed'), false);
      },
      credentials: true,
    }),
  );

  // Health
  app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date() }));

  // Authentication & Users
  app.use('/api/auth', authRoutes); // login/register/me
  app.use('/api/user', userRoutes); // profile & settings
  app.use('/api/admin/users', adminUserRoutes); // admin user management

  // Core Catalog
  app.use('/api/products', productRoutes);
  app.use('/api/categories', categoryRoutes);
  app.use('/api/media', mediaRoute);
  app.use('/api/reviews', reviewRoutes);

  // Cart & Orders
  app.use('/api/cart', cartRoutes);
  app.use('/api/order', orderRoutes); // user-facing
  app.use('/api/orders', staffOrdersRoutes); // staff/admin management

  // Payments & Admin features
  app.use('/api/payment', paymentRoutes);
  app.use('/api/promotions', promotionRoutes);
  app.use('/api/inventory', inventoryRoutes);
  app.use('/api/reports', reportsRoutes);
  app.use('/api/shifts', shiftRoutes);
  app.use('/api/attendance', attendanceRoutes);

  // Chatbot & AI Training
  app.use('/api/chatbot', chatbotRoutes);
  app.use('/api/training', trainingRoutes);
  app.use('/api/ai', aiRoutes);

  // Swagger
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

  // 404 + error
  app.use(notFoundHandler);
  app.use(errorHandler);

  // Background jobs
  startShiftAutoCompleteJob();
  scheduleAutoConfirmJob();

  return app;
};
