import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import User from "../src/models/User.js";

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI;
const DB_NAME   = process.env.DB_NAME;

// nhận biết chuỗi đã là bcrypt chưa
const isBcrypt = (val) => typeof val === "string" && /^\$2[aby]\$/.test(val);

// (tuỳ chọn) nếu bạn muốn đặt mật khẩu "đẹp" thay vì dùng đúng giá trị đang lưu
// ví dụ: ai đang có 'hash_staff' => đặt lại thành 'staff123', ...
const PASSWORD_MAP = {
  "hash_staff": "staff123",
  "hash_user":  "user123",
};

(async () => {
  try {
    await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
    console.log("Connected. Migrating users...");

    const cursor = User.find({}, { email: 1, passwordHash: 1 }).cursor();
    let updated = 0, skipped = 0;

    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
      const cur = doc.passwordHash;

      if (isBcrypt(cur)) { skipped++; continue; }

      // chọn password gốc để hash:
      const raw = PASSWORD_MAP[cur] ?? String(cur); // nếu có map thì dùng, không thì lấy đúng giá trị đang có
      const hash = await bcrypt.hash(raw, 10);

      await User.updateOne({ _id: doc._id }, { $set: { passwordHash: hash } });
      console.log(`✔ Hashed: ${doc.email}`);
      updated++;
    }

    console.log(`Done. Updated: ${updated}, Skipped (already bcrypt): ${skipped}`);
  } catch (e) {
    console.error("Migrate error:", e);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
})();
