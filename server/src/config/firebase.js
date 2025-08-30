// server/src/config/firebase.js (ESM, không require)
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Tính __dirname trong ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Đường dẫn tới server/firebase-service-account.json
const jsonPath = path.resolve(__dirname, '../../firebase-service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

// Khởi tạo Firebase Admin 1 lần
if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

// Export auth instance để dùng nơi khác
export const adminAuth = getAuth();