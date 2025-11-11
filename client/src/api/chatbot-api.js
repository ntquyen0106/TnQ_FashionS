import http from './http';

export const chatbotApi = {
  // Training/Policy APIs - Quản lý dữ liệu training cho chatbot
  getAllPolicies: (params) => http.get('/training/policies', { params }).then((r) => r.data),
  getPolicyById: (id) => http.get(`/training/policies/${id}`).then((r) => r.data),
  createPolicy: (body) => http.post('/training/policies', body).then((r) => r.data),
  updatePolicy: (id, body) => http.put(`/training/policies/${id}`, body).then((r) => r.data),
  deletePolicy: (id) => http.delete(`/training/policies/${id}`).then((r) => r.data),
  togglePolicyStatus: (id) => http.patch(`/training/policies/${id}/toggle`).then((r) => r.data),

  // Chat APIs - User chat với bot
  sendMessage: (body) => http.post('/chatbot/message', body).then((r) => r.data),
  getHistory: (sessionId, limit) =>
    http.get(`/chatbot/history/${sessionId}`, { params: { limit } }).then((r) => r.data),
  requestStaff: (sessionId, customerInfo) =>
    http.post('/chatbot/request-staff', { sessionId, customerInfo }).then((r) => r.data),
  toggleAIPublic: (body) => http.post('/chatbot/toggle-ai', body).then((r) => r.data),

  // Staff APIs - Nhân viên chat với khách
  getStaffSessions: (params) => http.get('/chatbot/staff/sessions', { params }).then((r) => r.data),
  sendStaffMessage: (body) => http.post('/chatbot/staff/message', body).then((r) => r.data),
  toggleAI: (body) => http.post('/chatbot/staff/toggle-ai', body).then((r) => r.data),
  acceptSession: (body) => http.post('/chatbot/staff/accept', body).then((r) => r.data),
  resolveSession: (body) => http.post('/chatbot/resolve', body).then((r) => r.data),

  // Upload media - for both customer and staff
  uploadChatMedia: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return http
      .post('/chatbot/upload-media', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

  // Staff upload (kept for backward compatibility)
  uploadStaffMedia: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return http
      .post('/chatbot/staff/upload-media', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },
};
