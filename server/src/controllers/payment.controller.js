import Order from '../models/Order.js';
import {
  verifyPayOSWebhook,
  processPaymentSuccess,
  processPaymentFailure,
  syncOrderStatusWithPayOS,
  getPayOSPaymentInfo,
  cancelPayOSPayment,
  createPayOSPayment,
} from '../services/payment.service.js';
import { releaseInventoryForOrder } from '../services/inventory.service.js';

/**
 * PayOS Webhook Handler
 * Được gọi khi thanh toán thành công/thất bại
 */
export const handlePayOSWebhook = async (req, res) => {
  try {
    const webhookData = req.body;

    // Verify webhook signature
    const verifiedData = await verifyPayOSWebhook(webhookData);
    if (!verifiedData) {
      console.error('❌ [PayOS Webhook] Invalid signature');
      return res.status(400).json({ error: 0, message: 'Invalid signature' });
    }

    const { code, desc, data } = verifiedData;

    if (!data || !data.orderCode) {
      console.error('❌ [PayOS Webhook] Missing orderCode');
      return res.status(400).json({ error: 0, message: 'Missing orderCode' });
    }

    const { orderCode, amount, reference, transactionDateTime } = data;

    // Log webhook info
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📦 [PayOS Webhook] Received payment notification`);
    console.log(`   OrderCode: ${orderCode}`);
    console.log(`   Amount: ${amount.toLocaleString('vi-VN')}đ`);
    console.log(`   Status: ${code} - ${desc}`);
    console.log(`   Reference: ${reference}`);
    console.log(`   Time: ${transactionDateTime}`);

    // Xử lý theo status code
    if (code === '00') {
      // Thanh toán thành công
      const result = await processPaymentSuccess(orderCode, amount, reference, transactionDateTime);

      if (!result.success) {
        if (result.reason === 'ORDER_NOT_FOUND') {
          console.warn(`⚠️  Test webhook from PayOS`);
          console.log(`${'='.repeat(60)}\n`);
          return res.json({ error: 0, message: 'Webhook received' });
        }
        if (result.reason === 'AMOUNT_MISMATCH') {
          console.log(`${'='.repeat(60)}\n`);
          return res.status(400).json({ error: 0, message: 'Amount mismatch' });
        }
      }
    } else {
      // Thanh toán thất bại/hủy
      console.log(`⚠️  [PayOS Webhook] Payment not successful: ${code} - ${desc}`);
      await processPaymentFailure(orderCode, code, desc, reference);
    }

    console.log(`${'='.repeat(60)}\n`);
    res.json({ error: 0, message: 'Success' });
  } catch (error) {
    console.error('💥 [PayOS Webhook] Error:', error.message);
    console.error(error.stack);
    res.status(500).json({ error: -1, message: 'Internal server error' });
  }
};

/**
 * Kiểm tra trạng thái thanh toán
 * Frontend có thể gọi để check payment status
 */
export const checkPaymentStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }

    // Nếu không có paymentOrderCode, trả về thông tin cơ bản
    if (!order.paymentOrderCode) {
      return res.json({
        orderId: order._id,
        status: order.status,
        paymentMethod: order.paymentMethod,
        isPaid: order.status !== 'AWAITING_PAYMENT',
      });
    }

    // Sử dụng service method để đồng bộ trạng thái với PayOS
    const result = await syncOrderStatusWithPayOS(orderId);

    if (!result.success) {
      // Nếu không lấy được info từ PayOS, trả về thông tin từ DB
      return res.json({
        orderId: order._id,
        status: order.status,
        paymentMethod: order.paymentMethod,
        isPaid: order.status !== 'AWAITING_PAYMENT',
        synced: false,
      });
    }

    // Trả về thông tin đã được đồng bộ
    res.json({
      orderId: result.orderId,
      status: result.status,
      paymentMethod: order.paymentMethod,
      isPaid: result.paymentInfo?.status === 'PAID',
      synced: result.synced,
      statusChanged: result.statusChanged,
      paymentInfo: result.paymentInfo,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Xử lý khi user hủy thanh toán trên trang PayOS
 * Client gọi endpoint này khi nhận được redirect về cancelUrl
 */
export const handleUserCancelPayment = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    console.log('\n🔙 [User Cancel Payment] Request received');
    console.log(`   Order ID: ${orderId}`);

    const order = await Order.findById(orderId);
    if (!order) {
      console.error('❌ [User Cancel Payment] Order not found');
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }

    console.log(`   Current Status: ${order.status}`);
    console.log(`   Payment Order Code: ${order.paymentOrderCode || 'N/A'}`);

    // Chỉ xử lý nếu đơn hàng đang chờ thanh toán
    if (order.status !== 'AWAITING_PAYMENT') {
      console.log(`ℹ️  [User Cancel Payment] Order already in status: ${order.status}`);
      return res.json({
        message: 'Đơn hàng đã được xử lý',
        order: {
          _id: order._id,
          status: order.status,
        },
      });
    }

    // Hủy link thanh toán trên PayOS → Sẽ trigger webhook
    if (order.paymentOrderCode) {
      try {
        console.log(`🔄 [User Cancel Payment] Calling PayOS cancel API...`);
        await cancelPayOSPayment(order.paymentOrderCode, 'Khách hàng hủy thanh toán');
        console.log(`✅ [User Cancel Payment] PayOS cancel API called - webhook will be sent`);
      } catch (error) {
        console.error('💥 [User Cancel Payment] PayOS cancel API error:', error.message);
        // Nếu PayOS cancel fail, vẫn cập nhật DB
      }
    }

    // Trả lại tồn kho
    console.log(`\n🔄 [User Cancel Payment] Releasing inventory...`);
    try {
      await releaseInventoryForOrder(order);
    } catch (err) {
      console.error(`⚠️  [User Cancel Payment] Failed to release inventory:`, err.message);
      // Vẫn tiếp tục cancel order
    }

    // Cập nhật trạng thái trong DB
    order.status = 'CANCELLED';
    order.history.push({
      action: 'USER_CANCEL_PAYMENT',
      fromStatus: 'AWAITING_PAYMENT',
      toStatus: 'CANCELLED',
      note: 'Khách hàng hủy thanh toán trên trang PayOS',
    });
    await order.save();

    console.log(`✅ [User Cancel Payment] Order cancelled successfully`);
    console.log(`   Status: AWAITING_PAYMENT → CANCELLED\n`);

    res.json({
      message: 'Đơn hàng đã được hủy',
      order: {
        _id: order._id,
        status: order.status,
      },
    });
  } catch (error) {
    console.error('💥 [User Cancel Payment] Unexpected error:', error);
    next(error);
  }
};

/**
 * Hủy đơn hàng chưa thanh toán
 */
export const cancelUnpaidOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id;

    console.log('\n🚫 [Cancel Order] Request received');
    console.log(`   Order ID: ${orderId}`);
    console.log(`   User ID: ${userId}`);

    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) {
      console.error('❌ [Cancel Order] Order not found');
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }

    console.log(`   Current Status: ${order.status}`);
    console.log(`   Payment Order Code: ${order.paymentOrderCode || 'N/A'}`);

    if (order.status !== 'AWAITING_PAYMENT') {
      console.error(`❌ [Cancel Order] Cannot cancel - status is ${order.status}`);
      return res.status(400).json({ error: 'Chỉ có thể hủy đơn hàng đang chờ thanh toán' });
    }

    // Hủy link thanh toán trên PayOS nếu có → Sẽ trigger webhook
    if (order.paymentOrderCode) {
      try {
        console.log(`🔄 [Cancel Order] Calling PayOS cancel API...`);
        await cancelPayOSPayment(order.paymentOrderCode, 'Khách hàng hủy đơn hàng');
        console.log(`✅ [Cancel Order] PayOS cancel API called - webhook will be sent`);
      } catch (error) {
        console.error('💥 [Cancel Order] PayOS cancel API error:', error.message);
        // Vẫn tiếp tục hủy order trong DB
      }
    }

    // Trả lại tồn kho
    console.log(`\n🔄 [Cancel Order] Releasing inventory...`);
    try {
      await releaseInventoryForOrder(order);
    } catch (err) {
      console.error(`⚠️  [Cancel Order] Failed to release inventory:`, err.message);
      // Vẫn tiếp tục cancel order
    }

    // Cập nhật trạng thái trong DB
    order.status = 'CANCELLED';
    order.history.push({
      action: 'CANCEL',
      fromStatus: 'AWAITING_PAYMENT',
      toStatus: 'CANCELLED',
      byUserId: userId,
      note: 'Khách hàng hủy đơn hàng',
    });
    await order.save();

    console.log(`✅ [Cancel Order] Order cancelled successfully`);
    console.log(`   Status: AWAITING_PAYMENT → CANCELLED\n`);

    res.json({ message: 'Hủy đơn hàng thành công', order });
  } catch (error) {
    console.error('💥 [Cancel Order] Unexpected error:', error);
    next(error);
  }
};

/**
 * Tạo (hoặc tạo lại) link thanh toán PayOS cho đơn đang chờ thanh toán
 */
export const createPaymentLinkForOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.user?._id;

    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });

    if (String(order.status).toUpperCase() !== 'AWAITING_PAYMENT') {
      return res.status(400).json({ message: 'Chỉ tạo link cho đơn đang chờ thanh toán' });
    }

    const amount = Number(order?.amounts?.grandTotal || 0);
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Số tiền không hợp lệ để tạo thanh toán' });
    }

    const paymentData = await createPayOSPayment({
      orderId: String(order._id),
      amount,
      returnUrl: `${process.env.CLIENT_URL}/order-success?orderId=${order._id}`,
      cancelUrl: `${process.env.CLIENT_URL}/?cancelled=true&orderId=${order._id}`,
    });

    // Lưu lại orderCode mới
    order.paymentOrderCode = paymentData.orderCode;
    await order.save();

    return res.json({ paymentData });
  } catch (error) {
    next(error);
  }
};
