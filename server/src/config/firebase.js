import admin from "firebase-admin";
import path from "path";

const serviceAccount = require(path.resolve("firebase-service-account.json")); // Đặt file JSON key của Firebase tại thư mục gốc server

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export default admin;