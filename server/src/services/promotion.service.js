import Promotion from '../models/Promotion.js';

export const listPromotions = async (filter = {}) => {
  return Promotion.find(filter).sort({ createdAt: -1 });
};

export const getPromotion = async (id) => {
  return Promotion.findById(id);
};

export const createPromotion = async (data) => {
  return Promotion.create(data);
};

export const updatePromotion = async (id, data) => {
  return Promotion.findByIdAndUpdate(id, data, { new: true });
};

export const deletePromotion = async (id) => {
  return Promotion.findByIdAndDelete(id);
};