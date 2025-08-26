import mongoose from "mongoose";

export const connectDB = async (uri, dbName) => {
  try {
    await mongoose.connect(uri, { dbName });
    console.log("✅ MongoDB connected:", dbName);
  } catch (err) {
    console.error("❌ MongoDB connect error:", err.message);
    process.exit(1);
  }
};
