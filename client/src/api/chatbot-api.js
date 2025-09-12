import http from './http';

export const chatbotApi = {
  listTemplates: (q) =>
    http.get('/chatbot/templates', { params: { q: q || undefined } }).then((r) => r.data),
  createTemplate: (body) => http.post('/chatbot/templates', body).then((r) => r.data),
  deleteTemplate: (id) => http.delete(`/chatbot/templates/${id}`).then((r) => r.data),
};
