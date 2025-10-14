import Promotion from '../models/Promotion.js';

// List promotions with optional filters (status, active window)
export const listPromotions = async (query = {}) => {
  const {
    status,
    active, // 'true' to filter only currently active promotions by time window
  } = query;

  const now = new Date();
  const cond = {};
  if (status) cond.status = status;
  if (String(active).toLowerCase() === 'true') {
    cond.startAt = { $lte: now };
    cond.endAt = { $gte: now };
    cond.status = cond.status || 'active';
  }
  return Promotion.find(cond).sort({ createdAt: -1 });
};

export const getPromotion = async (id) => {
  return Promotion.findById(id);
};

export const createPromotion = async (data) => {
  // Basic normalization
  if (data.code) data.code = String(data.code).trim().toUpperCase();
  return Promotion.create(data);
};

export const updatePromotion = async (id, data) => {
  if (data.code) data.code = String(data.code).trim().toUpperCase();
  return Promotion.findByIdAndUpdate(id, data, { new: true });
};

export const deletePromotion = async (id) => {
  await Promotion.findByIdAndDelete(id);
  return true;
};
