import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import productRoutes from './routes/product.routes.js';
import { errorHandler } from './middlewares/error.middleware.js';
import authRoutes from './routes/auth.routes.js'; // phải có .js
import helmet from 'helmet';
import categoryRoutes from './routes/category.routes.js';
import mediaRoute from './routes/media.route.js';
import cartRoutes from './routes/cart.routes.js';
import orderRoutes from './routes/order.routes.js';


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

  app.use(
    cors({
      origin: ['http://localhost:5173', 'http://localhost:3000'], // FE origin
      credentials: true, // cho phép gửi cookie
    }),
  );

  app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date() }));
  app.use('/api/auth', authRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/categories', categoryRoutes);
  app.use('/api', mediaRoute);
  app.use(errorHandler);
  app.use('/api/cart', cartRoutes);
  app.use('/api/order', orderRoutes);
  return app;
};
