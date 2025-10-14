import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import Promotion from '../models/Promotion.js';

export const getCart = async ({
  userId,
  sessionId,
  allowFallback = false,
  mergeFallback = false,
}) => {
  const pickPrimaryPublicId = (images = []) => {
    const primary = images.find((im) => im?.isPrimary === true);
    if (primary?.publicId) return primary.publicId;
    const first = images[0];
    return typeof first === 'string' ? first : first?.publicId || '';
  };

  const findCart = (query) =>
    Cart.findOne({ ...query, status: 'active' })
      .populate('items.productId', 'name slug images variants')
      .populate('promotion')
      .exec();

  let cart = null;

  if (userId) {
    cart = await findCart({ userId });
    if (!cart && allowFallback && sessionId) {
      const guestCart = await findCart({ sessionId });
      if (guestCart && mergeFallback) {
        const userCart = await findCart({ userId });
        if (userCart) {
          guestCart.items.forEach((g) => {
            const i = userCart.items.findIndex(
              (u) => String(u.productId) === String(g.productId) && u.variantSku === g.variantSku,
            );
            if (i >= 0) userCart.items[i].qty += g.qty;
            else userCart.items.push(g.toObject());
          });
          await userCart.save();
          await Cart.deleteOne({ _id: guestCart._id });
          cart = await findCart({ userId });
        } else {
          guestCart.userId = userId;
          guestCart.sessionId = null;
          await guestCart.save();
          cart = guestCart;
        }
      } else if (guestCart) cart = guestCart;
    }
  } else if (sessionId) {
    cart = await findCart({ sessionId });
  }

  if (!cart) {
    return { items: [], subtotal: 0, discount: 0, total: 0, promotion: null };
  }

  const items = cart.items.map((it) => {
    const p = it.productId;
    const name = it.nameSnapshot || p?.name || '';

    const imageSnapshot =
      (typeof it.imageSnapshot === 'string' && it.imageSnapshot) ||
      p?.images?.find((im) => im.isPrimary)?.publicId ||
      p?.images?.[0]?.publicId ||
      '';

    const variantFromSku = Array.isArray(p?.variants)
      ? p.variants.find((v) => v.sku === it.variantSku)
      : null;

    const color = it.color ?? variantFromSku?.color ?? null;
    const size = it.size ?? variantFromSku?.size ?? null;
    const variantName = it.variantName || [color, size].filter(Boolean).join(' / ');

    const variantOptions = Array.isArray(p?.variants)
      ? p.variants.map((v) => ({
          sku: v.sku,
          color: v.color,
          size: v.size,
          price: Number(v.price ?? 0),
          stock: Number(v.stock ?? 0),
          imagePublicId: v.imagePublicId,
        }))
      : [];

    return {
      _id: it._id,
      productId: p?._id || it.productId,
      slug: it.slugSnapshot || p?.slug || null,
      name,
      imageSnapshot,
      price: Number(it.priceSnapshot) || 0,
      quantity: Number(it.qty) || 1,
      variantSku: it.variantSku,
      variantName,
      color,
      size,
      variantOptions,
    };
  });

  const subtotal = items.reduce((s, it) => s + it.price * it.quantity, 0);
  let discount = 0;
  if (cart.promotion) {
    // Chỉ áp dụng nếu đạt điều kiện minOrder (đồng bộ với getCartTotal)
    const minOrder = Number(cart.promotion.minOrder || 0);
    const eligible = subtotal >= minOrder;
    if (eligible) {
      if (cart.promotion.type === 'percent') discount = subtotal * (cart.promotion.value / 100);
      else if (cart.promotion.type === 'amount') discount = cart.promotion.value;
    } else {
      discount = 0;
    }
  }

  return {
    items,
    subtotal,
    discount,
    total: Math.max(subtotal - discount, 0),
    promotion: cart.promotion || null,
  };
};

export const updateQty = async ({ userId, sessionId, cartItemId, qty }) => {
  if (!qty || qty < 1) throw new Error('Số lượng không hợp lệ');
  const q = userId ? { userId, status: 'active' } : { sessionId, status: 'active' };
  const cart = await Cart.findOne(q);
  if (!cart) throw new Error('Cart not found');
  const it = cart.items.id(cartItemId);
  if (!it) throw new Error('Item not found');
  it.qty = qty;
  await cart.save();
  return await getCart({ userId, sessionId });
};

