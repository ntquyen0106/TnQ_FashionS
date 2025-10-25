import http from './http';

export const usersApi = {
  list: (params) => http.get('/admin/users', { params }).then((r) => r.data), // ví dụ: { role: 'staff' }
  detail: (id) => http.get(`/users/${id}`).then((r) => r.data),
  create: (body) => http.post('/users', body).then((r) => r.data),
  update: (id, body) => http.put(`/users/${id}`, body).then((r) => r.data),
  remove: (id) => http.delete(`/users/${id}`).then((r) => r.data),
};
