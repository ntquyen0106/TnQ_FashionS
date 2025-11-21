import http from './http';
import { getSessionId } from '@/utils/session';

export const cartApi = {
  add: async ({ productId, variantSku, qty }) => {
    const sessionId = getSessionId();
    const { data } = await http.post(
      '/cart/add',
      { productId, variantSku, qty, sessionId },
      { _noAutoToast: true }, // tắt auto-toast
    );
    return data;
  },
  total: async ({ selectedItems } = {}) => {
    const sessionId = getSessionId();
    const params = { sessionId };
    if (selectedItems) params.selectedItems = JSON.stringify(selectedItems);
    const { data } = await http.get('/cart/total', { params, _noAutoToast: true });
    return data; // {subtotal, discount, grandTotal,...}
  },
  applyPromotion: async ({ code, selectedItems }) => {
    const sessionId = getSessionId();
    const { data } = await http.post('/cart/apply-promo', { sessionId, code, selectedItems });
    return data;
  },
  clearPromotion: async () => {
    const sessionId = getSessionId();
    const { data } = await http.post('/cart/clear-promo', { sessionId });
    return data;
  },
  mergeGuest: async () => {
    const sessionId = getSessionId();
    const { data } = await http.post('/cart/merge-guest', { sessionId });
    return data;
  },
  get: async () => {
    const sessionId = getSessionId();
    const { data } = await http.get('/cart', { params: { sessionId }, _noAutoToast: true });
    return data; // { items, subtotal, ... }
  },

  recommendations: async ({ limit = 6, requireContext = false } = {}) => {
    const sessionId = getSessionId();
    const params = { sessionId, limit };
    if (requireContext) params.requireContext = 'true';
    const { data } = await http.get('/cart/recommendations', {
      params,
      _noAutoToast: true,
    });
    return data?.items || [];
  },

  updateQty: async (itemId, qty) => {
    const sessionId = getSessionId();
    const { data } = await http.patch(`/cart/item/${itemId}/qty`, { qty, sessionId });
    return data;
  },
  updateVariant: async (itemId, variantSku) => {
    const sessionId = getSessionId();
    const { data } = await http.patch(`/cart/item/${itemId}/variant`, { variantSku, sessionId });
    return data;
  },
  remove: async (itemId) => {
    const sessionId = getSessionId();
    const { data } = await http.delete(`/cart/item/${itemId}`, { params: { sessionId } });
    return data;
  },
  removeMany: async (ids = []) => {
    const sessionId = getSessionId();
    const { data } = await http.post(`/cart/items/delete`, { ids, sessionId });
    return data;
  },
};

export default cartApi;
