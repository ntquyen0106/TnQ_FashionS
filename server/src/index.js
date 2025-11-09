import dotenv from 'dotenv';
dotenv.config();
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
  app.use(attachSocketIO(io));

  // Khởi động scheduler để tự động hủy đơn hàng quá hạn
  startOrderScheduler();
  
  httpServer.listen(PORT, () => {
    console.log(`🚀 API http://localhost:${PORT}`);
    console.log(`🔌 WebSocket ready for chat`);
  });
};
start();
