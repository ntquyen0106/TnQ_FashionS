import Order from '../models/Order.js';
import Product from '../models/Product.js';

const toDate = (v, def) => {
  if (!v) return def;
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
      { $group: { _id: null, revenue: { $sum: '$amounts.grandTotal' }, count: { $sum: 1 } } },
    ]),
    Order.aggregate([{ $match: matchBase }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: { ...matchBase, status: { $in: ['DONE', 'done'] } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: tz } },
          revenue: { $sum: '$amounts.grandTotal' },
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
