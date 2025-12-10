import http from './http';

const reviewsApi = {
  create: ({ orderId, reviews }) => http.post('/reviews', { orderId, reviews }).then((r) => r.data),
  byProduct: (productId, { page = 1, limit = 10 } = {}) =>
    http.get(`/reviews/product/${productId}`, { params: { page, limit } }).then((r) => r.data),
  mine: () => http.get('/reviews/me').then((r) => r.data),
  staffList: (params = {}) => http.get('/reviews/manage', { params }).then((r) => r.data),
  staffDetail: (reviewId) => http.get(`/reviews/manage/${reviewId}`).then((r) => r.data),
  staffStats: (params = {}) => http.get('/reviews/manage/stats', { params }).then((r) => r.data),
  reply: (reviewId, payload) =>
    http.post(`/reviews/${reviewId}/replies`, payload).then((r) => r.data),
  updateReply: (reviewId, replyId, payload) =>
    http.put(`/reviews/${reviewId}/replies/${replyId}`, payload).then((r) => r.data),
  deleteReply: (reviewId, replyId) =>
    http.delete(`/reviews/${reviewId}/replies/${replyId}`).then((r) => r.data),
  manageStats: (params = {}) => http.get('/reviews/manage/stats', { params }).then((r) => r.data),
  acknowledgeMany: (payload) =>
    http.post('/reviews/manage/acknowledge', payload).then((r) => r.data),
};

export default reviewsApi;
export { reviewsApi };
