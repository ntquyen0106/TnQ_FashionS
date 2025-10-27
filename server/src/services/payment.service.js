import payos from '../config/payos.js';
import Order from '../models/Order.js';

/**
 * Tạo link thanh toán PayOS bằng SDK
 */
export const createPayOSPayment = async ({
  orderId,
  amount,
  description,
  returnUrl,
  cancelUrl,
}) => {
  try {
    const orderCode = Number(Date.now().toString().slice(-9));

    const numericAmount = Number(amount); // ✅ ép kiểu number

    const paymentData = {
      orderCode,
      amount: numericAmount, // ✅ DÙNG numericAmount, KHÔNG dùng amount
      description: description || `Thanh toán đơn #${orderCode}`,
      returnUrl: returnUrl || `${process.env.CLIENT_URL}/order/success`,
      cancelUrl: cancelUrl || `${process.env.CLIENT_URL}/cart`,
      items: [
        {
          name: `DH ${orderId.slice(-8)}`,
          quantity: 1,
          price: numericAmount, // ✅ số, không phải chuỗi
        },
      ],
    };

    console.log(`\n🔄 [PayOS] Creating payment link...`);
    console.log(`   Order ID: ${orderId}`);
    console.log(`   Amount: ${numericAmount.toLocaleString('vi-VN')}đ`);
    console.log(`   Order Code: ${orderCode}`);
    console.log('🔍 [PayOS] Payload sent:', JSON.stringify(paymentData, null, 2));

    const paymentLinkResponse = await payos.paymentRequests.create(paymentData);

    console.log(`✅ [PayOS] Payment link created successfully!`);
    console.log(`   Payment Link ID: ${paymentLinkResponse.paymentLinkId}\n`);

    return {
      checkoutUrl: paymentLinkResponse.checkoutUrl,
      qrCode: paymentLinkResponse.qrCode,
      orderCode: orderCode,
      paymentLinkId: paymentLinkResponse.paymentLinkId,
    };
  } catch (error) {
    // Ghi log chi tiết hơn từ PayOS SDK nếu có
    const status = error?.status || error?.response?.status;
    const data = error?.data || error?.response?.data;
    const code = data?.code;
    const desc = data?.desc || data?.message || error?.message;
    if (data) {
      console.error(
        `❌ [PayOS] Create payment error: HTTP ${status || 200}, ${desc} (code: ${code})`,
      );
      if (data?.error && typeof data.error === 'object') {
        console.error('   Raw PayOS error payload:', JSON.stringify(data.error, null, 2));
      }
    } else {
      console.error('❌ [PayOS] Create payment error:', error?.message || String(error));
    }
    throw new Error(
      `Không thể tạo link thanh toán: ${desc || error?.message || 'Lỗi không xác định từ PayOS'}`,
    );
  }
};

/**
 * Verify webhook signature từ PayOS
 */
export const verifyPayOSWebhook = async (webhookData) => {
  try {
    const { signature, data } = webhookData;

    if (!signature || !data) {
      console.error('❌ [PayOS Webhook] Missing signature or data');
      return null;
    }

    const expectedSignature = await payos.crypto.createSignatureFromObj(
      data,
      process.env.PAYOS_CHECKSUM_KEY,
    );

    if (signature !== expectedSignature) {
      console.error('❌ [PayOS Webhook] Signature verification failed');
      return null;
    }

    return webhookData;
  } catch (error) {
    console.error('❌ [PayOS Webhook] Verification error:', error.message);
    return null;
  }
};

/**
 * Xử lý webhook payment success
 */
export const processPaymentSuccess = async (orderCode, amount, reference, transactionDateTime) => {
  const order = await Order.findOne({ paymentOrderCode: orderCode });

  if (!order) {
    console.warn(`⚠️  [PayOS] Order not found for orderCode: ${orderCode}`);
    return { success: false, reason: 'ORDER_NOT_FOUND' };
  }

  // Kiểm tra số tiền nếu có grandTotal
  if (order.amounts?.grandTotal && order.amounts.grandTotal !== amount) {
    console.error(`❌ [PayOS] Amount mismatch!`);
    console.error(`   Expected: ${order.amounts.grandTotal.toLocaleString('vi-VN')}đ`);
    console.error(`   Received: ${amount.toLocaleString('vi-VN')}đ`);
    return { success: false, reason: 'AMOUNT_MISMATCH', order };
  }

  if (!order.amounts?.grandTotal) {
    console.warn(`⚠️  [PayOS] Order has no grandTotal, skipping amount check`);
  }

  // Cập nhật order nếu đang chờ thanh toán
  if (order.status === 'AWAITING_PAYMENT') {
    // Theo yêu cầu: khi thanh toán thành công → chuyển về PENDING (chờ xác nhận)
    order.status = 'PENDING';
    order.history.push({
      action: 'PAYMENT_CONFIRMED',
      fromStatus: 'AWAITING_PAYMENT',
      toStatus: 'PENDING',
      note: `Thanh toán thành công qua PayOS. Số tiền: ${amount.toLocaleString(
        'vi-VN',
      )}đ. Mã GD: ${reference}`,
    });
    await order.save();

    console.log(`✅ [PayOS] Order ${order._id} payment confirmed → pending for processing`);
    console.log(`   Status: AWAITING_PAYMENT → PENDING`);

    return { success: true, order, statusChanged: true };
  } else {
    console.log(`ℹ️  [PayOS] Order already in status: ${order.status}`);
    return { success: true, order, statusChanged: false };
  }
};

