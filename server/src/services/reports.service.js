import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Attendance from '../models/Attendance.js';
import ExcelJS from 'exceljs';

// Parse YYYY-MM-DD as a LOCAL date to avoid UTC shift (which would move the day back)
const toDate = (v, def) => {
  if (!v) return def;
  // If matches YYYY-MM-DD, construct as local midnight
  const m = /^\d{4}-\d{2}-\d{2}$/.exec(String(v));
  if (m) {
    const [y, mth, d] = String(v).split('-').map(Number);
    return new Date(y, mth - 1, d);
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? def : d;
};
const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const endOfDay = (d) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

export const getOverview = async ({ from, to } = {}) => {
  const tz = 'Asia/Ho_Chi_Minh';
  const today = new Date();
  const toRaw = toDate(to, today);
  const fromRaw = toDate(from, new Date(toRaw.getTime() - 29 * 24 * 60 * 60 * 1000));

  const fromAt = startOfDay(fromRaw);
  const toAt = endOfDay(toRaw);

  const matchBase = {
    createdAt: { $gte: fromAt, $lte: toAt },
  };

  const [revAgg, statusAgg, dailyAgg, topAgg] = await Promise.all([
    Order.aggregate([
      { $match: { ...matchBase, status: { $in: ['DONE', 'done'] } } },
      {
        $group: {
          _id: null,
          revenue: { $sum: '$amounts.subtotal' }, // Dùng subtotal (giá hàng gốc) thay vì grandTotal
          count: { $sum: 1 },
        },
      },
    ]),
    Order.aggregate([{ $match: matchBase }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: { ...matchBase, status: { $in: ['DONE', 'done'] } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: tz } },
          revenue: { $sum: '$amounts.subtotal' }, // Dùng subtotal để tính doanh thu đúng
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([
      { $match: { ...matchBase, status: { $in: ['DONE', 'done'] } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          qty: { $sum: '$items.qty' },
          revenue: { $sum: '$items.lineTotal' },
        },
      },
      { $sort: { qty: -1 } },
      { $limit: 5 },
    ]),
  ]);

  const statusCounts = statusAgg.reduce((acc, it) => {
    const key = String(it._id || '').toUpperCase();
    acc[key] = it.count || 0;
    return acc;
  }, {});

  const revenue = revAgg[0]?.revenue || 0;
  const ordersDone = revAgg[0]?.count || 0;
  const avgOrder = ordersDone ? Math.round(revenue / ordersDone) : 0;

  const topIds = topAgg.map((t) => t._id).filter(Boolean);
  const prodDocs = topIds.length
    ? await Product.find({ _id: { $in: topIds } })
        .select('name images.publicId images.isPrimary')
        .lean()
    : [];
  const prodMap = new Map(prodDocs.map((p) => [String(p._id), p]));
  const topProducts = topAgg.map((t) => {
    const p = prodMap.get(String(t._id));
    const primary = (p?.images || []).find((im) => im.isPrimary) || p?.images?.[0];
    return {
      productId: t._id,
      name: p?.name || 'Unknown',
      imagePublicId: primary?.publicId || '',
      qty: t.qty || 0,
      revenue: t.revenue || 0,
    };
  });

  return {
    range: { from: fromAt, to: toAt },
    revenue,
    ordersDone,
    avgOrder,
    statusCounts,
    daily: dailyAgg.map((d) => ({ date: d._id, revenue: d.revenue, count: d.count })),
    topProducts,
  };
};

export const getSlowMoving = async ({ days, minSold, limit } = {}) => {
  const d = Math.max(1, Math.min(365, Number(days) || 30));
  const min = Math.max(0, Number(minSold) || 0);
  const lim = Math.max(1, Math.min(100, Number(limit) || 20));

  const since = startOfDay(new Date(Date.now() - (d - 1) * 24 * 60 * 60 * 1000));

  const sold = await Order.aggregate([
    { $match: { createdAt: { $gte: since }, status: { $in: ['DONE', 'done'] } } },
    { $unwind: '$items' },
    { $group: { _id: '$items.productId', qty: { $sum: '$items.qty' } } },
    { $match: { qty: { $lte: min } } },
  ]);

  const soldIds = sold.map((s) => s._id);

  const items = await Product.aggregate([
    { $match: { status: 'active' } },
    { $addFields: { totalStock: { $sum: '$variants.stock' } } },
    { $match: { totalStock: { $gt: 0 } } },
    soldIds.length > 0
      ? { $match: { _id: { $in: soldIds } } }
      : { $match: { _id: { $exists: true } } },
    {
      $project: {
        name: 1,
        totalStock: 1,
        imagePublicId: {
          $let: {
            vars: {
              primary: {
                $first: {
                  $filter: { input: '$images', as: 'im', cond: { $eq: ['$$im.isPrimary', true] } },
                },
              },
            },
            in: { $ifNull: ['$$primary.publicId', { $arrayElemAt: ['$images.publicId', 0] }] },
          },
        },
      },
    },
    { $limit: lim },
  ]);

  return { items };
};

// Orders by staff per day within a date range
export const getOrdersByStaff = async ({ from, to } = {}) => {
  const today = new Date();
  const toRaw = toDate(to, today);
  const fromRaw = toDate(from, new Date(toRaw.getTime() - 29 * 24 * 60 * 60 * 1000));
  const fromAt = startOfDay(fromRaw);
  const toAt = endOfDay(toRaw);

  const tz = 'Asia/Ho_Chi_Minh';

  // Aggregate order counts by staff and date
  const orderAgg = await Order.aggregate([
    { $match: { createdAt: { $gte: fromAt, $lte: toAt } } },
    {
      $group: {
        _id: {
          staff: { $ifNull: ['$assignedStaffId', null] },
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: tz } },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.staff': 1, '_id.date': 1 } },
  ]);

  // Aggregate worked minutes from attendance by staff and date
  const attendanceAgg = await Attendance.aggregate([
    { $match: { date: { $gte: fromAt, $lte: toAt } } },
    {
      $group: {
        _id: {
          staff: '$staff',
          date: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: tz } },
        },
        minutes: { $sum: { $ifNull: ['$minutes', 0] } },
      },
    },
    { $sort: { '_id.staff': 1, '_id.date': 1 } },
  ]);

  // Pivot into staff -> Map(date -> { count, minutes })
  const map = new Map();
  const ensureEntry = (staffId) => {
    const key = staffId ? String(staffId) : 'unassigned';
    if (!map.has(key)) {
      map.set(key, { staffId: staffId || null, dayMap: new Map() });
    }
    return map.get(key);
  };

  for (const it of orderAgg) {
    const entry = ensureEntry(it._id.staff);
    const cur = entry.dayMap.get(it._id.date) || { date: it._id.date, count: 0, minutes: 0 };
    cur.count += it.count || 0;
    entry.dayMap.set(it._id.date, cur);
  }

  for (const it of attendanceAgg) {
    const entry = ensureEntry(it._id.staff);
    const cur = entry.dayMap.get(it._id.date) || { date: it._id.date, count: 0, minutes: 0 };
    cur.minutes += it.minutes || 0;
    entry.dayMap.set(it._id.date, cur);
  }

  // Resolve staff names for non-null ids
  const staffIds = [...map.values()].map((m) => m.staffId).filter(Boolean);
  const staffDocs = staffIds.length
    ? await (
        await import('../models/User.js')
      ).default
        .find({ _id: { $in: staffIds } })
        .select('name')
        .lean()
    : [];
  const staffMap = new Map(staffDocs.map((s) => [String(s._id), s]));

  const result = [];
  for (const [k, v] of map.entries()) {
    const sid = v.staffId ? String(v.staffId) : null;
    const name = sid ? staffMap.get(sid)?.name || 'Unknown' : 'Chưa gán';
    const days = Array.from(v.dayMap.values()).sort((a, b) => (a.date < b.date ? -1 : 1));
    const totalOrders = days.reduce((s, it) => s + (it.count || 0), 0);
    const totalMinutes = days.reduce((s, it) => s + (it.minutes || 0), 0);
    result.push({ staffId: v.staffId, staffName: name, days, totalOrders, totalMinutes });
  }

  return { range: { from: fromAt, to: toAt }, items: result };
};

export const getTopProducts = async ({ from, to, limit = 10 } = {}) => {
  const tz = 'Asia/Ho_Chi_Minh';
  const today = new Date();
  const toRaw = toDate(to, today);
  const fromRaw = toDate(from, new Date(toRaw.getTime() - 29 * 24 * 60 * 60 * 1000));
  const fromAt = startOfDay(fromRaw);
  const toAt = endOfDay(toRaw);

  const matchBase = { createdAt: { $gte: fromAt, $lte: toAt }, status: { $in: ['DONE', 'done'] } };

  const topAgg = await Order.aggregate([
    { $match: matchBase },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.productId',
        qty: { $sum: '$items.qty' },
        revenue: { $sum: '$items.lineTotal' },
      },
    },
    { $sort: { qty: -1 } },
    { $limit: Number(limit || 10) },
  ]);

  const topIds = topAgg.map((t) => t._id).filter(Boolean);
  const prodDocs = topIds.length
    ? await Product.find({ _id: { $in: topIds } })
        .select('name images.publicId images.isPrimary')
        .lean()
    : [];
  const prodMap = new Map(prodDocs.map((p) => [String(p._id), p]));

  const items = topAgg.map((t) => {
    const p = prodMap.get(String(t._id));
    const primary = (p?.images || []).find((im) => im.isPrimary) || p?.images?.[0];
    return {
      productId: t._id,
      name: p?.name || 'Unknown',
      imagePublicId: primary?.publicId || '',
      qty: t.qty || 0,
      revenue: t.revenue || 0,
    };
  });

  return { range: { from: fromAt, to: toAt }, items };
};

