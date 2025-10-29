import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import User from '../models/User.js';
import { getCartTotal } from './cart.service.js';
import { computeShippingFee } from '../utils/shipping.js';
import { createPayOSPayment } from './payment.service.js';

// FE → Model status mapping (giữ theo FE của bạn)
const FE_TO_MODEL = {
  new: 'PENDING',
  pending: 'PENDING',
  awaiting_payment: 'AWAITING_PAYMENT',
  confirmed: 'CONFIRMED',
  processing: 'CONFIRMED',
  packing: 'PACKING',
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
  return FE_TO_MODEL[key] || s; // cho phép truyền trực tiếp model token
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

  // 4) Items snapshot theo Order schema
  const orderItems = items.map((it) => ({
    productId: it.productId,
    variantSku: it.variantSku,
    nameSnapshot: it.name,
    imageSnapshot: it.imageSnapshot,
    price: Number(it.price),
    qty: Number(it.quantity),
    lineTotal: Number(it.price) * Number(it.quantity),
  }));

  // 5) Amounts theo schema
  const shippingFee = computeShippingFee(shippingAddress.city, shippingAddress.district, subtotal);
  const amounts = {
    subtotal: Number(subtotal),
    discount: Number(discount) || 0,
    shippingFee,
    grandTotal: Math.max(Number(subtotal) - (Number(discount) || 0) + shippingFee, 0),
  };

  // 6) Chuẩn hoá payment + status ban đầu
  const methodUpper = String(paymentMethod || 'COD').toUpperCase();
  const pm = methodUpper === 'COD' ? 'COD' : 'BANK';
  const status = pm === 'COD' ? 'PENDING' : 'AWAITING_PAYMENT';

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
        note: pm === 'COD' ? 'Order created' : 'Order created, awaiting payment',
        fromStatus: null,
        toStatus: status,
        byUserId: userId,
      },
    ],
  });

  // 8) Nếu BANK → tạo link PayOS
  let paymentData = null;
  if (pm === 'BANK') {
    try {
      paymentData = await createPayOSPayment({
        orderId: order._id.toString(),
        amount: amounts.grandTotal,
        returnUrl: `${process.env.CLIENT_URL}/order-success?orderId=${order._id}`,
        cancelUrl: `${process.env.CLIENT_URL}/?cancelled=true&orderId=${order._id}`,
      });
      order.paymentOrderCode = paymentData.orderCode;
      await order.save();
    } catch (error) {
      console.error('Error creating PayOS payment:', error);
      throw new Error('Không thể tạo link thanh toán. Vui lòng thử lại sau.');
    }
  }

  // 9) Xoá item đã mua khỏi cart
  cart.items = cart.items.filter(
    (ci) =>
      !orderItems.some(
        (oi) => String(ci.productId) === String(oi.productId) && ci.variantSku === oi.variantSku,
      ),
  );
  await cart.save();

  return { order, paymentData };
};

export const list = async ({ status, unassigned, assignee, meId, limit = 100 }) => {
  const query = {};
  let statuses = [];
  if (status) {
    // Hỗ trợ truyền nhiều trạng thái dạng chuỗi: 'pending,awaiting_payment'
    statuses = String(status)
      .split(',')
      .map((s) => toModelStatus(s.trim()))
      .filter(Boolean);
    if (statuses.length > 0) {
      // chấp nhận cả lowercase nếu DB cũ có dữ liệu thường
      query.status = { $in: [...statuses, ...statuses.map((s) => s.toLowerCase())] };
    }
  }
  if (unassigned) query.assignedStaffId = null;
  if (assignee && assignee !== 'me') query.assignedStaffId = assignee;
  if (assignee === 'me' && meId) query.assignedStaffId = meId;
  const items = await Order.find(query).sort({ createdAt: -1 }).limit(limit).lean();
  return { items };
};

