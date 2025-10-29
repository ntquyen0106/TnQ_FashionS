import {
  getOverview,
  getSlowMoving,
  getOrdersByStaff,
  getTopProducts,
  getDailyOrders,
} from '../services/reports.service.js';

// GET /api/reports/overview?from=YYYY-MM-DD&to=YYYY-MM-DD
export const overview = async (req, res, next) => {
  try {
    const data = await getOverview({ from: req.query.from, to: req.query.to });
    res.json(data);
  } catch (e) {
    next(e);
  }
};

// GET /api/reports/slow-moving?days=30&minSold=0&limit=20
export const slowMoving = async (req, res, next) => {
  try {
    const data = await getSlowMoving({
      days: req.query.days,
      minSold: req.query.minSold,
      limit: req.query.limit,
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
};

export const ordersByStaff = async (req, res, next) => {
  try {
    const data = await getOrdersByStaff({ from: req.query.from, to: req.query.to });
    res.json(data);
  } catch (e) {
    next(e);
  }
};

export const topProducts = async (req, res, next) => {
  try {
    const data = await getTopProducts({
      from: req.query.from,
      to: req.query.to,
      limit: req.query.limit,
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
};

export const dailyOrders = async (req, res, next) => {
  try {
    const data = await getDailyOrders({ from: req.query.from, to: req.query.to });
    res.json(data);
  } catch (e) {
    next(e);
  }
};