export const updateVariant = async ({ userId, sessionId, cartItemId, variantSku }) => {
  const q = userId ? { userId, status: 'active' } : { sessionId, status: 'active' };
  const cart = await Cart.findOne(q).populate('items.productId', 'variants images name');
  if (!cart) throw new Error('Cart not found');
  const it = cart.items.id(cartItemId);
  if (!it) throw new Error('Item not found');

  const p = it.productId;
  const v = Array.isArray(p?.variants) ? p.variants.find((x) => x.sku === variantSku) : null;
  if (!v) throw new Error('Variant not found');

  it.variantSku = v.sku;
  it.priceSnapshot = v.price;
  it.variantName = [v.color, v.size].filter(Boolean).join(' / ');
  it.color = v.color || null;
  it.size = v.size || null;
  it.imageSnapshot = v.imagePublicId || it.imageSnapshot;
  await cart.save();

  return await getCart({ userId, sessionId });
};
export const addToCart = async ({ userId, sessionId, productId, variantSku, qty }) => {
  if (!productId || !variantSku || !qty) {
    throw new Error('Vui lòng cung cấp đầy đủ thông tin');
  }
  if (qty <= 0) throw new Error('Số lượng phải lớn hơn 0');

  const product = await Product.findById(productId).select('name slug price images variants');
  if (!product) throw new Error('Sản phẩm không tồn tại');

  // ✅ Lấy giỏ hàng hiện tại (nếu có) hoặc tạo mới
  let cart = null;
  if (userId) {
    cart = await Cart.findOne({ userId, status: 'active' });
    if (!cart) {
      cart = new Cart({ userId, status: 'active', items: [] });
    }
  } else if (sessionId) {
    cart = await Cart.findOne({ sessionId, status: 'active' });
    if (!cart) {
      cart = new Cart({ sessionId, status: 'active', items: [] });
    }
  } else {
    throw new Error('Thiếu userId hoặc sessionId');
  }

  // ✅ Tìm variant tương ứng
  let variant = null;
  let priceSnapshot = product.price;
  if (Array.isArray(product.variants)) {
    variant = product.variants.find((v) => v.sku === variantSku);
    if (variant) {
      if (variant.stock < qty) throw new Error('Không đủ hàng trong kho');
      priceSnapshot = variant.price;
    }
  }

  const pickPrimaryPublicId = (images = []) => {
    const primary = images.find((img) => img?.isPrimary === true);
    if (primary?.publicId) return primary.publicId;
    const first = images[0];
    return typeof first === 'string' ? first : first?.publicId || '';
  };
  const imageSnapshot = variant?.imagePublicId || pickPrimaryPublicId(product.images);

  const variantName = [variant?.color, variant?.size].filter(Boolean).join(' / ');

  // ✅ Kiểm tra nếu sản phẩm này + biến thể đã có trong giỏ
  const idx = cart.items.findIndex(
    (i) => i.productId.toString() === productId && i.variantSku === variantSku,
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
      slugSnapshot: product.slug,
      imageSnapshot,
      variantName,
      color: variant?.color || null,
      size: variant?.size || null,
    });
  }

  await cart.save();

  const normalized = await getCart({ userId, sessionId });
  return { message: 'Thêm vào giỏ thành công', cart: normalized };
};

export const getCartTotal = async ({ userId, sessionId, selectedItems }) => {
  let cart;
  if (userId) {
    cart = await Cart.findOne({ userId, status: 'active' }).populate('promotion');
  } else if (sessionId) {
    cart = await Cart.findOne({ sessionId, status: 'active' }).populate('promotion');
  }
  // Trường hợp chưa có giỏ hàng trong DB: coi như giỏ rỗng, không ném lỗi để tránh spam toast
  if (!cart) return { items: [], subtotal: 0, discount: 0, total: 0, promotion: null };

  let items = cart.items;
  if (Array.isArray(selectedItems) && selectedItems.length > 0) {
    items = cart.items.filter((item) =>
      selectedItems.some(
        (sel) =>
          String(item.productId) === String(sel.productId) && item.variantSku === sel.variantSku,
      ),
    );
  }

  // Chuẩn hóa để client có cùng shape với getCart()
  const normalized = items.map((it) => ({
    _id: it._id,
    productId: it.productId,
    price: Number(it.priceSnapshot) || 0,
    quantity: Number(it.qty) || 1,
    variantSku: it.variantSku,
    name: it.nameSnapshot || '',
    imageSnapshot: it.imageSnapshot || '',
    variantName: it.variantName || '',
    color: it.color ?? null,
    size: it.size ?? null,
  }));

  const subtotal = normalized.reduce((s, it) => s + it.price * it.quantity, 0);

  let discount = 0;
  if (cart.promotion) {
    // Chỉ áp dụng giảm giá nếu đạt điều kiện tối thiểu
    const minOrder = Number(cart.promotion.minOrder || 0);
    const eligible = subtotal >= minOrder;
    if (eligible) {
      if (cart.promotion.type === 'percent') {
        discount = subtotal * (cart.promotion.value / 100);
      } else if (cart.promotion.type === 'amount') {
        discount = cart.promotion.value;
      }
    } else {
      discount = 0;
    }
  }
  const total = Math.max(subtotal - discount, 0);

  return {
    items: normalized,
    subtotal,
    discount,
    total,
    promotion: cart.promotion || null,
  };
};

