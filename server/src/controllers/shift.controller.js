import * as shiftService from '../services/shift.service.js';

export const listTemplates = async (req, res, next) => {
  try {
    const templates = await shiftService.listTemplates(req.query);
    res.json(templates);
  } catch (e) {
    next(e);
  }
};

export const createTemplate = async (req, res, next) => {
  try {
    const doc = await shiftService.createTemplate(req.body);
    res.status(201).json(doc);
  } catch (e) {
    next(e);
  }
};

export const updateTemplate = async (req, res, next) => {
  try {
    const doc = await shiftService.updateTemplate(req.params.id, req.body);
    res.json(doc);
  } catch (e) {
    next(e);
  }
};

export const deleteTemplate = async (req, res, next) => {
  try {
    await shiftService.deleteTemplate(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (e) {
    next(e);
  }
};

export const listShifts = async (req, res, next) => {
  try {
    const list = await shiftService.listShifts(req.query);
    res.json(list);
  } catch (e) {
    next(e);
  }
};

export const createShifts = async (req, res, next) => {
  try {
    const created = await shiftService.createShifts(req.body, req.userId);
    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
};

export const updateShift = async (req, res, next) => {
  try {
    const updated = await shiftService.updateShift(req.params.id, req.body, req.userId);
    res.json(updated);
  } catch (e) {
    next(e);
  }
};

export const deleteShift = async (req, res, next) => {
  try {
    await shiftService.deleteShift(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (e) {
    next(e);
  }
};

export const getMyShifts = async (req, res, next) => {
  try {
    const list = await shiftService.getStaffShifts(req.userId, req.query);
    res.json(list);
  } catch (e) {
    next(e);
  }
};

export const createSwapRequest = async (req, res, next) => {
  try {
    const doc = await shiftService.requestSwap(req.userId, req.body);
    res.status(201).json(doc);
  } catch (e) {
    next(e);
  }
};

export const listSwapRequests = async (req, res, next) => {
  try {
    const list = await shiftService.listSwapRequests(req.query);
    res.json(list);
  } catch (e) {
    next(e);
  }
};

export const cancelSwapRequest = async (req, res, next) => {
  try {
    const doc = await shiftService.cancelSwapRequest(req.userId, req.params.id);
    res.json(doc);
  } catch (e) {
    next(e);
  }
};

export const resolveSwapRequest = async (req, res, next) => {
  try {
    const doc = await shiftService.resolveSwapRequest(req.params.id, req.body, req.userId);
    res.json(doc);
  } catch (e) {
    next(e);
  }
};
