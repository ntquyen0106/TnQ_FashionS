import Order from '../models/Order.js';
import Product from '../models/Product.js';
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
          count: { $sum: 1 } 
        } 
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

  // Aggregate counts by staff and date
  const agg = await Order.aggregate([
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

  // Pivot into staff -> [{date,count}]
  const map = new Map();
  for (const it of agg) {
    const sid = it._id.staff ? String(it._id.staff) : 'unassigned';
    if (!map.has(sid)) map.set(sid, { staffId: it._id.staff || null, days: [] });
    map.get(sid).days.push({ date: it._id.date, count: it.count });
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
    result.push({ staffId: v.staffId, staffName: name, days: v.days });
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
              revenue: { $sum: '$amounts.subtotal' }, // Dùng subtotal (giá hàng gốc)
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
              revenue: { $sum: '$amounts.subtotal' }, // Dùng subtotal để nhất quán
              orders: { $sum: 1 }, // Đếm số đơn hàng theo phương thức
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
  // TÍNH TOÁN THEO CHUẨN KẾ TOÁN VIỆT NAM
  // ============================================
  // LƯU Ý: Database CHƯA BAO GỒM VAT (giá chưa thuế)
  // 
  // CÔNG THỨC Order Model:
  // - amounts.subtotal = Tổng giá trị hàng hóa (chưa thuế, chưa trừ giảm giá)
  // - amounts.discount = Giảm giá/voucher
  // - amounts.shippingFee = Phí vận chuyển
  // - amounts.grandTotal = subtotal - discount + shippingFee
  // 
  // VÍ DỤ CỤ THỂ:
  // - Giá hàng (subtotal): 100,000đ
  // - Giảm giá (discount): 10,000đ  
  // - Phí ship (shippingFee): 5,000đ
  // - Tổng đơn (grandTotal) = 100,000 - 10,000 + 5,000 = 95,000đ
  //
  // TÍNH TOÁN KẾ TOÁN (theo Thông tư 200/2014/TT-BTC):
  //
  // 1. DOANH THU BÁN HÀNG (chưa VAT):
  //    = Tổng giá bán hàng hóa = 100,000đ
  //
  // 2. CÁC KHOẢN GIẢM TRỪ DOANH THU:
  //    = Chiết khấu thương mại, giảm giá hàng bán = 10,000đ
  //
  // 3. DOANH THU THUẦN (Net Revenue):
  //    = Doanh thu bán hàng - Các khoản giảm trừ
  //    = 100,000 - 10,000 = 90,000đ
  //
  // 4. THUẾ GTGT ĐẦU RA (theo Thông tư 78/2021/TT-BTC):
  //    = Doanh thu bán hàng × 8% = 100,000 × 8% = 8,000đ
  //
  // 5. TỔNG TIỀN PHẢI THU (bao gồm VAT):
  //    = Doanh thu bán hàng + Thuế GTGT
  //    = 100,000 + 8,000 = 108,000đ
  //
  // LƯU Ý QUAN TRỌNG:
  // - Doanh thu thuần = Doanh thu - Giảm giá (TRƯỚC khi tính thuế)
  // - Thuế GTGT tính trên doanh thu bán hàng (subtotal), KHÔNG tính trên doanh thu thuần
  // - Phí ship KHÔNG tính vào doanh thu (là dịch vụ riêng)
  
  const VAT_RATE = 0.08; // 8% thuế GTGT cho hàng hóa, dịch vụ
  
  // [1] Doanh thu bán hàng (chưa VAT) = Tổng giá trị hàng hóa
  const salesRevenue = revenue.totalSubtotal;
  
  // [2] Doanh thu thuần = Doanh thu - Giảm giá
  const netRevenue = salesRevenue - revenue.totalDiscount;
  
  // [3] Thuế GTGT đầu ra = Doanh thu bán hàng × 8%
  const outputVAT = Math.round(salesRevenue * VAT_RATE);
  
  // [4] Tổng tiền thu (bao gồm VAT) = Doanh thu + Thuế
  const totalRevenueWithVAT = salesRevenue + outputVAT;
  
  // Giá trị trung bình đơn hàng (tính theo subtotal)
  const avgOrderValue = revenue.totalOrders > 0 
    ? Math.round(revenue.totalSubtotal / revenue.totalOrders) 
    : 0;

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

  const paymentMethods = ['COD', 'BANK'].map((method) => {
    const data = paymentMap.get(method) || { revenue: 0, orders: 0 };
    const methodName = method === 'BANK' ? 'Chuyển khoản' : 'COD (Tiền mặt)';
    const percentage = revenue.totalSubtotal > 0 
      ? Math.round((data.revenue / revenue.totalSubtotal) * 100 * 10) / 10 
      : 0;
    
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
  const daily = data.dailyRevenue.map((d) => ({
    date: d._id,
    revenue: d.revenue,
    discount: d.discount,
    shipping: d.shipping,
    orders: d.orders,
    netRevenue: d.revenue - d.discount,
  }));

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
    // BÁO CÁO THUẾ GTGT (Theo Thông tư 78/2021/TT-BTC)
    // ============================================
    // Phần này dùng để kê khai thuế GTGT hàng tháng
    // File mẫu: Mẫu 01/GTGT
    taxReport: {
      // [1] DOANH THU BÁN HÀNG (chưa có thuế GTGT)
      // = Tổng giá trị hàng hóa, dịch vụ đã bán
      // VD: Bán hàng 100,000đ (giá chưa thuế)
      salesRevenue,
      
      // [2] DOANH THU THUẦN (Net Revenue)
      // = Doanh thu bán hàng - Các khoản giảm trừ
      // = Doanh thu thực tế sau giảm giá
      // VD: 100,000đ - 10,000đ (voucher) = 90,000đ
      netRevenue,
      
      // [3] THUẾ GTGT ĐẦU RA (Output VAT - Số tiền phải nộp)
      // = Doanh thu bán hàng × 8%
      // VD: 100,000đ × 8% = 8,000đ → Phải nộp cho cơ quan thuế
      outputVAT,
      
      // [4] TỔNG TIỀN PHẢI THU (bao gồm thuế GTGT)
      // = Doanh thu bán hàng + Thuế GTGT
      // = Số tiền khách hàng phải thanh toán
      // VD: 100,000đ + 8,000đ = 108,000đ
      totalRevenueWithVAT,
      
      // [CHỉ TIÊU BỔ SUNG] - Giảm giá, chiết khấu thương mại
      // = Tổng voucher/khuyến mại đã giảm cho khách
      // VD: Khách dùng voucher giảm 10,000đ
      totalDiscount: revenue.totalDiscount,
      
      // [CHỈ TIÊU BỔ SUNG] - Phí vận chuyển (Dịch vụ kèm theo)
      // = Phí ship thu từ khách hàng
      totalShipping: revenue.totalShipping,
      //    → Tháng 2 thực chất kém hơn tháng 1!
      netRevenue,
      
      // ============================================
      // GHI CHÚ QUAN TRỌNG KHI NỘP THUẾ:
      // ============================================
      // 1. Thuế GTGT đầu ra (outputVAT): Số tiền phải nộp ngân sách nhà nước
      // 2. Thời hạn nộp: Trước ngày 20 của tháng tiếp theo
      //    VD: Tháng 11/2025 → Nộp trước 20/12/2025
      // 3. Hồ sơ kèm theo:
      //    - Tờ khai thuế GTGT (Mẫu 01/GTGT)
      //    - Bảng kê hóa đơn, chứng từ hàng hóa dịch vụ bán ra (Mẫu 01-1/GTGT)
      //    - Chi tiết đơn hàng (từ phần 'orders' bên dưới)
      // 4. Lưu ý: 
      //    - CHỈ tính đơn DONE (đã hoàn thành, đã thu tiền)
      //    - Đơn CANCELLED, RETURNED KHÔNG tính vào doanh thu
      //    - Cần lưu giữ chứng từ thanh toán (COD/BANK) tối thiểu 10 năm
    },
    
    // Thống kê đơn hàng
    orderStats: {
      totalOrders: revenue.totalOrders,
      totalItems: revenue.totalItems,
      avgOrderValue,
      avgItemsPerOrder: revenue.totalOrders > 0 
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
    orderCode: order._id.toString(),  // _id của order là mã đơn hàng
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
    subtotal: order.amounts.subtotal,        // Tổng giá trị hàng
    discount: order.amounts.discount,        // Giảm giá
    shipping: order.amounts.shippingFee,     // Phí vận chuyển
    grandTotal: order.amounts.grandTotal,    // Tổng thanh toán (có VAT)
    paymentMethod: order.paymentMethod,      // COD hoặc BANK
    
    // Chi tiết sản phẩm
    items: order.items.map((item) => ({
      productName: item.nameSnapshot,        // Tên sản phẩm (snapshot)
      variantName: item.variantSku || 'Không có', // SKU variant
      qty: item.qty,                         // Số lượng
      price: item.price,                     // Đơn giá
      lineTotal: item.lineTotal,             // Thành tiền
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
 * Tạo file Excel cho báo cáo thuế (chuẩn Việt Nam)
 * 
 * PHẦN I: THÔNG TIN CHUNG
 * - Kỳ báo cáo, ngày bắt đầu, ngày kết thúc
 * 
 * PHẦN II: BÁO CÁO THUẾ GTGT (Theo chuẩn kế toán VN)
 * 1. Doanh thu bán hàng (chưa VAT): Tổng giá trị hàng hóa
 * 2. Giảm giá/Voucher: Các khoản giảm trừ
 * 3. Doanh thu thuần: Doanh thu - Giảm giá
 * 4. Thuế GTGT đầu ra 8%: Doanh thu × 8%
 * 5. Tổng tiền thu (bao gồm VAT): Doanh thu + Thuế
 *
 * 
 * PHẦN III: THỐNG KÊ ĐƠN HÀNG
 * - Tổng số đơn hàng hoàn thành (CHỈ DONE)
 * - Thống kê theo trạng thái (bao gồm CANCELLED, RETURNED)
 * - Thống kê theo phương thức thanh toán (COD vs BANK)
 * - Doanh thu theo ngày
 * 
 * PHẦN IV: CHI TIẾT ĐƠN HÀNG
 * - Danh sách tất cả đơn DONE với đầy đủ thông tin
 * 
/**
 * Tạo file Excel báo cáo doanh thu theo tháng với định dạng chuẩn
 * @param {Object} params - { year, month }
 * @returns {Object} - { filename, workbook }
 */
export const generateMonthlyRevenueExcel = async ({ year, month }) => {
  // Lấy chi tiết đơn hàng (bao gồm period và summary)
  const data = await getMonthlyRevenueForExport({ year, month });

  // Tạo workbook và worksheet
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Báo cáo doanh thu');

  // Thiết lập độ rộng cột mặc định
  worksheet.columns = [
    { width: 40 }, { width: 20 }, { width: 15 }, { width: 25 },
    { width: 15 }, { width: 35 }, { width: 18 }, { width: 18 },
    { width: 18 }, { width: 18 }, { width: 20 }
  ];

  let currentRow = 1;

  // ============================================
  // PHẦN I: THÔNG TIN CHUNG
  // ============================================
  const addSectionHeader = (text) => {
    const row = worksheet.getRow(currentRow);
    row.getCell(1).value = text;
    row.getCell(1).font = { bold: true, size: 12 };
    row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    worksheet.mergeCells(currentRow, 1, currentRow, 11);
    currentRow++;
  };

  const addEmptyRow = () => {
    currentRow++;
  };

  const addInfoRow = (label, value) => {
    const row = worksheet.getRow(currentRow);
    row.getCell(1).value = label;
    row.getCell(1).font = { bold: true };
    row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(2).value = value;
    row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
    worksheet.mergeCells(currentRow, 2, currentRow, 4);
    currentRow++;
  };

  addSectionHeader('BÁO CÁO DOANH THU THÁNG ' + data.period.month + '/' + data.period.year);
  addEmptyRow();
  addInfoRow('Tên cửa hàng:', 'TnQ Fashion Store');
  addInfoRow('Tháng:', data.period.month);
  addInfoRow('Năm:', data.period.year);
  addInfoRow('Ngày xuất báo cáo:', new Date().toLocaleDateString('vi-VN'));
  addEmptyRow();

  // ============================================
  // PHẦN II: BÁO CÁO THUẾ
  // ============================================
  addSectionHeader('PHẦN II: BÁO CÁO THUẾ');
  addEmptyRow();

  const addTaxRow = (label, value) => {
    const row = worksheet.getRow(currentRow);
    row.getCell(1).value = label;
    row.getCell(1).font = { bold: true };
    row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(2).value = value;
    row.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(2).numFmt = '#,##0';
    worksheet.mergeCells(currentRow, 2, currentRow, 4);
    currentRow++;
  };

  addTaxRow('Doanh thu bán hàng (chưa VAT):', data.summary.taxReport.salesRevenue);
  addTaxRow('Giảm giá/Voucher (VNĐ):', data.summary.taxReport.totalDiscount);
  addTaxRow('Doanh thu thuần (VNĐ):', data.summary.taxReport.netRevenue);
  addTaxRow('Thuế GTGT đầu ra 8% (VNĐ):', data.summary.taxReport.outputVAT);
  addTaxRow('Tổng tiền thu (bao gồm VAT):', data.summary.taxReport.totalRevenueWithVAT);
  addEmptyRow();

  // ============================================
  // PHẦN III: THỐNG KÊ TỔNG HỢP
  // ============================================
  addSectionHeader('PHẦN III: THỐNG KÊ TỔNG HỢP');
  addEmptyRow();

  const addStatsRow = (label, value) => {
    const row = worksheet.getRow(currentRow);
    row.getCell(1).value = label;
    row.getCell(1).font = { bold: true };
    row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(2).value = value;
    row.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };
    if (typeof value === 'number') {
      row.getCell(2).numFmt = '#,##0';
    }
    worksheet.mergeCells(currentRow, 2, currentRow, 4);
    currentRow++;
  };

  addStatsRow('Tổng số đơn hàng hoàn thành:', data.summary.orderStats.totalOrders);
  addStatsRow('Tổng số sản phẩm đã bán:', data.summary.orderStats.totalItems);
  addStatsRow('Giá trị trung bình/đơn hàng (VNĐ):', data.summary.orderStats.avgOrderValue);
  addStatsRow('Số sản phẩm trung bình/đơn:', data.summary.orderStats.avgItemsPerOrder);
  addEmptyRow();

  // Thống kê theo trạng thái
  if (data.summary.statusBreakdown) {
    addInfoRow('Thống kê theo trạng thái đơn hàng:', '');
    Object.entries(data.summary.statusBreakdown).forEach(([status, stat]) => {
      const statusNames = {
        DONE: 'Hoàn thành',
        CONFIRMED: 'Đã xác nhận',
        CANCELLED: 'Đã hủy',
        RETURNED: 'Hoàn trả',
        PENDING: 'Chờ xử lý',
        SHIPPING: 'Đang giao',
      };
      const statusName = statusNames[status] || status;
      const row = worksheet.getRow(currentRow);
      row.getCell(2).value = `${statusName}:`;
      row.getCell(2).font = { bold: true };
      row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(3).value = `${stat.count} đơn`;
      row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(4).value = stat.totalValue;
      row.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(4).numFmt = '#,##0';
      row.getCell(5).value = 'VNĐ';
      row.getCell(5).alignment = { horizontal: 'left', vertical: 'middle' };
      currentRow++;
    });
    addEmptyRow();
  }

  // Thống kê theo phương thức thanh toán
  addInfoRow('Phân loại theo phương thức thanh toán:', '');
  (data.summary.paymentMethods || []).forEach((pm) => {
    const paymentMethodName = pm.method === 'BANK' ? 'Chuyển khoản' : 'Tiền mặt';
    const row = worksheet.getRow(currentRow);
    row.getCell(2).value = `${paymentMethodName}:`;
    row.getCell(2).font = { bold: true };
    row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(3).value = `${pm.orders} đơn`;
    row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(4).value = pm.revenue;
    row.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(4).numFmt = '#,##0';
    row.getCell(5).value = 'VNĐ';
    row.getCell(5).alignment = { horizontal: 'left', vertical: 'middle' };
    currentRow++;
  });
  addEmptyRow();

  // ============================================
  // PHẦN IV: CHI TIẾT ĐƠN HÀNG
  // ============================================
  addSectionHeader('PHẦN IV: CHI TIẾT CÁC ĐƠN HÀNG ĐÃ HOÀN THÀNH');
  addEmptyRow();

  if (data.orders && data.orders.length > 0) {
    // Header row cho bảng đơn hàng
    const headerRow = worksheet.getRow(currentRow);
    const headers = [
      'STT', 'Mã đơn hàng', 'Ngày tạo', 'Tên khách hàng', 'Số điện thoại',
      'Địa chỉ giao hàng', 'Tổng giá trị hàng (VNĐ)', 'Giảm giá (VNĐ)',
      'Phí vận chuyển (VNĐ)', 'Tổng thanh toán (VNĐ)', 'Phương thức thanh toán'
    ];
    
    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header;
      cell.font = { bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD9D9D9' }
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
    currentRow++;

    // Data rows
    data.orders.forEach((order, index) => {
      const paymentMethodName = order.paymentMethod === 'BANK' ? 'Chuyển khoản' : 'Tiền mặt';
      const row = worksheet.getRow(currentRow);
      
      const values = [
        index + 1,
        order.orderCode,
        new Date(order.createdAt).toLocaleDateString('vi-VN'),
        order.customerName,
        order.customerPhone,
        order.customerAddress,
        order.subtotal,
        order.discount,
        order.shipping,
        order.grandTotal,
        paymentMethodName
      ];

      values.forEach((value, colIndex) => {
        const cell = row.getCell(colIndex + 1);
        cell.value = value;
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };

        // Căn lề và định dạng số
        if (colIndex === 0) {
          // STT - center
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (colIndex >= 6 && colIndex <= 9) {
          // Các cột số tiền - right align
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '#,##0';
        } else {
          // Text columns - left align
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }
      });
      
      currentRow++;
    });
  } else {
    const row = worksheet.getRow(currentRow);
    row.getCell(1).value = 'Không có đơn hàng hoàn thành trong kỳ này';
    row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    currentRow++;
  }
  addEmptyRow();

  // ============================================
  // PHẦN V: CHI TIẾT SẢN PHẨM
  // ============================================
  addSectionHeader('PHẦN V: CHI TIẾT SẢN PHẨM THEO ĐƠN HÀNG');
  addEmptyRow();

  if (data.orders && data.orders.length > 0) {
    // Header row cho bảng sản phẩm
    const productHeaderRow = worksheet.getRow(currentRow);
    const productHeaders = ['Mã đơn', 'Tên sản phẩm', 'Phân loại', 'Số lượng', 'Đơn giá (VNĐ)', 'Thành tiền (VNĐ)'];
    
    productHeaders.forEach((header, index) => {
      const cell = productHeaderRow.getCell(index + 1);
      cell.value = header;
      cell.font = { bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD9D9D9' }
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
    currentRow++;

    // Data rows
    data.orders.forEach((order) => {
      order.items.forEach((item) => {
        const row = worksheet.getRow(currentRow);
        const productValues = [
          order.orderCode,
          item.productName,
          item.variantName,
          item.qty,
          item.price,
          item.lineTotal
        ];

        productValues.forEach((value, colIndex) => {
          const cell = row.getCell(colIndex + 1);
          cell.value = value;
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };

          // Căn lề và định dạng
          if (colIndex === 3) {
            // Số lượng - center
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else if (colIndex === 4 || colIndex === 5) {
            // Đơn giá và thành tiền - right align
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.numFmt = '#,##0';
          } else {
            // Text - left align
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
          }
        });
        
        currentRow++;
      });
    });
  } else {
    const row = worksheet.getRow(currentRow);
    row.getCell(1).value = 'Không có dữ liệu sản phẩm';
    row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    currentRow++;
  }

  return {
    filename: `bao-cao-doanh-thu-thang-${data.period.month}-${data.period.year}.xlsx`,
    workbook: workbook,
  };
};

