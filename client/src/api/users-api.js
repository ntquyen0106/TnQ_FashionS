// src/api/users-api.js
import http from './http';

export const usersApi = {
  list: (params) => http.get('/admin/users', { params }).then((r) => r.data),
  detail: (id) => http.get(`/admin/users/${id}`).then((r) => r.data),
  create: (body) => http.post('/admin/users', body).then((r) => r.data),
  update: (id, body) => http.put(`/admin/users/${id}`, body).then((r) => r.data),
  remove: (id) => http.delete(`/admin/users/${id}`).then((r) => r.data),
  patchStatus: (id, status) =>
    http.patch(`/admin/users/${id}/status`, { status }).then((r) => r.data),
  sendSetPassword: (id) => http.post(`/admin/users/${id}/send-set-password`).then((r) => r.data),
};
