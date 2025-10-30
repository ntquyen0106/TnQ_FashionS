// src/api/authApi.js
import http from './http';

export const authApi = {
  me: () => http.get('/auth/me').then((r) => r.data.user), // ← luôn trả user
  logout: () => http.post('/auth/logout').then((r) => r.data),

  login: (body) => http.post('/auth/login', body).then((r) => r.data),
  firebaseLogin: (idToken) => http.post('/auth/firebase-login', { idToken }).then((r) => r.data),

  register: (body) => http.post('/auth/register', body).then((r) => r.data),
  verifyPhone: (body) => http.post('/auth/verify-phone', body).then((r) => r.data),
  resendSignupOtp: (email) => http.post('/auth/resend-otp', { email }).then((r) => r.data),
  verifySignupOtp: ({ email, otp }) =>
    http.post('/auth/verify-otp', { email, otp }).then((r) => r.data),

  forgot: (email) => http.post('/auth/forgot', { email }).then((r) => r.data),
  verifyForgotOtp: ({ email, otp }) =>
    http.post('/auth/forgot/verify', { email, otp }).then((r) => r.data),
  resetPassword: ({ resetToken, newPassword }) =>
    http.post('/auth/forgot/reset', { resetToken, newPassword }).then((r) => r.data),

  // First-login password change (requires auth cookie)
  changePasswordFirst: ({ newPassword }) =>
    http.post('/auth/change-password-first', { newPassword }).then((r) => r.data),

  // Addresses
  getAddresses: () => http.get('/user/addresses').then((r) => r.data.addresses),
  addAddress: (address) => http.post('/user/addresses', { address }).then((r) => r.data),
  setDefaultAddress: (addressId) =>
    http.patch(`/user/addresses/${addressId}/default`).then((r) => r.data),
  updateAddress: (addressId, data) =>
    http.put(`/user/addresses/${addressId}`, data).then((r) => r.data),
  deleteAddress: (addressId) => http.delete(`/user/addresses/${addressId}`).then((r) => r.data),
  clearAddresses: () => http.delete('/user/addresses').then((r) => r.data),
  updateProfile: (data) => http.put('/user/profile', data).then((r) => r.data),
};
export default authApi;