/**
 * Xử lý webhook payment failure/cancellation
 */
export const processPaymentFailure = async (orderCode, code, desc, reference) => {
  const order = await Order.findOne({ paymentOrderCode: orderCode });

  if (!order) {
    console.warn(`⚠️  [PayOS] Order not found for orderCode: ${orderCode}`);
    return { success: false, reason: 'ORDER_NOT_FOUND' };
  }

  if (order.status === 'AWAITING_PAYMENT') {
    order.status = 'CANCELLED';
    order.history.push({
      action: 'PAYMENT_FAILED',
      fromStatus: 'AWAITING_PAYMENT',
      toStatus: 'CANCELLED',
      note: `Thanh toán không thành công qua PayOS. Lý do: ${desc} (Code: ${code}). Mã GD: ${
        reference || 'N/A'
      }`,
    });
    await order.save();

    console.log(`❌ [PayOS] Order ${order._id} cancelled due to payment failure`);
    console.log(`   Status: AWAITING_PAYMENT → CANCELLED`);

    return { success: true, order, statusChanged: true };
  }

  return { success: true, order, statusChanged: false };
};

/**
 * Lấy thông tin thanh toán từ PayOS
 */
export const getPayOSPaymentInfo = async (orderCode) => {
  try {
    const paymentInfo = await payos.paymentRequests.get(orderCode);
    console.log(
      `ℹ️  [PayOS] Get payment info - OrderCode: ${orderCode}, Status: ${paymentInfo.status}`,
    );
    return paymentInfo;
  } catch (error) {
    console.error(`❌ [PayOS] Get payment info error - OrderCode: ${orderCode}:`, error.message);
    throw new Error(`Không thể lấy thông tin thanh toán: ${error.message}`);
  }
};

/**
 * Đồng bộ trạng thái order với PayOS
 */
export const syncOrderStatusWithPayOS = async (orderId) => {
  const order = await Order.findById(orderId);

  if (!order) {
    throw new Error('Order not found');
  }

  if (!order.paymentOrderCode) {
    return {
      orderId: order._id,
      status: order.status,
      synced: false,
      reason: 'NO_PAYMENT_ORDER_CODE',
    };
  }

  try {
    const paymentInfo = await getPayOSPaymentInfo(order.paymentOrderCode);

    console.log(`\n🔍 [PayOS] Syncing order status - OrderCode: ${order.paymentOrderCode}`);
    console.log(`   PayOS Status: ${paymentInfo.status}`);
    console.log(`   Order Status: ${order.status}`);

    let statusChanged = false;

    // Sync status: PAID → set PENDING (chờ xác nhận)
    if (paymentInfo.status === 'PAID' && order.status === 'AWAITING_PAYMENT') {
      order.status = 'PENDING';
      order.history.push({
        action: 'PAYMENT_CONFIRMED',
        fromStatus: 'AWAITING_PAYMENT',
        toStatus: 'PENDING',
        note: 'Thanh toán thành công (synced via API)',
      });
      await order.save();
      console.log(`✅ [PayOS] Order ${order._id} set to PENDING (status sync)`);
      statusChanged = true;
    }

    // Sync status: CANCELLED
    if (paymentInfo.status === 'CANCELLED' && order.status === 'AWAITING_PAYMENT') {
      order.status = 'CANCELLED';
      order.history.push({
        action: 'PAYMENT_CANCELLED',
        fromStatus: 'AWAITING_PAYMENT',
        toStatus: 'CANCELLED',
        note: 'Thanh toán bị hủy (synced via API)',
      });
      await order.save();
      console.log(`❌ [PayOS] Order ${order._id} cancelled (status sync)`);
      statusChanged = true;
    }

    return {
      orderId: order._id,
      status: order.status,
      synced: true,
      statusChanged,
      paymentInfo: {
        amount: paymentInfo.amount,
        status: paymentInfo.status,
        transactions: paymentInfo.transactions,
      },
    };
  } catch (error) {
    console.error(`❌ [PayOS] Sync error:`, error.message);
    return {
      orderId: order._id,
      status: order.status,
      synced: false,
      reason: 'PAYOS_API_ERROR',
      error: error.message,
    };
  }
};

/**
 * Hủy link thanh toán PayOS qua API
 * Khi gọi API này, PayOS SẼ GỬI WEBHOOK với status cancelled
 */
export const cancelPayOSPayment = async (orderCode, cancellationReason = 'Khách hàng hủy đơn') => {
  try {
    console.log(`\n🔄 [PayOS] Cancelling payment link...`);
    console.log(`   Order Code: ${orderCode}`);
    console.log(`   Reason: ${cancellationReason}`);

    // SDK method: payos.paymentRequests.cancel(orderCode, cancellationReason)
    const result = await payos.paymentRequests.cancel(orderCode, cancellationReason);

    console.log(`✅ [PayOS] Payment link cancelled successfully!`);
    console.log(`   Note: Webhook will be sent by PayOS with cancelled status\n`);

    return result;
  } catch (error) {
    console.error(`❌ [PayOS] Cancel payment error - OrderCode: ${orderCode}:`, error.message);

    // Nếu payment đã được xử lý rồi thì không cancel được
    if (error.message.includes('already')) {
      console.warn(`⚠️  [PayOS] Payment already processed, cannot cancel\n`);
      return null;
    }

    throw new Error(`Không thể hủy link thanh toán: ${error.message}`);
  }
};
