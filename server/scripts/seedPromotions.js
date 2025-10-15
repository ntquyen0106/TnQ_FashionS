import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import Promotion from '../src/models/Promotion.js';

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

async function run() {
  try {
    const uri = process.env.MONGODB_URI;
    const dbName = process.env.DB_NAME;
    if (!uri || !dbName) throw new Error('Missing MONGODB_URI or DB_NAME');
    await connectDB(uri, dbName);

    const now = new Date();
    const startAt = addDays(now, -1); // bắt đầu từ hôm qua để chắc chắn đã hiệu lực
    const endAt = addDays(now, 60); // hiệu lực 60 ngày

    const promos = [
      {
        code: 'WELCOME10',
        type: 'percent',
        value: 10,
        minOrder: 500_000,
        appliesTo: 'all',
        targetIds: [],
        startAt,
        endAt,
        status: 'active',
      },
      {
        code: 'SAVE50K',
        type: 'amount',
        value: 50_000,
        minOrder: 300_000,
        appliesTo: 'all',
        targetIds: [],
        startAt,
        endAt,
        status: 'active',
      },
      {
        code: 'MIDSEASON15',
        type: 'percent',
        value: 15,
        minOrder: 800_000,
        appliesTo: 'all',
        targetIds: [],
        startAt,
        endAt,
        status: 'active',
      },
    ];

    // Xoá các mã trùng code nếu có, sau đó tạo mới
    const codes = promos.map((p) => p.code);
    await Promotion.deleteMany({ code: { $in: codes } });
    await Promotion.insertMany(promos);

    console.log('✅ Seeded promotions:', codes.join(', '));
  } catch (err) {
    console.error('❌ Seed promotions error:', err.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

run();
