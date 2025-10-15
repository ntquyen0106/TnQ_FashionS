import Order from '../models/Order.js';
import { verifyPayOSWebhook, getPayOSPaymentInfo, cancelPayOSPayment } from '../services/payment.service.js';

/**
 * PayOS Webhook Handler
 * Được gọi khi thanh toán thành công/thất bại
 * PayOS sẽ tự động gọi route này khi user scan QR và chuyển khoản thành công
 */
export const handlePayOSWebhook = async (req, res) => {
  try {
    const webhookData = req.body;
    
    // Verify webhook signature
    const isValid = verifyPayOSWebhook(webhookData);
    if (!isValid) {
      console.error(' Invalid webhook signature');
      return res.status(400).json({ error: 0, message: 'Invalid signature' });
    }

    const { code, desc, data } = webhookData;
    
    if (!data || !data.orderCode) {
      console.error(' Missing orderCode in webhook data');
      return res.status(400).json({ error: 0, message: 'Missing orderCode' });
    }

    const { orderCode, amount, description, accountNumber, reference, transactionDateTime } = data;
    
    console.log(` Payment webhook - OrderCode: ${orderCode}, Amount: ${amount}, Code: ${code}`);
    
    // code === "00" nghĩa là thanh toán thành công
    if (code === '00') {
      // Tìm order theo paymentOrderCode
      const order = await Order.findOne({ paymentOrderCode: orderCode });
      
      if (!order) {
        console.error(` Order not found for orderCode: ${orderCode}`);
        return res.status(404).json({ error: 0, message: 'Order not found' });
      }

      // Kiểm tra số tiền có khớp không (bảo mật)
      if (order.grandTotal !== amount) {
        console.error(` Amount mismatch! Order: ${order.grandTotal}, Paid: ${amount}`);
        return res.status(400).json({ error: 0, message: 'Amount mismatch' });
      }

      // Cập nhật trạng thái order
      if (order.status === 'AWAITING_PAYMENT') {
        order.status = 'CONFIRMED';
        order.history.push({
          action: 'PAYMENT_CONFIRMED',
          fromStatus: 'AWAITING_PAYMENT',
          toStatus: 'CONFIRMED',
          note: `Thanh toán thành công qua PayOS. Số tiền: ${amount}đ. Thời gian: ${transactionDateTime}. Mã tham chiếu: ${reference}`,
        });
        await order.save();
        
        console.log(`✅ Order ${order._id} payment confirmed via PayOS`);
      } else {
        console.log(`⚠️ Order ${order._id} already in status: ${order.status}`);
      }
    } else {
      console.log(`⚠️ PayOS webhook with non-success code: ${code}, desc: ${desc}`);
    }

    // PayOS yêu cầu response này
    res.json({ error: 0, message: 'Success' });
  } catch (error) {
    console.error('💥 PayOS webhook error:', error);
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

    // Nếu không có paymentOrderCode, không thể check
    if (!order.paymentOrderCode) {
      return res.json({
        orderId: order._id,
        status: order.status,
        paymentMethod: order.paymentMethod,
        isPaid: order.status !== 'AWAITING_PAYMENT',
      });
    }

    // Gọi PayOS API để lấy trạng thái mới nhất
    try {
      const paymentInfo = await getPayOSPaymentInfo(order.paymentOrderCode);
      
      // Cập nhật order nếu payment đã thành công nhưng webhook chưa đến
      if (paymentInfo.status === 'PAID' && order.status === 'AWAITING_PAYMENT') {
        order.status = 'CONFIRMED';
        order.history.push({
          action: 'PAYMENT_CONFIRMED',
          fromStatus: 'AWAITING_PAYMENT',
          toStatus: 'CONFIRMED',
          note: 'Thanh toán thành công (checked via API)',
        });
        await order.save();
      }

      res.json({
        orderId: order._id,
        status: order.status,
        paymentMethod: order.paymentMethod,
        isPaid: paymentInfo.status === 'PAID',
        paymentInfo: {
          amount: paymentInfo.amount,
          status: paymentInfo.status,
          transactions: paymentInfo.transactions,
        },
      });
    } catch (error) {
      // Nếu không lấy được thông tin từ PayOS, trả về thông tin từ DB
      res.json({
        orderId: order._id,
        status: order.status,
        paymentMethod: order.paymentMethod,
        isPaid: order.status !== 'AWAITING_PAYMENT',
      });
    }
  } catch (error) {
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

    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }

    if (order.status !== 'AWAITING_PAYMENT') {
      return res.status(400).json({ error: 'Chỉ có thể hủy đơn hàng đang chờ thanh toán' });
    }

    // Hủy link thanh toán trên PayOS nếu có
    if (order.paymentOrderCode) {
      try {
        await cancelPayOSPayment(order.paymentOrderCode, 'Customer cancelled order');
      } catch (error) {
        console.error('Error cancelling PayOS payment:', error);
        // Vẫn tiếp tục hủy order
      }
    }

    order.status = 'CANCELLED';
    order.history.push({
      action: 'CANCEL',
      fromStatus: 'AWAITING_PAYMENT',
      toStatus: 'CANCELLED',
      byUserId: userId,
      note: 'Khách hàng hủy đơn hàng',
    });
    await order.save();

    res.json({ message: 'Hủy đơn hàng thành công', order });
  } catch (error) {
    next(error);
  }
};
