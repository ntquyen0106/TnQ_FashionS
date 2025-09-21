import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import Promotion from '../models/Promotion.js';

// Áp dụng mã khuyến mãi vào giỏ hàng
export const applyPromotion = async ({ userId, sessionId, code }) => {
  const promo = await Promotion.findOne({ code, status: 'active' });
  if (!promo) throw new Error('Promotion not found or inactive');

  let cart;
  if (userId) {
    cart = await Cart.findOne({ userId, status: 'active' });
  } else if (sessionId) {
    cart = await Cart.findOne({ sessionId, status: 'active' });
  }
  if (!cart) throw new Error('Cart not found');

  cart.promotion = promo._id;
  await cart.save();
  return cart;
};


/**
 * Thêm sản phẩm vào giỏ hàng (user hoặc guest)
 * @param {Object} params - { userId, sessionId, productId, variantSku, qty }
 * @returns {Promise<Cart>}
 */
export const addToCart = async ({ userId, sessionId, productId, variantSku, qty }) => {
  // Lấy thông tin sản phẩm
  const product = await Product.findById(productId);
  if (!product) throw new Error('Product not found');

  // Lấy giá và thông tin snapshot
  const priceSnapshot = product.price;
  const nameSnapshot = product.name;
  const imageSnapshot = product.images?.[0] || '';

  // Tìm cart theo userId hoặc sessionId
  let cart;
  if (userId) {
    cart = await Cart.findOne({ userId, status: 'active' });
    if (!cart) cart = await Cart.create({ userId, items: [] });
  } else if (sessionId) {
    cart = await Cart.findOne({ sessionId, status: 'active' });
    if (!cart) cart = await Cart.create({ sessionId, items: [] });
  } else {
    throw new Error('userId hoặc sessionId là bắt buộc');
  }

  // Kiểm tra sản phẩm đã có trong giỏ chưa (theo productId + variantSku)
  const idx = cart.items.findIndex(
    i => i.productId.toString() === productId && i.variantSku === variantSku
  );
  if (idx >= 0) {
    cart.items[idx].qty += qty;
  } else {
    cart.items.push({
      productId,
      variantSku,
      qty,
      priceSnapshot,
      nameSnapshot,
      imageSnapshot
    });
  }

  await cart.save();
  return cart;
};

/**
 * Hợp nhất cart guest (sessionId) vào cart user (userId)
 */
export const mergeGuestCartToUser = async ({ userId, sessionId }) => {
  if (!userId || !sessionId) return;

  const guestCart = await Cart.findOne({ sessionId, status: 'active' });
  if (!guestCart) return;

  let userCart = await Cart.findOne({ userId, status: 'active' });
  if (!userCart) {
    // Nếu user chưa có cart, chuyển cart guest thành cart user
    guestCart.userId = userId;
    guestCart.sessionId = null;
    await guestCart.save();
    return guestCart;
  }

  // Merge items
  guestCart.items.forEach(guestItem => {
    const idx = userCart.items.findIndex(
      i => i.productId.toString() === guestItem.productId.toString() && i.variantSku === guestItem.variantSku
    );
    if (idx >= 0) {
      userCart.items[idx].qty += guestItem.qty;
    } else {
      userCart.items.push(guestItem);
    }
  });

  await userCart.save();
  // Xóa cart guest
  await Cart.deleteOne({ _id: guestCart._id });
  return userCart;
};

// Tính tổng giỏ hàng
export const getCartTotal = async ({ userId, sessionId }) => {
  let cart;
  if (userId) {
    cart = await Cart.findOne({ userId, status: 'active' }).populate('promotion');
  } else if (sessionId) {
    cart = await Cart.findOne({ sessionId, status: 'active' }).populate('promotion');
  }
  if (!cart) throw new Error('Cart not found');

  let subtotal = 0;
  cart.items.forEach(item => {
    subtotal += item.priceSnapshot * item.qty;
  });

  let discount = 0;
  if (cart.promotion) {
    if (cart.promotion.type === 'percent') {
      discount = subtotal * (cart.promotion.value / 100);
    } else if (cart.promotion.type === 'amount') {
      discount = cart.promotion.value;
    }
  }
  const total = Math.max(subtotal - discount, 0);

  return {
    items: cart.items,
    subtotal,
    discount,
    total,
    promotion: cart.promotion || null
  };
};