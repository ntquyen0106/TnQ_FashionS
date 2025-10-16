// src/api/http.js
import axios from 'axios';
import toast from 'react-hot-toast';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api';
const http = axios.create({
  baseURL: API_BASE,
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
    // Cho phép tắt auto toast bằng config._noAutoToast
    const noToast = res?.config?._noAutoToast === true;
    if (!noToast && msg && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      toast.success(msg);
    }
    return res;
  },
  (err) => {
    const reqUrl = err?.config?.url || '';
    const method = (err?.config?.method || '').toUpperCase();
    const status = err?.response?.status;
    const msg = err?.response?.data?.message || 'Có lỗi xảy ra';
    const noToast = err?.config?._noAutoToast === true;

    const onLoginPage = location.pathname.startsWith('/login');

    // ❗️Đừng làm ồn khi 401 từ /auth/me (bootstrap) hoặc đang ở trang login
    const isAuthMe = reqUrl.includes('/auth/me') && method === 'GET';
    if (status === 401) {
      // Tránh tự động redirect khi là GET (các trang sẽ tự xử lý bằng guard)
      if (!isAuthMe && !onLoginPage && method !== 'GET') {
        // toast.error('Phiên đăng nhập hết hạn, vui lòng đăng nhập lại');
        location.href = '/login';
      }
    } else {
      // Tránh toast trùng: không toast lỗi cho /auth/me
      if (!isAuthMe && !noToast) toast.error(msg);
    }
    return Promise.reject(err);
  },
);

export default http;
