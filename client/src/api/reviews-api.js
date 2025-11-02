import http from './http';

const reviewsApi = {
  create: ({ orderId, rating, comment }) =>
    http.post('/reviews', { orderId, rating, comment }).then((r) => r.data),
  byProduct: (productId, { page = 1, limit = 10 } = {}) =>
    http.get(`/reviews/product/${productId}`, { params: { page, limit } }).then((r) => r.data),
  mine: () => http.get('/reviews/me').then((r) => r.data),
};

export default reviewsApi;
export { reviewsApi };
