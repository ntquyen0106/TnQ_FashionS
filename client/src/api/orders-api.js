import http from './http';

export const ordersApi = {
  list: (params) => http.get('/orders', { params }).then((r) => r.data),
  getAny: (id) => http.get(`/orders/${id}`).then((r) => r.data),
  listMine: () => http.get('/order/mine').then((r) => r.data),
  get: (id) => http.get(`/order/${id}`).then((r) => r.data),
  cancelMine: (id, body = {}) => http.post(`/order/${id}/cancel`, body).then((r) => r.data),
  claim: (id) => http.post(`/orders/${id}/claim`).then((r) => r.data),
  assign: (id, staffId) => http.patch(`/orders/${id}/assign`, { staffId }).then((r) => r.data),
  updateStatus: (id, status) => http.patch(`/orders/${id}/status`, { status }).then((r) => r.data),
  updateItemVariant: (id, index, body) =>
    http.patch(`/orders/${id}/items/${index}`, body).then((r) => r.data),
  // Optional params: { from, to, status }
  statsMe: (params) => http.get('/orders/stats/me', { params }).then((r) => r.data),
  checkout: (body) => http.post('/order/checkout', body).then((r) => r.data),
};

export default ordersApi;
