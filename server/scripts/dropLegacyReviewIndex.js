import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import Review from '../src/models/Review.js';

dotenv.config();

async function run() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.DB_NAME;
  if (!uri || !dbName) {
    console.error('❌ Missing MONGODB_URI or DB_NAME in environment');
    process.exit(1);
  }

  try {
    await connectDB(uri, dbName);

    const indexes = await Review.collection.indexes();
    const legacyIdx = indexes.find((idx) => {
      const keys = idx.key || {};
      return idx.unique === true && keys.productId === 1 && keys.userId === 1;
    });

    if (!legacyIdx) {
      console.log('✅ No legacy unique index (productId_1_userId_1) found. Nothing to drop.');
    } else {
      const name = legacyIdx.name || 'productId_1_userId_1';
      await Review.collection.dropIndex(name);
      console.log(`✅ Dropped legacy review index: ${name}`);
    }

    // Ensure current indexes are in place
    await Review.syncIndexes();
    console.log('✅ Synced Review indexes.');
  } catch (err) {
    console.error('❌ Error while dropping legacy index:', err.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

run();
