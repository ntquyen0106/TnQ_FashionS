// src/api/http.js
import axios from 'axios';
import toast from 'react-hot-toast';

const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL + '/api',
  withCredentials: true,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Cookie-only: không gắn Authorization
http.interceptors.request.use((config) => config);

http.interceptors.response.use(
  (res) => {
    const method = (res.config.method || '').toUpperCase();
    const msg = res?.data?.message;
    if (msg && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      toast.success(msg);
    }
    return res;
  },
  (err) => {
    const reqUrl = err?.config?.url || '';
    const method = (err?.config?.method || '').toUpperCase();
    const status = err?.response?.status;
    const msg = err?.response?.data?.message || 'Có lỗi xảy ra';

    const onLoginPage = location.pathname.startsWith('/login');

    // ❗️Đừng làm ồn khi 401 từ /auth/me (bootstrap) hoặc đang ở trang login
    const isAuthMe = reqUrl.includes('/auth/me') && method === 'GET';
    if (status === 401) {
      if (!isAuthMe && !onLoginPage) {
        // Bạn có thể tùy chọn: không toast luôn để khỏi "thất bại" giả
        // toast.error('Phiên đăng nhập hết hạn, vui lòng đăng nhập lại');
        location.href = '/login';
      }
    } else {
      // Tránh toast trùng: không toast lỗi cho /auth/me
      if (!isAuthMe) toast.error(msg);
    }
    return Promise.reject(err);
  },
);

export default http;
