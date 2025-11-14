import * as orderService from '../services/order.service.js';
import Order from '../models/Order.js';
import Review from '../models/Review.js';
import mongoose from 'mongoose';
import User from '../models/User.js';

export const postCheckout = async (req, res, next) => {
  try {
    const body = { ...req.body, userId: req.user?._id };
    const order = await orderService.checkout(body);
    res.json(order);
  } catch (e) {
    next(e);
  }
};

export const getMine = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    const orders = await Order.find({ userId }).sort({ createdAt: -1 }).limit(100).lean();

    // Get all reviewed orderIds
    const orderIds = orders.map((o) => o._id);
    const reviews = await Review.find({
      orderId: { $in: orderIds },
      userId,
    })
      .distinct('orderId')
      .lean();

    const reviewedOrderIds = new Set(reviews.map((id) => id.toString()));

    // Add canReview field
    const items = orders.map((order) => ({
      ...order,
      canReview:
        (order.status === 'DONE' || order.status === 'RETURNED') &&
        !reviewedOrderIds.has(order._id.toString()),
    }));

    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const getOneMine = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;
    const one = await Order.findOne({ _id: id, userId }).lean();
    if (!one) return res.status(404).json({ message: 'Order not found' });
    res.json(one);
  } catch (e) {
    next(e);
  }
};

// Staff/Admin: get any order by id
export const getOneAny = async (req, res, next) => {
  try {
    // ✅ Đặt các cấu hình riêng của hàm ngay bên trong, dễ quản lý
    const STATUS_LABEL = {
      PENDING: 'Chờ xác nhận',
      AWAITING_PAYMENT: 'Chờ thanh toán',
      CONFIRMED: 'Đã xác nhận',
      PACKING: 'Đang đóng gói',
      SHIPPING: 'Vận chuyển',
      DELIVERING: 'Đang giao',
      DONE: 'Hoàn tất',
      CANCELLED: 'Đã hủy',
      RETURNED: 'Trả/Hoàn tiền',
    };

    const SHOW_FULL_FOR_STAFF = false; // ← đổi true nếu muốn nhân viên cũng xem full lịch sử

    const { id } = req.params;

    const one = await Order.findById(id)
      .populate({ path: 'userId', select: 'name role' })
      .populate({ path: 'assignedStaffId', select: 'name role' })
      .populate({ path: 'history.byUserId', select: 'name role' })
      .lean();

    if (!one) return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });

    const role = req.user?.role;

    const candidateIds = new Set();
    if (one.userId?._id) candidateIds.add(one.userId._id.toString());
    if (one.assignedStaffId?._id) candidateIds.add(one.assignedStaffId._id.toString());

    for (const h of one.history || []) {
      const by = h.byUserId;
      if (by && typeof by === 'object' && by._id) candidateIds.add(by._id.toString());

      if (String(h.action).toUpperCase() === 'ASSIGN' && typeof h.note === 'string') {
        const m = h.note.match(/Assign to\s+([0-9a-f]{24})/i);
        if (m && m[1]) candidateIds.add(m[1]);
      }
    }

    const users = await User.find({ _id: { $in: Array.from(candidateIds) } })
      .select('name role')
      .lean();
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    const customerName =
      one.userId?.name || one.shippingAddress?.fullName || one.customerName || 'Khách hàng';

    const mappedHistory = (one.history || []).map((h) => {
      const action = String(h.action || '').toUpperCase();
      const to = h.toStatus ? String(h.toStatus).toUpperCase() : null;

      let actorName = 'Hệ thống';
      let actorRole = 'Hệ thống';
      if (h.byUserId && typeof h.byUserId === 'object') {
        actorName = h.byUserId.name || actorName;
        actorRole =
          h.byUserId.role === 'admin'
            ? 'Admin'
            : h.byUserId.role === 'staff'
            ? 'Nhân viên'
            : 'Khách hàng';
      } else if (action === 'CREATE') {
        actorName = customerName;
        actorRole = 'Khách hàng';
      }

      let assigneeName = null;
      if (action === 'ASSIGN' && typeof h.note === 'string') {
        const m = h.note.match(/Assign to\s+([0-9a-f]{24})/i);
        if (m && m[1]) {
          const assignee = userMap.get(m[1]);
          assigneeName = assignee?.name || m[1];
        }
      } else if (action === 'ASSIGN' && one.assignedStaffId?._id) {
        assigneeName = one.assignedStaffId?.name || null;
      }

      let label = 'Hoạt động';
      if (action === 'CREATE') label = `Tạo đơn`;
      else if (action === 'ASSIGN') label = 'Gán phụ trách';
      else if (action === 'EDIT') label = 'Chỉnh sửa sản phẩm';
      else if (action === 'CANCEL') label = 'Hủy đơn';
      else if (action === 'STATUS_CHANGE' || to) {
        label = STATUS_LABEL[to] || to || 'Cập nhật trạng thái';
      }

      return {
        type: action,
        status: to || null,
        label,
        actorName,
        actorRole,
        assigneeName,
        changedAt: h.at || h.createdAt || null,
      };
    });

    // 🚫 Staff không xem lịch sử
    if (role === 'staff' && !SHOW_FULL_FOR_STAFF) {
      return res.json({
        ...one,
        history: [],
        assignedStaff: one.assignedStaffId || null,
        assignedStaffName: one.assignedStaffId?.name || null,
      });
    }

    // ✅ Admin hoặc staff được phép xem full
    return res.json({
      ...one,
      history: mappedHistory,
      assignedStaff: one.assignedStaffId || null,
      assignedStaffName: one.assignedStaffId?.name || null,
    });
  } catch (err) {
    console.error('getOneAny error:', err);
    next(err);
  }
};

