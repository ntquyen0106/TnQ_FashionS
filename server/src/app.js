import express from "express";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import productRoutes from "./routes/product.routes.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import authRoutes from "./routes/auth.routes.js";   // phải có .js
import helmet from "helmet";
import categoryRoutes from "./routes/category.routes.js";

export const createApp = (clientUrl) => {
  const app = express();

  app.set("trust proxy", 1);            // <-- thêm
  app.use(helmet());                    // <-- thêm
  app.use(morgan("dev"));
  app.use(express.json());
  app.use(cookieParser());

  app.use(cors({ origin: clientUrl, credentials: true }));

  app.get("/api/health", (req, res) => res.json({ ok: true, time: new Date() }));
  app.use("/api/auth", authRoutes);
  app.use("/api/products", productRoutes);
  app.use("/api/categories", categoryRoutes);
  app.use(errorHandler);
  return app;
};