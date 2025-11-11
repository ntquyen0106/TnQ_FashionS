import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env từ thư mục server (parent của src)
const envPath = resolve(__dirname, '../.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('❌ Lỗi load .env:', result.error);
} else {
  console.log(`✅ Loaded .env from: ${envPath}`);
  console.log(`   OPENROUTER_API_KEY: ${process.env.OPENROUTER_API_KEY ? 'Found ✓' : 'Missing ✗'}`);
}

import { createServer } from 'http';
import { connectDB } from './config/db.js';
import { createApp } from './app.js';
import { setupSocketIO, attachSocketIO } from './config/socket.js';
import { startOrderScheduler } from './services/order-scheduler.service.js';

const start = async () => {
  const PORT = process.env.PORT || 5000;
  await connectDB(process.env.MONGODB_URI, process.env.DB_NAME);

  const app = createApp(process.env.CLIENT_URL);
  const httpServer = createServer(app);

  // Setup Socket.IO
  const io = setupSocketIO(httpServer, process.env.CLIENT_URL);
  // expose io instance so downstream routers can access even if attachSocketIO runs late
  app.set('io', io);
  app.use(attachSocketIO(io));

  // Khởi động scheduler để tự động hủy đơn hàng quá hạn
  startOrderScheduler();

  httpServer.listen(PORT, () => {
    console.log(`🚀 API http://localhost:${PORT}`);
    console.log(`🔌 WebSocket ready for chat`);
  });
};
start();
