import http from './http';

export const promotionsApi = {
  available: async (subtotal = 0, opts = {}) => {
    const params = { subtotal };
    if (opts.all) params.all = true;
    const { data } = await http.get('/promotions/available', {
      params,
      _noAutoToast: true,
    });
    return data;
  },
};

export default promotionsApi;
