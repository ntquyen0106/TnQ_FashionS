import http from './http';

export const productsApi = {
  // Lấy list sản phẩm, hỗ trợ query: path, q, sort, page, limit
  list: (params) => http.get('/products', { params }).then((r) => r.data),

  // Chi tiết theo id (ObjectId) – dùng trong trang admin
  detail: (id) => http.get(`/products/${id}`).then((r) => r.data),

  // Chi tiết theo slug (public product detail page)
  detailBySlug: (slug) => http.get(`/products/slug/${slug}`).then((r) => r.data),

  // (Tuỳ chọn) lấy list theo categoryId
  listByCategory: (categoryId, params) =>
    http.get(`/products/category/${categoryId}`, { params }).then((r) => r.data),

  // CRUD
  create: (body) => http.post('/products', body).then((r) => r.data),

  update: (id, body) => http.put(`/products/${id}`, body).then((r) => r.data),

  remove: (id) => http.delete(`/products/${id}`).then((r) => r.data),
};
