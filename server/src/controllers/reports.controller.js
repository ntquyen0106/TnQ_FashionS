import {
  getOverview,
  getSlowMoving,
  getOrdersByStaff,
  getTopProducts,
  getDailyOrders,
  getMonthlyRevenueSummary,
  generateMonthlyRevenueExcel,
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

/**
 * Xem tổng quan doanh thu theo tháng (JSON)
 * GET /api/reports/monthly-revenue?year=2025&month=10
 */
export const monthlyRevenueSummary = async (req, res, next) => {
  try {
    const data = await getMonthlyRevenueSummary({
      year: req.query.year,
      month: req.query.month,
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
};

/**
 * Xuất báo cáo doanh thu theo tháng (Excel với định dạng)
 * GET /api/reports/monthly-revenue/export?year=2025&month=10
 */
export const monthlyRevenueExport = async (req, res, next) => {
  try {
    const { filename, workbook } = await generateMonthlyRevenueExcel({
      year: req.query.year,
      month: req.query.month,
    });

    // Set headers để download file Excel
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Stream workbook to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (e) {
    next(e);
  }
};

