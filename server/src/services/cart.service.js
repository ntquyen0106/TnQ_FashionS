import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import Promotion from '../models/Promotion.js';

export const addToCart = async ({ userId, sessionId, productId, variantSku, qty }) => {
  // 1. Validate input
  if (!productId || !variantSku || !qty) {
    throw new Error('Vui lòng cung cấp đầy đủ thông tin');
  }
  if (qty <= 0) {
    throw new Error('Số lượng phải lớn hơn 0');
  }

  // 2. Kiểm tra sản phẩm tồn tại
  const product = await Product.findById(productId).select('name price images variants');
  if (!product) throw new Error('Sản phẩm không tồn tại');

  // 3. Kiểm tra và lấy giá biến thể
  let priceSnapshot = product.price;
  let variant = null;
  if (product.variants && Array.isArray(product.variants)) {
    variant = product.variants.find(v => v.sku === variantSku);
    if (variant) {
      if (variant.stock < qty) {
        throw new Error('Không đủ hàng trong kho');
      }
      priceSnapshot = variant.price;
    }
  }

  // 4. Tìm hoặc tạo cart
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

  // 5. Thêm/cập nhật item trong cart
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
      nameSnapshot: product.name,
      imageSnapshot: product.images?.[0] || ''
    });
  }

  // 6. Lưu và trả về kết quả
  await cart.save();
  return {
    message: 'Thêm vào giỏ thành công',
    cart: await Cart.findById(cart._id)
      .populate('items.productId', 'name images')
  };
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
  if (!cart) throw new Error('Giỏ hàng không tồn tại');

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