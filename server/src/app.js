import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import productRoutes from './routes/product.routes.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';
import authRoutes from './routes/auth.routes.js'; // phải có .js
import helmet from 'helmet';
import categoryRoutes from './routes/category.routes.js';
import mediaRoute from './routes/media.route.js';
import cartRoutes from './routes/cart.routes.js';
import orderRoutes from './routes/order.routes.js';
import staffOrdersRoutes from './routes/orders.routes.js';
import promotionRoutes from './routes/promotion.routes.js';
import inventoryRoutes from './routes/inventory.routes.js';

export const createApp = (clientUrl) => {
  const app = express();

  app.set('trust proxy', 1); // <-- thêm
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
      credentials: true, // allow cookies
    }),
  );

  app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date() }));
  app.use('/api/auth', authRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/categories', categoryRoutes);
  app.use('/api/media', mediaRoute);
  app.use('/api/cart', cartRoutes);
  app.use('/api/order', orderRoutes); // user-facing
  app.use('/api/orders', staffOrdersRoutes); // staff/admin management
  app.use('/api/promotions', promotionRoutes);
  app.use('/api/inventory', inventoryRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};
