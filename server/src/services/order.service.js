import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import User from '../models/User.js';
import { getCartTotal } from './cart.service.js';
import { computeShippingFee } from '../utils/shipping.js';
import mongoose from 'mongoose';

// Map FE status tokens to model statuses
const FE_TO_MODEL = {
  new: 'PENDING',
  pending: 'PENDING',
  processing: 'CONFIRMED',
  shipping: 'SHIPPING',
  delivering: 'DELIVERING',
  delivered: 'DONE',
  completed: 'DONE',
  done: 'DONE',
  canceled: 'CANCELLED',
  cancelled: 'CANCELLED',
  returned: 'RETURNED',
};

const toModelStatus = (s) => {
  if (!s) return undefined;
  const key = String(s).toLowerCase();
  return FE_TO_MODEL[key] || s; // allow passing model status directly
};

export const checkout = async ({ userId, sessionId, addressId, paymentMethod, selectedItems }) => {
  // 1) Lấy cart
  let cart;
  if (userId) cart = await Cart.findOne({ userId, status: 'active' });
  else if (sessionId) cart = await Cart.findOne({ sessionId, status: 'active' });
  if (!cart) throw new Error('Cart not found');

  // 2) Tính tổng cho các sản phẩm được chọn
  const { subtotal, discount, items } = await getCartTotal({ userId, sessionId, selectedItems });
  if (!items || items.length === 0) throw new Error('No items selected for checkout');

  // 3) Snapshot địa chỉ
  if (!userId) throw new Error('Must login to checkout');
  const user = await User.findById(userId).select('addresses name email').lean();
  if (!user) throw new Error('User not found');
  const addr =
    (user.addresses || []).find((a) => String(a._id) === String(addressId)) ||
    (user.addresses || []).find((a) => a.isDefault);
  if (!addr) throw new Error('Shipping address required');
  const shippingAddress = {
    fullName: addr.fullName,
    phone: addr.phone,
    line1: addr.line1,
    ward: addr.ward,
    district: addr.district,
    city: addr.city,
  };

  // 4) Build items snapshot theo Order schema
  const orderItems = items.map((it) => ({
    productId: it.productId,
    variantSku: it.variantSku,
    nameSnapshot: it.name,
    imageSnapshot: it.imageSnapshot,
    price: Number(it.price),
    qty: Number(it.quantity),
    lineTotal: Number(it.price) * Number(it.quantity),
  }));

  // 5) Amounts theo schema (tính phí ship theo địa chỉ: HCM <=15km free, >15km theo bưu điện; vùng khác theo tier)
  const shippingFee = computeShippingFee(shippingAddress.city, shippingAddress.district, subtotal);
  const amounts = {
    subtotal: Number(subtotal),
    discount: Number(discount) || 0,
    shippingFee,
    grandTotal: Math.max(Number(subtotal) - (Number(discount) || 0) + shippingFee, 0),
  };

  // 6) Chuẩn hoá phương thức thanh toán + trạng thái
  const methodUpper = String(paymentMethod || 'COD').toUpperCase();
  // Tạm map các ví điện tử về BANK cho tới khi tích hợp cổng thanh toán
  const walletToBank = new Set(['MOMO', 'ZALOPAY', 'VNPAY']);
  const pm = methodUpper === 'COD' ? 'COD' : walletToBank.has(methodUpper) ? 'BANK' : 'BANK';
  const status = 'PENDING';

  // 7) Tạo order
  const order = await Order.create({
    userId,
    items: orderItems,
    amounts,
    shippingAddress,
    paymentMethod: pm,
    status,
    history: [
      {
        action: 'CREATE',
        note: 'Order created',
        fromStatus: null,
        toStatus: status,
        byUserId: userId,
      },
    ],
  });

  // 8) Xoá các item đã mua khỏi cart
  cart.items = cart.items.filter(
    (ci) =>
      !orderItems.some(
        (oi) => String(ci.productId) === String(oi.productId) && ci.variantSku === oi.variantSku,
      ),
  );
  await cart.save();

  return order;
};

export const list = async ({ status, unassigned, assignee, meId, limit = 100 }) => {
  const query = {};
  const ms = toModelStatus(status);
  if (ms) {
    query.status = { $in: [ms, String(ms).toLowerCase()] };
  }
  if (unassigned) query.assignedStaffId = null;
  if (assignee === 'me' && meId) query.assignedStaffId = meId;
  const items = await Order.find(query).sort({ createdAt: -1 }).limit(limit).lean();
  return { items };
};

export const claim = async ({ orderId, staffId }) => {
  const order = await Order.findOne({ _id: orderId }).lean();
  if (!order) throw new Error('Order not found');
  if (order.assignedStaffId) throw new Error('Order already assigned');
  if (order.status !== 'PENDING') throw new Error('Only PENDING orders can be claimed');

  const updated = await Order.findOneAndUpdate(
    { _id: orderId, assignedStaffId: null, status: { $in: ['PENDING', 'pending'] } },
    {
      $set: { assignedStaffId: staffId, status: 'CONFIRMED' },
      $push: {
        history: {
          action: 'ASSIGN',
          fromStatus: 'PENDING',
          toStatus: 'CONFIRMED',
          byUserId: staffId,
          note: 'Claim order',
        },
      },
    },
    { new: true },
  ).lean();
  if (!updated) throw new Error('Failed to claim');
  return updated;
};

export const assign = async ({ orderId, staffId, byUserId }) => {
  const updated = await Order.findByIdAndUpdate(
    orderId,
    {
      $set: { assignedStaffId: staffId },
      $push: { history: { action: 'ASSIGN', byUserId, note: `Assign to ${staffId}` } },
    },
    { new: true },
  ).lean();
  if (!updated) throw new Error('Order not found');
  return updated;
};

export const updateStatus = async ({ orderId, status, byUserId }) => {
  const to = toModelStatus(status);
  if (!to) throw new Error('Invalid status');
  const order = await Order.findById(orderId).lean();
  if (!order) throw new Error('Order not found');

  const from = order.status;
  const updated = await Order.findByIdAndUpdate(
    orderId,
    {
      $set: { status: to },
      $push: {
        history: { action: 'STATUS_CHANGE', fromStatus: from, toStatus: to, byUserId },
      },
    },
    { new: true },
  ).lean();
  return updated;
};

export const statsForUser = async ({ staffId, from, to, status }) => {
  const match = { assignedStaffId: new mongoose.Types.ObjectId(staffId) };
  // Date range: from/to are ISO date strings (yyyy-mm-dd)
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = new Date(from + 'T00:00:00.000Z');
    if (to) match.createdAt.$lte = new Date(to + 'T23:59:59.999Z');
  }
  // Status filter: allow comma-separated list, and accept FE aliases
  if (status) {
    const list = String(status)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.length) {
      // Map FE to model tokens when possible; also allow raw model tokens
      const mapped = list.map((s) => (FE_TO_MODEL[String(s).toLowerCase()] || s).toUpperCase());
      match.status = { $in: mapped };
    }
  }

  const pipeline = [{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }];
  const agg = await Order.aggregate(pipeline);
  const byStatus = Object.fromEntries(agg.map((x) => [x._id, x.count]));
  return {
    byStatus,
    total: agg.reduce((a, b) => a + b.count, 0),
    done: byStatus.DONE || 0,
    pending: byStatus.PENDING || 0,
  };
};
