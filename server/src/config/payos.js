import 'dotenv/config';
import { PayOS } from '@payos/node';

const CLIENT_ID = (process.env.PAYOS_CLIENT_ID || '').trim();
const API_KEY = (process.env.PAYOS_API_KEY || '').trim();
const CHECKSUM_KEY = (process.env.PAYOS_CHECKSUM_KEY || '').trim();

if (!CLIENT_ID || !API_KEY || !CHECKSUM_KEY) {
  // Cảnh báo rõ ràng nếu thiếu
  console.warn(
    '[PayOS] Missing credentials. Please set PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY in server/.env',
  );
}

const payos = new PayOS(CLIENT_ID, API_KEY, CHECKSUM_KEY);

export default payos;
