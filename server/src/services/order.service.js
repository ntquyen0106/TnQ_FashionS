import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import User from '../models/User.js';
import { getCartTotal } from './cart.service.js';
import { computeShippingFee } from '../utils/shipping.js';

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
