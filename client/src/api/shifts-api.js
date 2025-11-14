import http from './http';

export const shiftApi = {
  templates: {
    list: (params) => http.get('/shifts/templates', { params }).then((r) => r.data),
    create: (body) => http.post('/shifts/templates', body).then((r) => r.data),
    update: (id, body) => http.put(`/shifts/templates/${id}`, body).then((r) => r.data),
    remove: (id) => http.delete(`/shifts/templates/${id}`).then((r) => r.data),
  },
  shifts: {
    list: (params) => http.get('/shifts', { params }).then((r) => r.data),
    create: (body) => http.post('/shifts', body).then((r) => r.data),
    update: (id, body) => http.put(`/shifts/${id}`, body).then((r) => r.data),
    remove: (id) => http.delete(`/shifts/${id}`).then((r) => r.data),
    mine: (params) => http.get('/shifts/my', { params }).then((r) => r.data),
  },
  swaps: {
    create: (body) => http.post('/shifts/swaps', body).then((r) => r.data),
    list: (params) => http.get('/shifts/swaps', { params }).then((r) => r.data),
    cancel: (id) => http.post(`/shifts/swaps/${id}/cancel`).then((r) => r.data),
    resolve: (id, body) => http.post(`/shifts/swaps/${id}/resolve`, body).then((r) => r.data),
  },
};

export default shiftApi;
