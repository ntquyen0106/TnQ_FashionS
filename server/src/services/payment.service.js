import payos from '../config/payos.js';
import crypto from 'crypto';

/**
 * Tạo link thanh toán PayOS bằng SDK
 * @param {Object} params
 * @param {string} params.orderId - ID đơn hàng
 * @param {number} params.amount - Số tiền thanh toán
 * @param {string} params.description - Mô tả đơn hàng
 * @param {string} params.returnUrl - URL redirect sau khi thanh toán
 * @param {string} params.cancelUrl - URL redirect khi hủy
 * @returns {Promise<Object>} Thông tin link thanh toán
 */
export const createPayOSPayment = async ({ orderId, amount, description, returnUrl, cancelUrl }) => {
  try {
    const orderCode = Number(Date.now().toString().slice(-9));
    
    const paymentData = {
      orderCode: orderCode,
      amount: amount,
      description: description || `${orderCode}`,
      returnUrl: returnUrl || `${process.env.CLIENT_URL}/order-success?orderId=${orderId}`,
      cancelUrl: cancelUrl || `${process.env.CLIENT_URL}/checkout?cancelled=true`,
      items: [
        {
          name: `DH ${orderId.slice(-8)}`,
          quantity: 1,
          price: amount,
        },
      ],
    };

    const paymentLinkResponse = await payos.paymentRequests.create(paymentData);
    
    return {
      checkoutUrl: paymentLinkResponse.checkoutUrl,
      qrCode: paymentLinkResponse.qrCode,
      orderCode: orderCode,
      paymentLinkId: paymentLinkResponse.paymentLinkId,
    };
  } catch (error) {
    console.error('PayOS payment error:', error.message);
    throw new Error(`Không thể tạo link thanh toán: ${error.message}`);
  }
};

/**
 * Verify webhook signature từ PayOS
 * @param {Object} webhookData - Data từ webhook
 * @returns {boolean} Valid hay không
 */
export const verifyPayOSWebhook = (webhookData) => {
  try {
    const { signature, ...data } = webhookData;
    
    // Tạo signature từ data
    const sortedData = Object.keys(data)
      .sort()
      .reduce((result, key) => {
        result[key] = data[key];
        return result;
      }, {});
    
    const dataStr = JSON.stringify(sortedData);
    const expectedSignature = crypto
      .createHmac('sha256', process.env.PAYOS_CHECKSUM_KEY)
      .update(dataStr)
      .digest('hex');
    
    return signature === expectedSignature;
  } catch (error) {
    console.error('Webhook verification error:', error.message);
    return false;
  }
};

/**
 * Lấy thông tin thanh toán từ PayOS
 * @param {number} orderCode - Mã đơn hàng PayOS
 * @returns {Promise<Object>} Thông tin thanh toán
 */
export const getPayOSPaymentInfo = async (orderCode) => {
  try {
    const paymentInfo = await payos.paymentRequests.get(orderCode);
    return paymentInfo;
  } catch (error) {
    console.error('Get PayOS payment info error:', error);
    throw new Error(`Không thể lấy thông tin thanh toán: ${error.message}`);
  }
};

/**
 * Hủy link thanh toán PayOS
 * @param {number} orderCode - Mã đơn hàng PayOS
 * @param {string} cancellationReason - Lý do hủy
 * @returns {Promise<Object>} Kết quả hủy
 */
export const cancelPayOSPayment = async (orderCode, cancellationReason = 'Khách hàng hủy đơn') => {
  try {
    const result = await payos.paymentRequests.cancel(orderCode, cancellationReason);
    return result;
  } catch (error) {
    console.error('Cancel PayOS payment error:', error);
    throw new Error(`Không thể hủy link thanh toán: ${error.message}`);
  }
};
