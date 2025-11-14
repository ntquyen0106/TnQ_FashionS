import http from './http';

export const staffApi = {
  statsMe: (params) => http.get('/staff/stats/me', { params }).then((r) => r.data),
};

export default staffApi;
