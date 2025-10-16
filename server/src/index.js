import dotenv from 'dotenv';
dotenv.config();
import { connectDB } from './config/db.js';
import { createApp } from './app.js';

const start = async () => {
  const PORT = process.env.PORT || 5000;
  await connectDB(process.env.MONGODB_URI, process.env.DB_NAME);
  const app = createApp(process.env.CLIENT_URL);
  app.listen(PORT, () => {
    console.log(`🚀 API http://localhost:${PORT}`);
  });
};
start();
//test
