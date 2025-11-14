import http from './http';

export const attendanceApi = {
  myStatus: () => http.get('/attendance/my-status').then((r) => r.data),
  checkIn: () => http.post('/attendance/check-in').then((r) => r.data),
  checkOut: (shiftId) => http.post('/attendance/check-out', { shiftId }).then((r) => r.data),
};

export default attendanceApi;
