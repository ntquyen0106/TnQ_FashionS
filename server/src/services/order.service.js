import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import { getCartTotal } from './cart.service.js';
// import các SDK/payment service thực tế nếu cần

export const checkout = async ({ userId, sessionId, addressId, paymentMethod }) => {
  let cart;
  if (userId) {
    cart = await Cart.findOne({ userId, status: 'active' });
  } else if (sessionId) {
    cart = await Cart.findOne({ sessionId, status: 'active' });
  }
  if (!cart || cart.items.length === 0) throw new Error('Cart is empty');

  // Lấy tổng tiền từ cart service
  const { subtotal, discount, total, promotion, items } = await getCartTotal({ userId, sessionId });

  // Xác định trạng thái đơn hàng ban đầu
  let status = 'pending';
  if (['momo', 'zalopay', 'vnpay'].includes(paymentMethod)) {
    status = 'waiting_payment';
  }

  // Tạo order
  const order = await Order.create({
    userId: userId || null,
    sessionId: sessionId || null,
    items,
    addressId,
    promotion: promotion?._id,
    subtotal,
    discount,
    total,
    paymentMethod,
    status
  });

  // Đánh dấu cart đã đặt hàng
  cart.status = 'ordered';
  await cart.save();

  // Tạo đơn GHN test (giả lập)
  const ghnResult = await createGHNOrderTest(order);

  // Nếu là thanh toán online, tạo link thanh toán thật ở đây
  let paymentUrl = null;
  if (paymentMethod === 'momo') {
    paymentUrl = await createMomoPayment(order);
  } else if (paymentMethod === 'zalopay') {
    paymentUrl = await createZaloPayPayment(order);
  } else if (paymentMethod === 'vnpay') {
    paymentUrl = await createVNPayPayment(order);
  }

  return {
    order,
    ghn: ghnResult,
    paymentUrl
  };
};

// Hàm giả lập tạo đơn GHN (test mode)
async function createGHNOrderTest(order) {
  return {
    success: true,
    message: 'GHN test order created',
    ghnOrderCode: 'GHNTEST' + order._id.toString().slice(-6)
  };
}

// Các hàm dưới đây bạn cần tích hợp SDK/payment gateway thực tế
async function createMomoPayment(order) {
  // Tích hợp SDK hoặc gọi API Momo thực tế ở đây
  // Trả về paymentUrl thực tế từ Momo
  return 'https://momo.vn/real-payment-url?orderId=' + order._id;
}
async function createZaloPayPayment(order) {
  // Tích hợp SDK hoặc gọi API ZaloPay thực tế ở đây
  return 'https://zalopay.vn/real-payment-url?orderId=' + order._id;
}
async function createVNPayPayment(order) {
  // Tích hợp SDK hoặc gọi API VNPay thực tế ở đây
  return 'https://vnpay.vn/real-payment-url?orderId=' + order._id;
}