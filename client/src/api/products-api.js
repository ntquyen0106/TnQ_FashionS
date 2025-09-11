import http from './http';

export const productsApi = {
  list: (params) => http.get('/products', { params }).then((r) => r.data),
  detail: (id) => http.get(`/products/${id}`).then((r) => r.data),
  create: (body) => http.post('/products', body).then((r) => r.data),
  update: (id, body) => http.put(`/products/${id}`, body).then((r) => r.data),
  remove: (id) => http.delete(`/products/${id}`).then((r) => r.data),
};
