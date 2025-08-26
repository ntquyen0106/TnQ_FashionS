import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import { createApp } from "./app.js";

dotenv.config();

const start = async () => {
  await connectDB(process.env.MONGODB_URI, process.env.DB_NAME);
  const app = createApp(process.env.CLIENT_URL);
  app.listen(process.env.PORT, () => {
    console.log(`🚀 API http://localhost:${process.env.PORT}`);
  });
};
start();