export const cancelMine = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;
    const { reasons = [], other } = req.body || {};
    const one = await Order.findOne({ _id: id, userId }).lean();
    if (!one) return res.status(404).json({ message: 'Order not found' });
    // Idempotent: nếu đã hủy rồi thì trả về luôn, tránh báo lỗi khi FE gọi 2 bước (cancel payment → cancel order)
    if (String(one.status).toUpperCase() === 'CANCELLED') {
      return res.json(one);
    }
    const st = String(one.status).toUpperCase();
    if (!['PENDING', 'AWAITING_PAYMENT'].includes(st)) {
      return res
        .status(400)
        .json({ message: 'Chỉ được hủy khi đơn đang chờ xác nhận hoặc chờ thanh toán' });
    }

    // Use centralized service to handle history + inventory release
    const updated = await orderService.updateStatus({
      orderId: id,
      status: 'canceled',
      byUserId: userId,
      reasons,
      other,
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
};

// Staff/Admin features
export const list = async (req, res, next) => {
  try {
    const { status, unassigned, assignee, limit } = req.query;
    const data = await orderService.list({
      status,
      unassigned: unassigned === 'true' || unassigned === true,
      assignee,
      meId: req.userId,
      limit: Number(limit) || 100,
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
};

export const claim = async (req, res, next) => {
  try {
    const { id } = req.params;
    const out = await orderService.claim({ orderId: id, staffId: req.userId });
    res.json(out);
  } catch (e) {
    next(e);
  }
};

export const assign = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { staffId } = req.body;
    const out = await orderService.assign({ orderId: id, staffId, byUserId: req.userId });
    res.json(out);
  } catch (e) {
    next(e);
  }
};

export const updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, note, reasons, other } = req.body || {};
    const out = await orderService.updateStatus({
      orderId: id,
      status,
      byUserId: req.userId,
      note,
      reasons,
      other,
    });
    res.json(out);
  } catch (e) {
    next(e);
  }
};

export const statsMe = async (req, res, next) => {
  try {
    const { from, to, status } = req.query;
    const data = await orderService.statsForUser({ staffId: req.userId, from, to, status });
    res.json(data);
  } catch (e) {
    next(e);
  }
};

// PATCH /api/orders/:id/items/:index
// body: { sku?: string, color?: string, size?: string }
export const updateItemVariant = async (req, res, next) => {
  try {
    const { id, index } = req.params;
    const { sku, color, size } = req.body || {};
    const out = await orderService.updateItemVariant({
      orderId: id,
      index: Number(index),
      sku,
      color,
      size,
      byUserId: req.userId,
    });
    res.json(out);
  } catch (e) {
    next(e);
  }
};

// POST /api/orders/mark-printed
// body: { orderIds: [...] }
export const markPrinted = async (req, res, next) => {
  try {
    const { orderIds } = req.body || {};
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ message: 'orderIds required' });
    }
    const now = new Date();
    await Order.updateMany({ _id: { $in: orderIds } }, { $set: { printedAt: now } });
    res.json({ success: true, count: orderIds.length, printedAt: now });
  } catch (e) {
    next(e);
  }
};
