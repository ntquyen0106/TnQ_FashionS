import http from './http';

export const reportsApi = {
  overview: (params) => http.get('/reports/overview', { params }).then((r) => r.data),
  slowMoving: (params) => http.get('/reports/slow-moving', { params }).then((r) => r.data),
  ordersByStaff: (params) => http.get('/reports/orders-by-staff', { params }).then((r) => r.data),
  topProducts: (params) => http.get('/reports/top-products', { params }).then((r) => r.data),
  dailyOrders: (params) => http.get('/reports/daily-orders', { params }).then((r) => r.data),
};

export default reportsApi;