export const claim = async ({ orderId, staffId }) => {
  const order = await Order.findOne({ _id: orderId }).lean();
  if (!order) throw new Error('Order not found');
  if (order.assignedStaffId) throw new Error('Order already assigned');
  if (!['PENDING', 'pending'].includes(order.status)) {
    throw new Error('Only PENDING orders can be claimed');
  }

  const updated = await Order.findOneAndUpdate(
    { _id: orderId, assignedStaffId: null, status: { $in: ['PENDING', 'pending'] } },
    {
      $set: { assignedStaffId: staffId }, // KHÔNG đổi status
      $push: {
        history: {
          action: 'ASSIGN',
          fromStatus: 'PENDING',
          toStatus: 'PENDING', // vẫn là PENDING
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

export const updateStatus = async ({ orderId, status, byUserId, note, reasons, other }) => {
  const to = toModelStatus(status);
  if (!to) throw new Error('Invalid status');

  const order = await Order.findById(orderId).lean();
  if (!order) throw new Error('Order not found');

  const from = order.status;

  // Build note text when not provided explicitly. Prefer role-based prefix (Admin/Staff).
  let finalNote = typeof note === 'string' && note.trim() ? String(note).trim() : null;
  if (!finalNote) {
    const list = Array.isArray(reasons) ? reasons.filter(Boolean) : [];
    const noteParts = list.slice(0);
    if (other && String(other).trim()) noteParts.push(`Khác: ${String(other).trim()}`);
    if (noteParts.length) {
      // Determine actor label from byUserId (try to read role from User model)
      let actorLabel = 'Staff';
      try {
        if (byUserId) {
          const u = await User.findById(byUserId).select('role name').lean();
          if (u && u.role)
            actorLabel = u.role === 'admin' ? 'Admin' : u.role === 'staff' ? 'Staff' : 'User';
        }
      } catch (err) {
        // ignore lookup failures and fall back to 'Staff'
      }
      finalNote = `${actorLabel} cancel: ${noteParts.join(', ')}`;
    }
  }

  const historyEntry = {
    action: to === 'CANCELLED' ? 'CANCEL' : 'STATUS_CHANGE',
    fromStatus: from,
    toStatus: to,
    byUserId,
  };
  if (finalNote) historyEntry.note = finalNote;

  const updated = await Order.findByIdAndUpdate(
    orderId,
    {
      $set: { status: to },
      $push: { history: historyEntry },
    },
    { new: true },
  ).lean();

  return updated;
};

export const statsForUser = async ({ staffId, from, to, status }) => {
  const match = { assignedStaffId: new mongoose.Types.ObjectId(staffId) };

  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = new Date(from + 'T00:00:00.000Z');
    if (to) match.createdAt.$lte = new Date(to + 'T23:59:59.999Z');
  }

  if (status) {
    const list = String(status)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.length) {
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

// Update a specific order item's variant (size/color)
// Options: pass exact sku OR pass color+size to resolve a variant sku by product
export const updateItemVariant = async ({ orderId, index, sku, color, size, byUserId }) => {
  if (!Number.isInteger(index) || index < 0) {
    const err = new Error('Invalid item index');
    err.status = 400;
    throw err;
  }

  const order = await Order.findById(orderId);
  if (!order) throw new Error('Order not found');
  if (!order.items || !order.items[index]) {
    const err = new Error('Order item not found');
    err.status = 404;
    throw err;
  }

  const item = order.items[index];

  // Only allow edit when order is PENDING
  const st = String(order.status).toUpperCase();
  if (st !== 'PENDING') {
    const err = new Error('Chỉ có thể cập nhật sản phẩm khi đơn đang ở trạng thái CHỜ XÁC NHẬN');
    err.status = 400;
    throw err;
  }

  // Resolve target variant
  let targetVariant = null;
  let product = null;
  if (sku) {
    product = await mongoose
      .model('Product')
      .findOne({ 'variants.sku': sku }, { name: 1, variants: 1, images: 1 });
    if (product) targetVariant = (product.variants || []).find((v) => v.sku === sku) || null;
  } else {
    // resolve by productId + color + size; if one missing, keep from current variant
    product = await mongoose
      .model('Product')
      .findById(item.productId)
      .select('variants images name');
    if (product) {
      const variants = product.variants || [];
      const current = variants.find((v) => v.sku === item.variantSku) || null;
      const effColor = color != null && color !== '' ? String(color) : String(current?.color || '');
      const effSize = size != null && size !== '' ? String(size) : String(current?.size || '');
      targetVariant =
        variants.find(
          (v) => String(v.color || '') === effColor && String(v.size || '') === effSize,
        ) || null;
    }
  }
  if (!product || !targetVariant) {
    const err = new Error('Không tìm thấy biến thể phù hợp');
    err.status = 404;
    throw err;
  }

  // Update snapshot fields
  item.variantSku = targetVariant.sku;
  // Keep nameSnapshot; update imageSnapshot if variant has image
  const vImg =
    targetVariant.imagePublicId ||
    (product.images || []).find((x) => x.isPrimary)?.publicId ||
    item.imageSnapshot;
  item.imageSnapshot = vImg;
  // Update price, lineTotal
  item.price = Number(targetVariant.price || item.price);
  item.lineTotal = Number(item.price) * Number(item.qty);

  // Recompute amounts
  const subtotal = order.items.reduce((s, it) => s + Number(it.lineTotal || 0), 0);
  order.amounts.subtotal = subtotal;
  order.amounts.grandTotal = Math.max(
    subtotal - Number(order.amounts.discount || 0) + Number(order.amounts.shippingFee || 0),
    0,
  );

  // Push history
  order.history.push({
    action: 'EDIT',
    byUserId,
    note: `Update item #${index + 1} to SKU ${targetVariant.sku}${
      color || size ? ` (${color || ''}${color && size ? ' / ' : ''}${size || ''})` : ''
    }`,
  });

  await order.save();
  return order.toObject();
};
