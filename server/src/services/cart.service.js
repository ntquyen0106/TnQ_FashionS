import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import Promotion from '../models/Promotion.js';

/**
 * Thêm sản phẩm vào giỏ hàng (user hoặc guest)
 */
export const addToCart = async ({ userId, sessionId, productId, variantSku, qty }) => {
  const product = await Product.findById(productId);
  if (!product) throw new Error('Product not found');

  // Nếu có nhiều biến thể, lấy giá đúng biến thể
  let priceSnapshot = product.price;
  if (product.variants && Array.isArray(product.variants)) {
    const variant = product.variants.find(v => v.sku === variantSku);
    if (variant) priceSnapshot = variant.price;
  }

  const nameSnapshot = product.name;
  const imageSnapshot = product.images?.[0] || '';

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
      priceSnapshot,   // Đảm bảo luôn có giá trị
      nameSnapshot,
      imageSnapshot
    });
  }

  await cart.save();
  return cart;
};

/**
 * Hiển thị thành tiền cho các sản phẩm được chọn trong giỏ
 */
export const getCartTotal = async ({ userId, sessionId, selectedItems }) => {
  let cart;
  if (userId) {
    cart = await Cart.findOne({ userId, status: 'active' }).populate('promotion');
  } else if (sessionId) {
    cart = await Cart.findOne({ sessionId, status: 'active' }).populate('promotion');
  }
  if (!cart) throw new Error('Cart not found');

  let items = cart.items;
  if (Array.isArray(selectedItems) && selectedItems.length > 0) {
    items = cart.items.filter(item =>
      selectedItems.some(
        sel =>
          item.productId.toString() === sel.productId &&
          item.variantSku === sel.variantSku
      )
    );
  }

  let subtotal = 0;
  items.forEach(item => {
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
    items,
    subtotal,
    discount,
    total,
    promotion: cart.promotion || null
  };
};

/**
 * Áp dụng mã khuyến mãi vào giỏ hàng (áp cho lần tính tiền tiếp theo)
 */
export const applyPromotion = async ({ userId, sessionId, code, selectedItems }) => {
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

  // Tính lại tổng tiền cho các sản phẩm được chọn (nếu có)
  return await getCartTotal({ userId, sessionId, selectedItems });
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
    guestCart.userId = userId;
    guestCart.sessionId = null;
    await guestCart.save();
    return guestCart;
  }

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
  await Cart.deleteOne({ _id: guestCart._id });
  return userCart;
};