export const getDailyOrders = async ({ from, to } = {}) => {
  const tz = 'Asia/Ho_Chi_Minh';
  const today = new Date();
  const toRaw = toDate(to, today);
  const fromRaw = toDate(from, new Date(toRaw.getTime() - 29 * 24 * 60 * 60 * 1000));
  const fromAt = startOfDay(fromRaw);
  const toAt = endOfDay(toRaw);

  const dailyAgg = await Order.aggregate([
    { $match: { createdAt: { $gte: fromAt, $lte: toAt } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: tz } },
        revenue: { $sum: '$amounts.grandTotal' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return {
    range: { from: fromAt, to: toAt },
    daily: dailyAgg.map((d) => ({ date: d._id, revenue: d.revenue, count: d.count })),
  };
};

/**
 * Báo cáo doanh thu tháng - TỔNG QUAN
 * GET /api/reports/monthly-revenue?year=2025&month=10
 *
 * Dữ liệu tuân thủ Thông tư 78/2021/TT-BTC về thuế GTGT
 *
 * CÁC TRƯỜNG QUAN TRỌNG CHO BÁO CÁO THUẾ:
 * - salesRevenue: Doanh thu bán hàng (chưa VAT, chưa trừ giảm giá)
 * - netRevenue: Doanh thu thuần (sau trừ giảm giá)
 * - outputVAT: Thuế GTGT đầu ra 8%
 * - totalRevenueWithVAT: Tổng tiền thu (bao gồm VAT)
 *
 * CHỈ TÍNH CÁC ĐƠN HÀNG: status = 'DONE'
 * - DONE: Đơn đã hoàn thành, đã thu tiền → Tính vào doanh thu
 * - CANCELLED, RETURNED: KHÔNG tính vào doanh thu
 */
export const getMonthlyRevenueSummary = async ({ year, month } = {}) => {
  const tz = 'Asia/Ho_Chi_Minh';

  // Tháng cần báo cáo
  const targetYear = year ? Number(year) : new Date().getFullYear();
  const targetMonth = month ? Number(month) : new Date().getMonth() + 1;

  // Từ ngày đầu tháng 00:00:00 đến cuối tháng 23:59:59
  const fromDate = new Date(targetYear, targetMonth - 1, 1);
  const toDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

  // Aggregate dữ liệu từ Order collection
  // Lưu ý: Sử dụng $facet để chạy nhiều pipeline song song, tối ưu performance
  const result = await Order.aggregate([
    {
      // Lọc đơn hàng trong kỳ báo cáo
      $match: {
        createdAt: { $gte: fromDate, $lte: toDate },
      },
    },
    {
      $facet: {
        // ============================================
        // 1. THỐNG KÊ THEO TRẠNG THÁI (Tất cả đơn)
        // ============================================
        // Mục đích: Hiển thị tổng quan tất cả đơn hàng theo status
        // Bao gồm: DONE, PENDING, CANCELLED, RETURNED, etc.
        statusStats: [
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
              totalValue: { $sum: '$amounts.grandTotal' },
            },
          },
        ],

        // ============================================
        // 2. DOANH THU TỪ ĐƠN HOÀN THÀNH (CHỈ DONE)
        // ============================================
        // Mục đích: Tính doanh thu thực tế để nộp thuế
        // Theo Thông tư 78/2021: CHỈ đơn đã thu tiền mới tính
        revenueStats: [
          { $match: { status: { $in: ['DONE', 'done'] } } },
          {
            $group: {
              _id: null,
              // amounts.subtotal: Tổng giá trị hàng (CHƯA giảm giá, CHƯA phí ship)
              // → Đây là doanh thu trước khi áp dụng voucher
              totalSubtotal: { $sum: '$amounts.subtotal' },
              // amounts.discount: Giảm giá từ voucher/khuyến mại
              totalDiscount: { $sum: '$amounts.discount' },
              // amounts.shippingFee: Phí vận chuyển thu từ khách
              totalShipping: { $sum: '$amounts.shippingFee' },
              // amounts.grandTotal: Tổng tiền khách trả (subtotal - discount + shipping)
              // → Chỉ dùng để tham khảo, KHÔNG dùng tính thuế
              totalGrandTotal: { $sum: '$amounts.grandTotal' },
              // Tổng số đơn hoàn thành
              totalOrders: { $sum: 1 },
              // Tổng số sản phẩm bán ra
              totalItems: { $sum: { $size: '$items' } },
            },
          },
        ],

        // ============================================
        // 3. DOANH THU THEO NGÀY (CHỈ TÍNH ĐƠN HÀNG CÓ STATUS LÀ  DONE)
        // ============================================
        // Mục đích: Phân tích xu hướng theo ngày
        dailyRevenue: [
          { $match: { status: { $in: ['DONE'] } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: tz } },
              gross: {
                $sum: {
                  $add: [
                    { $ifNull: ['$amounts.subtotal', 0] },
                    {
                      $multiply: [-1, { $ifNull: ['$amounts.discount', 0] }],
                    },
                    { $ifNull: ['$amounts.shippingFee', 0] },
                  ],
                },
              },
              discount: { $sum: '$amounts.discount' },
              shipping: { $sum: '$amounts.shippingFee' },
              orders: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ],

        // ============================================
        // 4. THỐNG KÊ THEO PHƯƠNG THỨC THANH TOÁN (CHỈ DONE)
        // ============================================
        // Mục đích: Phân tích tỷ lệ COD vs BANK
        // paymentMethod: Enum ['COD', 'BANK']
        paymentStats: [
          { $match: { status: { $in: ['DONE'] } } },
          {
            $group: {
              _id: '$paymentMethod',
              revenue: {
                $sum: {
                  $add: [
                    { $ifNull: ['$amounts.subtotal', 0] },
                    {
                      $multiply: [-1, { $ifNull: ['$amounts.discount', 0] }],
                    },
                    { $ifNull: ['$amounts.shippingFee', 0] },
                  ],
                },
              },
              orders: { $sum: 1 },
            },
          },
          { $sort: { revenue: -1 } },
        ],
      },
    },
  ]);

  const data = result[0];

  // ============================================
  // XỬ LÝ THỐNG KÊ THEO TRẠNG THÁI
  // ============================================
  const statusBreakdown = {};
  data.statusStats.forEach((s) => {
    const status = String(s._id || 'UNKNOWN').toUpperCase();
    statusBreakdown[status] = {
      count: s.count,
      totalValue: s.totalValue,
    };
  });

  // ============================================
  // XỬ LÝ DỮ LIỆU DOANH THU (CHỈ DONE)
  // ============================================
  const revenue = data.revenueStats[0] || {
    totalSubtotal: 0,
    totalDiscount: 0,
    totalShipping: 0,
    totalGrandTotal: 0,
    totalOrders: 0,
    totalItems: 0,
  };

  // ============================================
  // TÍNH TOÁN DOANH THU & THUẾ
  // ============================================
  // Khách trả: 100,000đ
  // Shop thu: 100,000đ
  // Thuế VAT shop phải nộp: 8,000đ (8% của doanh thu)
  // Shop thực nhận: 92,000đ
  //
  // CẤU TRÚC Order Model:
  // - amounts.subtotal = Tổng giá trị hàng hóa trước khi trừ giảm giá
  // - amounts.discount = Giảm giá/voucher
  // - amounts.shippingFee = Phí vận chuyển thu từ khách
  // - amounts.grandTotal = subtotal - discount + shippingFee

  const VAT_RATE = 0.08; // 8% thuế GTGT

  // Doanh thu từ khách (số tiền khách trả)
  const totalRevenue = Math.max(
    0,
    (revenue.totalSubtotal || 0) - (revenue.totalDiscount || 0) + (revenue.totalShipping || 0),
  );

  // Thuế VAT shop phải nộp (8% của doanh thu)
  const vatPayable = Math.round(totalRevenue * VAT_RATE);

  // Doanh thu thuần sau khi trừ thuế (số tiền shop thực nhận)
  const netRevenue = totalRevenue - vatPayable;
  const salesRevenue = totalRevenue;

  // Giá trị trung bình đơn hàng
  const avgOrderValue =
    revenue.totalOrders > 0 ? Math.round(totalRevenue / revenue.totalOrders) : 0;

  // ============================================
  // XỬ LÝ PHƯƠNG THỨC THANH TOÁN
  // ============================================
  // Đảm bảo luôn có đầy đủ COD và BANK (value = 0 nếu không có)
  const paymentMap = new Map();
  data.paymentStats.forEach((p) => {
    const method = String(p._id || 'COD').toUpperCase();
    paymentMap.set(method, {
      revenue: p.revenue,
      orders: p.orders,
    });
  });

  const totalCollected = totalRevenue || 0;
  const paymentMethods = ['COD', 'BANK'].map((method) => {
    const data = paymentMap.get(method) || { revenue: 0, orders: 0 };
    const methodName = method === 'BANK' ? 'Chuyển khoản' : 'COD (Tiền mặt)';
    const percentage =
      totalCollected > 0 ? Math.round((data.revenue / totalCollected) * 100 * 10) / 10 : 0;

    return {
      method,
      methodName,
      revenue: data.revenue,
      orders: data.orders,
      percentage,
    };
  });

  // ============================================
  // XỬ LÝ DOANH THU THEO NGÀY
  // ============================================
  const daily = data.dailyRevenue.map((d) => {
    const revenue = d.gross || 0;
    const vat = Math.round(revenue * VAT_RATE);
    const netRevenue = revenue - vat;
    return {
      date: d._id,
      revenue,
      discount: d.discount,
      shipping: d.shipping,
      orders: d.orders,
      vat,
      netRevenue,
    };
  });

  // ============================================
  // RETURN KẾT QUẢ
  // ============================================
  return {
    // Thông tin kỳ báo cáo
    period: {
      year: targetYear,
      month: targetMonth,
      monthName: `Tháng ${targetMonth}/${targetYear}`,
      fromDate,
      toDate,
      totalDays: new Date(targetYear, targetMonth, 0).getDate(),
    },

    // ============================================
    // BÁO CÁO DOANH THU
    // ============================================
    revenueReport: {
      // Tổng doanh thu (không có thuế VAT)
      // = Số tiền khách hàng thực tế thanh toán
      totalRevenue,

      // Doanh thu thuần = Tổng doanh thu
      netRevenue,

      // Giảm giá / Voucher
      totalDiscount: revenue.totalDiscount,

      // Phí vận chuyển
      totalShipping: revenue.totalShipping,

      // Tổng giá trị hàng (trước giảm giá)
      totalSubtotal: revenue.totalSubtotal,
    },

    // BÁO CÁO THUẾ GTGT
    taxReport: {
      // Tổng doanh thu (khách trả)
      totalRevenue,
      salesRevenue,

      // Thuế VAT shop phải nộp (8%)
      vatPayable,

      // Doanh thu thuần (sau khi trừ thuế)
      netRevenue,

      // Chi tiết
      totalSubtotal: revenue.totalSubtotal,
      totalDiscount: revenue.totalDiscount,
      totalShipping: revenue.totalShipping,
    },

    // Thống kê đơn hàng
    orderStats: {
      totalOrders: revenue.totalOrders,
      totalItems: revenue.totalItems,
      avgOrderValue,
      avgItemsPerOrder:
        revenue.totalOrders > 0
          ? Math.round((revenue.totalItems / revenue.totalOrders) * 10) / 10
          : 0,
    },

    // Thống kê theo trạng thái (bao gồm CANCELLED, RETURNED)
    statusBreakdown,

    // Phương thức thanh toán (luôn có COD và BANK)
    paymentMethods,

    // Doanh thu theo ngày
    daily,
  };
};

/**
 * Lấy chi tiết đơn hàng để xuất báo cáo thuế
 * GET /api/reports/monthly-revenue/export?year=2025&month=10
 *
 * MAPPING CÁC TRƯỜNG THEO ORDER MODEL:
 * - orderCode: Mã đơn hàng
 * - createdAt: Ngày tạo đơn
 * - status: Trạng thái đơn hàng (CHỈ LẤY 'DONE')
 * - paymentMethod: Enum ['COD', 'BANK']
 *
 * SHIPPING ADDRESS (AddressSnapshotSchema):
 * - fullName: Tên người nhận
 * - phone: Số điện thoại
 * - line1: Địa chỉ chi tiết
 * - ward: Phường/xã
 * - district: Quận/huyện
 * - city: Tỉnh/thành phố
 *
 * AMOUNTS (AmountsSchema):
 * - subtotal: Tổng giá trị hàng (chưa giảm giá, chưa phí ship)
 * - discount: Giảm giá từ voucher
 * - shippingFee: Phí vận chuyển
 * - grandTotal: Tổng thanh toán (bao gồm VAT)
 *
 * ITEMS (OrderItemSchema):
 * - nameSnapshot: Tên sản phẩm (lưu snapshot khi đặt hàng)
 * - variantSku: SKU của variant (VD: "SIZE-M-COLOR-BLACK")
 * - price: Đơn giá
 * - qty: Số lượng
 * - lineTotal: Thành tiền (price * qty)
 */
export const getMonthlyRevenueForExport = async ({ year, month } = {}) => {
  const targetYear = year ? Number(year) : new Date().getFullYear();
  const targetMonth = month ? Number(month) : new Date().getMonth() + 1;

  const fromDate = new Date(targetYear, targetMonth - 1, 1);
  const toDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

  // Lấy thông tin tổng quan
  const summary = await getMonthlyRevenueSummary({ year, month });

  // Lấy chi tiết đơn hàng DONE (đã hoàn thành)
  // CHỈ LẤY CÁC TRƯỜNG CẦN THIẾT để tối ưu performance
  const orders = await Order.find({
    createdAt: { $gte: fromDate, $lte: toDate },
    status: { $in: ['DONE', 'done'] },
  })
    .select('_id createdAt shippingAddress amounts paymentMethod status items')
    .lean()
    .sort({ createdAt: 1 });

  // Format dữ liệu chi tiết theo cấu trúc báo cáo thuế
  const detailedOrders = orders.map((order) => ({
    // Thông tin đơn hàng
    orderCode: order._id.toString(), // _id của order là mã đơn hàng
    createdAt: order.createdAt,
    status: order.status,

    // Thông tin khách hàng (từ shippingAddress snapshot)
    customerName: order.shippingAddress?.fullName || 'Khách vãng lai',
    customerPhone: order.shippingAddress?.phone || '',
    customerAddress: [
      order.shippingAddress?.line1,
      order.shippingAddress?.ward,
      order.shippingAddress?.district,
      order.shippingAddress?.city,
    ]
      .filter(Boolean)
      .join(', '),

    // Thông tin thanh toán
    subtotal: order.amounts.subtotal, // Tổng giá trị hàng
    discount: order.amounts.discount, // Giảm giá
    shipping: order.amounts.shippingFee, // Phí vận chuyển
    grandTotal: order.amounts.grandTotal, // Tổng thanh toán (có VAT)
    paymentMethod: order.paymentMethod, // COD hoặc BANK

    // Chi tiết sản phẩm
    items: order.items.map((item) => ({
      productName: item.nameSnapshot, // Tên sản phẩm (snapshot)
      variantName: item.variantSku || 'Không có', // SKU variant
      qty: item.qty, // Số lượng
      price: item.price, // Đơn giá
      lineTotal: item.lineTotal, // Thành tiền
    })),
  }));

  return {
    period: {
      year: targetYear,
      month: targetMonth,
      monthName: `Tháng ${targetMonth}/${targetYear}`,
      fromDate,
      toDate,
      totalDays: new Date(targetYear, targetMonth, 0).getDate(),
    },
    summary,
    orders: detailedOrders,
  };
};

/**
 * Tạo file Excel cho báo cáo doanh thu / thuế theo tháng
 * Chuẩn hoá format theo phong cách báo cáo thuế Việt Nam.
 *
 * PHẦN I: THÔNG TIN CHUNG
 * PHẦN II: BÁO CÁO THUẾ
 * PHẦN III: THỐNG KÊ TỔNG HỢP
 * PHẦN IV: CHI TIẾT ĐƠN HÀNG
 * PHẦN V: CHI TIẾT SẢN PHẨM
 *
 * @param {Object} params - { year, month }
 * @returns {Object} - { filename, workbook }
 */
export const generateMonthlyRevenueExcel = async ({ year, month }) => {
  // Lấy chi tiết đơn hàng (bao gồm period và summary)
  const data = await getMonthlyRevenueForExport({ year, month });

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Báo cáo doanh thu');

  // Một số hằng dùng lại
  const COLOR_PRIMARY = 'FF1F4E79'; // xanh đậm kiểu báo cáo thuế
  const COLOR_SECTION = 'FF38598A'; // header section
  const COLOR_HEADER = 'FF4F81BD'; // header bảng
  const COLOR_GRAY_LIGHT = 'FFF3F4F6';
  const COLOR_GRAY_ALT = 'FFE5E7EB';

  ws.properties.defaultRowHeight = 18;

  // Độ rộng cột tối ưu cho từng loại dữ liệu
  ws.columns = [
    { width: 30 }, // A: STT (widened to match screenshot)
    { width: 40 }, // B: Nhãn/Label (dài nhất) — tăng để tránh bị khuất
    { width: 14 }, // C: Giá trị/Ngày
    { width: 26 }, // D: Tên KH/Dữ liệu — tăng cho tên dài
    { width: 14 }, // E: SĐT/Số
    { width: 60 }, // F: Địa chỉ (rộng nhất)
    { width: 22 }, // G: Giá trị hàng
    { width: 18 }, // H: Giảm giá
    { width: 18 }, // I: Phí ship
    { width: 22 }, // J: Tổng
    { width: 22 }, // K: PT thanh toán
  ];

  let currentRow = 1;

  // Thiết lập wrapText mặc định cho các cột văn bản dài
  // (ExcelJS cho phép gán alignment cho column)
  try {
    ws.getColumn(2).alignment = { wrapText: true, horizontal: 'left', vertical: 'middle' };
    ws.getColumn(4).alignment = { wrapText: true, horizontal: 'left', vertical: 'middle' };
    ws.getColumn(6).alignment = { wrapText: true, horizontal: 'left', vertical: 'middle' };
    ws.getColumn(1).alignment = { horizontal: 'center', vertical: 'middle' };
  } catch (e) {
    // Nếu môi trường ExcelJS không hỗ trợ gán alignment cho column, bỏ qua
  }

  // ===== Helper nhỏ =====
  const merge = (r, c1, c2) => ws.mergeCells(r, c1, r, c2);

  const addEmptyRow = () => {
    currentRow++;
  };

  const addSectionHeader = (text) => {
    const row = ws.getRow(currentRow);
    row.height = 22;

    row.getCell(1).value = text;
    row.getCell(1).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLOR_SECTION },
    };
    row.getCell(1).border = {
      top: { style: 'medium', color: { argb: COLOR_PRIMARY } },
      bottom: { style: 'thin', color: { argb: COLOR_PRIMARY } },
    };

    merge(currentRow, 1, 11);
    currentRow++;
  };

  const addInfoRow = (label, value) => {
    const row = ws.getRow(currentRow);
    row.height = 18;

    const lbl = row.getCell(1);
    lbl.value = label;
    lbl.font = { bold: true, size: 11 };
    lbl.alignment = { horizontal: 'left', vertical: 'middle' };
    lbl.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLOR_GRAY_LIGHT },
    };

    const valCell = row.getCell(2);
    valCell.value = value;
    valCell.font = { size: 11 };
    valCell.alignment = { horizontal: 'left', vertical: 'middle' };

    merge(currentRow, 2, 4);
    currentRow++;
  };

  const addMoneyRow = (label, value, highlight = false) => {
    const row = ws.getRow(currentRow);
    row.height = 20;

    const bgLabel = highlight ? 'FFFEF3C7' : COLOR_GRAY_LIGHT;
    const bgValue = highlight ? 'FFFEF3C7' : 'FFFFFFFF';

    const c1 = row.getCell(1);
    c1.value = label;
    c1.font = { bold: true, size: 11 };
    c1.alignment = { horizontal: 'left', vertical: 'middle' };
    c1.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: bgLabel },
    };

    const c2 = row.getCell(2);
    c2.value = value || 0;
    c2.font = { size: 11, bold: highlight };
    c2.alignment = { horizontal: 'right', vertical: 'middle' };
    c2.numFmt = '#,##0';
    c2.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: bgValue },
    };

    merge(currentRow, 2, 4);

    if (highlight) {
      c1.border = {
        top: { style: 'medium', color: { argb: COLOR_PRIMARY } },
        left: { style: 'medium', color: { argb: COLOR_PRIMARY } },
        bottom: { style: 'medium', color: { argb: COLOR_PRIMARY } },
      };
      c2.border = {
        top: { style: 'medium', color: { argb: COLOR_PRIMARY } },
        right: { style: 'medium', color: { argb: COLOR_PRIMARY } },
        bottom: { style: 'medium', color: { argb: COLOR_PRIMARY } },
      };
    }

    currentRow++;
  };

  const addStatRow = (label, value, unit = '') => {
    const row = ws.getRow(currentRow);
    row.height = 18;

    row.getCell(1).value = label;
    row.getCell(1).font = { bold: true, size: 11 };
    row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLOR_GRAY_LIGHT },
    };

    const vCell = row.getCell(2);
    vCell.value = value ?? 0;
    vCell.alignment = { horizontal: 'right', vertical: 'middle' };
    // Format số với dấu phẩy cho cả tiền và số lượng
    if (typeof value === 'number') {
      vCell.numFmt = unit === 'VNĐ' || !unit ? '#,##0' : '#,##0.0';
    }

    const uCell = row.getCell(3);
    uCell.value = unit;
    uCell.alignment = { horizontal: 'left', vertical: 'middle' };

    merge(currentRow, 2, 3);
    currentRow++;
  };

  // ===== TIÊU ĐỀ CHÍNH =====
  const titleRow = ws.getRow(currentRow);
  titleRow.height = 36;
  const titleCell = titleRow.getCell(1);
  titleCell.value = `BÁO CÁO DOANH THU THÁNG ${data.period.month}/${data.period.year}`;
  titleCell.font = { bold: true, size: 16, color: { argb: COLOR_PRIMARY } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E7FF' },
  };
  merge(currentRow, 1, 11);
  currentRow += 2; // +1 dòng trống

  // ===== PHẦN I: THÔNG TIN CHUNG =====
  addSectionHeader('PHẦN I: THÔNG TIN CHUNG');

  addInfoRow('Tên cửa hàng:', 'TnQ Fashion Store');
  addInfoRow('Tháng:', data.period.month);
  addInfoRow('Năm:', data.period.year);
  addInfoRow('Ngày xuất báo cáo:', new Date().toLocaleDateString('vi-VN'));
  addEmptyRow();

  // ===== PHẦN II: BÁO CÁO DOANH THU & THUẾ =====
  const tax = data.summary.taxReport;
  addSectionHeader('PHẦN II: BÁO CÁO DOANH THU & THUẾ GTGT');

  addMoneyRow('Tổng giá trị hàng hóa:', tax.totalSubtotal);
  addMoneyRow('Giảm giá / Voucher:', tax.totalDiscount);
  addMoneyRow('Phí vận chuyển:', tax.totalShipping);
  addMoneyRow('Tổng doanh thu (khách trả):', tax.totalRevenue);
  addMoneyRow('Thuế GTGT (8%):', tax.vatPayable);
  addMoneyRow('Doanh thu thuần (sau thuế):', tax.netRevenue);
  addEmptyRow();

  // ===== PHẦN III: THỐNG KÊ TỔNG HỢP =====
  const s = data.summary.orderStats;
  addSectionHeader('PHẦN III: THỐNG KÊ TỔNG HỢP');

  addStatRow('Tổng số đơn hàng hoàn thành:', s.totalOrders, 'đơn');
  addStatRow('Tổng số sản phẩm đã bán:', s.totalItems, 'sản phẩm');
  addStatRow('Giá trị trung bình/đơn hàng:', s.avgOrderValue, 'VNĐ');
  addStatRow('Số sản phẩm trung bình/đơn:', s.avgItemsPerOrder, 'sản phẩm');
  addEmptyRow();

  // --- Thống kê theo trạng thái ---
  if (data.summary.statusBreakdown) {
    const row = ws.getRow(currentRow);
    row.height = 20;
    const cell = row.getCell(1);
    cell.value = 'Thống kê theo trạng thái đơn hàng:';
    cell.font = { bold: true, size: 11, color: { argb: COLOR_PRIMARY } };
    cell.alignment = { horizontal: 'left', vertical: 'middle' };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFDBEAFE' },
    };
    merge(currentRow, 1, 5);
    currentRow++;

    const statusNames = {
      DONE: 'Hoàn thành',
      CANCELLED: 'Đã huỷ',
    };

    // Chỉ hiển thị trạng thái DONE và CANCELLED
    const allowedStatuses = ['DONE', 'CANCELLED'];

    Object.entries(data.summary.statusBreakdown).forEach(([status, stat]) => {
      if (!allowedStatuses.includes(status)) return;

      const r = ws.getRow(currentRow);
      r.height = 18;
      const name = statusNames[status] || status;

      r.getCell(2).value = `• ${name}:`;
      r.getCell(2).font = { bold: true, size: 10 };
      r.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };

      r.getCell(3).value = `${stat.count} đơn`;
      r.getCell(3).font = { size: 10 };
      r.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };

      const moneyCell = r.getCell(4);
      moneyCell.value = stat.totalValue || 0;
      moneyCell.font = { size: 10 };
      moneyCell.alignment = { horizontal: 'right', vertical: 'middle' };
      moneyCell.numFmt = '#,##0';

      r.getCell(5).value = 'VNĐ';
      r.getCell(5).alignment = { horizontal: 'left', vertical: 'middle' };
      r.getCell(5).font = { size: 10 };

      currentRow++;
    });
    addEmptyRow();
  }

  // --- Thống kê theo phương thức thanh toán ---
  {
    const row = ws.getRow(currentRow);
    row.height = 20;
    const cell = row.getCell(1);
    cell.value = 'Phân loại theo phương thức thanh toán:';
    cell.font = { bold: true, size: 11, color: { argb: COLOR_PRIMARY } };
    cell.alignment = { horizontal: 'left', vertical: 'middle' };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFDBEAFE' },
    };
    merge(currentRow, 1, 5);
    currentRow++;

    (data.summary.paymentMethods || []).forEach((pm) => {
      const r = ws.getRow(currentRow);
      r.height = 18;

      const methodName = pm.method === 'BANK' ? 'Chuyển khoản' : 'Tiền mặt';

      r.getCell(2).value = `• ${methodName}:`;
      r.getCell(2).font = { bold: true, size: 10 };
      r.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };

      r.getCell(3).value = `${pm.orders} đơn`;
      r.getCell(3).font = { size: 10 };
      r.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };

      const moneyCell = r.getCell(4);
      moneyCell.value = pm.revenue || 0;
      moneyCell.font = { size: 10 };
      moneyCell.alignment = { horizontal: 'right', vertical: 'middle' };
      moneyCell.numFmt = '#,##0';

      r.getCell(5).value = 'VNĐ';
      r.getCell(5).font = { size: 10 };
      r.getCell(5).alignment = { horizontal: 'left', vertical: 'middle' };

      currentRow++;
    });
    addEmptyRow();
  }

  // ===== PHẦN IV: CHI TIẾT ĐƠN HÀNG =====
  addSectionHeader('PHẦN IV: CHI TIẾT CÁC ĐƠN HÀNG ĐÃ HOÀN THÀNH');
  addEmptyRow();

  if (data.orders && data.orders.length > 0) {
    const headerRow = ws.getRow(currentRow);
    headerRow.height = 28;

    const headers = [
      'STT',
      'Mã đơn hàng',
      'Ngày tạo',
      'Tên khách hàng',
      'Số điện thoại',
      'Địa chỉ giao hàng',
      'Giá trị hàng (VNĐ)',
      'Giảm giá (VNĐ)',
      'Phí vận chuyển (VNĐ)',
      'Tổng thanh toán (VNĐ)',
      'Phương thức thanh toán',
    ];

    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLOR_HEADER },
      };
      cell.border = {
        top: { style: 'medium', color: { argb: COLOR_PRIMARY } },
        bottom: { style: 'medium', color: { argb: COLOR_PRIMARY } },
        left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        right: { style: 'thin', color: { argb: 'FF9CA3AF' } },
      };
    });
    currentRow++;

    data.orders.forEach((order, idx) => {
      const row = ws.getRow(currentRow);
      row.height = 28;

      const paymentName = order.paymentMethod === 'BANK' ? 'Chuyển khoản' : 'Tiền mặt';
      const values = [
        idx + 1,
        order.orderCode,
        new Date(order.createdAt).toLocaleDateString('vi-VN'),
        order.customerName,
        order.customerPhone,
        order.customerAddress,
        order.subtotal,
        order.discount,
        order.shipping,
        order.grandTotal,
        paymentName,
      ];

      values.forEach((val, i) => {
        const cell = row.getCell(i + 1);
        cell.value = val;
        cell.font = { size: 10 };

        const isMoney = i >= 6 && i <= 9;
        const isOdd = idx % 2 === 1;
        const bgColor = isOdd ? 'FFF9FAFB' : 'FFFFFFFF';

        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: bgColor },
        };

        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };

        if (i === 0) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (isMoney) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '#,##0';
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        }
      });

      currentRow++;
    });
  } else {
    const row = ws.getRow(currentRow);
    row.getCell(1).value = 'Không có đơn hàng hoàn thành trong kỳ này.';
    row.getCell(1).font = { italic: true, size: 10, color: { argb: 'FF6B7280' } };
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    merge(currentRow, 1, 11);
    currentRow++;
  }

  addEmptyRow();

  // ===== PHẦN V: CHI TIẾT SẢN PHẨM =====
  addSectionHeader('PHẦN V: CHI TIẾT SẢN PHẨM THEO ĐƠN HÀNG');
  addEmptyRow();

  if (data.orders && data.orders.length > 0) {
    const hRow = ws.getRow(currentRow);
    hRow.height = 28;
    const productHeaders = [
      'Mã đơn',
      'Tên sản phẩm',
      'Phân loại',
      'Số lượng',
      'Đơn giá (VNĐ)',
      'Thành tiền (VNĐ)',
    ];

    productHeaders.forEach((h, i) => {
      const cell = hRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF9A3412' },
      };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF9A3412' } },
        bottom: { style: 'medium', color: { argb: 'FF9A3412' } },
        left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        right: { style: 'thin', color: { argb: 'FF9CA3AF' } },
      };
    });
    currentRow++;

    let itemIndex = 0;
    data.orders.forEach((order) => {
      order.items.forEach((it) => {
        const row = ws.getRow(currentRow);
        row.height = 24;

        const vals = [
          order.orderCode,
          it.productName,
          it.variantName,
          it.qty,
          it.price,
          it.lineTotal,
        ];

        vals.forEach((val, i) => {
          const cell = row.getCell(i + 1);
          cell.value = val;
          cell.font = { size: 10 };

          const isMoney = i === 4 || i === 5;
          const isQty = i === 3;
          const isOdd = itemIndex % 2 === 1;
          const bgColor = isOdd ? 'FFFEF2F2' : 'FFFFFFFF';

          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: bgColor },
          };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFFECACA' } },
            bottom: { style: 'thin', color: { argb: 'FFFECACA' } },
            left: { style: 'thin', color: { argb: 'FFFECACA' } },
            right: { style: 'thin', color: { argb: 'FFFECACA' } },
          };

          if (isQty) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.font = { size: 10, bold: true };
          } else if (isMoney) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.numFmt = '#,##0';
            if (i === 5) cell.font = { size: 10, bold: true };
          } else {
            cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
          }
        });

        itemIndex++;
        currentRow++;
      });
    });
  } else {
    const row = ws.getRow(currentRow);
    row.getCell(1).value = 'Không có dữ liệu sản phẩm trong kỳ.';
    row.getCell(1).font = { italic: true, size: 10, color: { argb: 'FF6B7280' } };
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    merge(currentRow, 1, 6);
    currentRow++;
  }

  addEmptyRow();

  // Footer
  const footer = ws.getRow(currentRow);
  footer.height = 22;
  footer.getCell(1).value =
    'TnQ Fashion Store · Việt Nam · Hotline: 0123 456 789 · Báo cáo tự động từ hệ thống bán hàng';
  footer.getCell(1).font = { italic: true, size: 9, color: { argb: 'FF6B7280' } };
  footer.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  merge(currentRow, 1, 11);

  return {
    filename: `bao-cao-doanh-thu-thang-${data.period.month}-${data.period.year}.xlsx`,
    workbook,
  };
};
