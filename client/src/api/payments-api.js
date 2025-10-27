import http from './http';

const paymentsApi = {
  check: (orderId) => http.get(`/payment/check/${orderId}`).then((r) => r.data),
  userCancelPayment: (orderId) =>
    http.post(`/payment/cancel-payment/${orderId}`).then((r) => r.data),
  createLink: (orderId) => http.post(`/payment/create-link/${orderId}`).then((r) => r.data),
};

export default paymentsApi;
