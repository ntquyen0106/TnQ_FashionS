import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import { getCartTotal } from './cart.service.js';

export const checkout = async ({ userId, sessionId, addressId, paymentMethod, selectedItems }) => {
  let cart;
  if (userId) {
    cart = await Cart.findOne({ userId, status: 'active' });
  } else if (sessionId) {
    cart = await Cart.findOne({ sessionId, status: 'active' });
  }
  if (!cart) throw new Error('Cart not found');

  // Lấy tổng tiền cho các sản phẩm được chọn
  const { subtotal, discount, total, promotion, items } = await getCartTotal({ userId, sessionId, selectedItems });

  if (!items || items.length === 0) throw new Error('No items selected for checkout');

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

  // Xóa các item đã mua khỏi cart
  cart.items = cart.items.filter(
    item => !items.some(
      sel => item.productId.toString() === sel.productId.toString() && item.variantSku === sel.variantSku
    )
  );
  await cart.save();

  // (Tùy chọn: Tích hợp payment gateway, GHN...)

  return order;
};