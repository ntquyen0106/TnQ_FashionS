// src/api/promotions-api.js
import http from './http';

const promotionsApi = {
  available: async (subtotal = 0, opts = {}) => {
    const params = { subtotal };
    if (opts.all) params.all = true;
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
