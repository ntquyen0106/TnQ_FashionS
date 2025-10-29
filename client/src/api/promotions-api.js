// src/api/promotions-api.js
import http from './http';

const promotionsApi = {
  available: async (subtotal = 0, opts = {}) => {
    const params = { subtotal };
    if (opts.all) params.all = true;
    // optional product/category context for server-side filtering
    if (opts.productIds && Array.isArray(opts.productIds))
      params.productIds = opts.productIds.join(',');
    if (opts.categoryIds && Array.isArray(opts.categoryIds))
      params.categoryIds = opts.categoryIds.join(',');
    const { data } = await http.get('/promotions/available', { params, _noAutoToast: true });
    return data;
  },
  list: async (params = {}) => {
    const { data } = await http.get('/promotions', { params });
    return data;
  },
  getById: async (id) => {
    const { data } = await http.get(`/promotions/${id}`);
    return data;
  },
  create: async (payload) => {
    const { data } = await http.post('/promotions', payload);
    return data;
  },
  update: async (id, payload) => {
    const { data } = await http.put(`/promotions/${id}`, payload);
    return data;
  },
  remove: async (id) => {
    const { data } = await http.delete(`/promotions/${id}`);
    return data;
  },
};

export default promotionsApi;
export { promotionsApi };