/**
 * Áp dụng mã khuyến mãi vào giỏ hàng (áp cho lần tính tiền tiếp theo)
 */
export const applyPromotion = async ({ userId, sessionId, code, selectedItems }) => {
  // Chỉ nhận mã đang active và trong thời gian hiệu lực
  const now = new Date();
  const promo = await Promotion.findOne({
    code,
    status: 'active',
    startAt: { $lte: now },
    endAt: { $gte: now },
  });
  if (!promo) throw new Error('Mã khuyến mãi không hợp lệ hoặc đã hết hạn');

  let cart;
  if (userId) {
    cart = await Cart.findOne({ userId, status: 'active' });
  } else if (sessionId) {
    cart = await Cart.findOne({ sessionId, status: 'active' });
  }
  if (!cart) throw new Error('Cart not found');

  // Kiểm tra minOrder trên tổng các sản phẩm được chọn (nếu có),
  // nếu không chọn gì thì kiểm tra toàn bộ giỏ
  const preview = await getCartTotal({ userId, sessionId, selectedItems });
  const subtotal = Number(preview.subtotal) || 0;
  const minOrder = Number(promo.minOrder || 0);
  const eligible = subtotal >= minOrder;

  if (!eligible) {
    throw new Error(`Đơn tối thiểu để áp dụng mã là ${minOrder.toLocaleString()}₫`);
  }

  // Đạt điều kiện: gắn promotion và trả về tổng tiền mới
  cart.promotion = promo._id;
  await cart.save();

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

  guestCart.items.forEach((guestItem) => {
    const idx = userCart.items.findIndex(
      (i) =>
        i.productId.toString() === guestItem.productId.toString() &&
        i.variantSku === guestItem.variantSku,
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

export const removeItem = async ({ userId, sessionId, cartItemId }) => {
  // Ưu tiên giỏ theo userId; nếu không có, fallback sang sessionId
  let cart = null;
  if (userId) {
    cart = await Cart.findOne({ userId, status: 'active' });
  }
  if (!cart && sessionId) {
    cart = await Cart.findOne({ sessionId, status: 'active' });
  }
  if (!cart) throw new Error('Cart not found');
  const it = cart.items.id(cartItemId);
  if (!it) throw new Error('Item not found');
  it.deleteOne();
  await cart.save();
  return await getCart({ userId, sessionId });
};

export const removeMany = async ({ userId, sessionId, ids = [] }) => {
  // Ưu tiên giỏ theo userId; nếu không có, fallback sang sessionId
  let cart = null;
  if (userId) {
    cart = await Cart.findOne({ userId, status: 'active' });
  }
  if (!cart && sessionId) {
    cart = await Cart.findOne({ sessionId, status: 'active' });
  }
  if (!cart) throw new Error('Cart not found');
  if (!Array.isArray(ids) || ids.length === 0) return await getCart({ userId, sessionId });
  cart.items = cart.items.filter((it) => !ids.some((id) => String(it._id) === String(id)));
  await cart.save();
  return await getCart({ userId, sessionId });
};

export const clearPromotion = async ({ userId, sessionId }) => {
  let cart = null;
  if (userId) cart = await Cart.findOne({ userId, status: 'active' });
  else if (sessionId) cart = await Cart.findOne({ sessionId, status: 'active' });
  if (!cart) throw new Error('Cart not found');
  cart.promotion = null;
  await cart.save();
  return await getCart({ userId, sessionId });
};
