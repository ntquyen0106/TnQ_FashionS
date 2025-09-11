// src/api/http.js
import axios from 'axios';
import toast from 'react-hot-toast';

const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL + '/api',
  withCredentials: true,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

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
    const status = err?.response?.status;
    const msg = err?.response?.data?.message || 'Có lỗi xảy ra';

    if (status === 401) {
      localStorage.removeItem('access_token');
      if (!location.pathname.startsWith('/login')) location.href = '/login';
    } else {
      toast.error(msg);
    }
    return Promise.reject(err);
  },
);

export default http;
