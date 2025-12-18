import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import Promotion from '../models/Promotion.js';
import Order from '../models/Order.js';

const STALE_SOFT_HOURS = 10 / 3600; // 5 giây
const STALE_HARD_HOURS = 40 / 3600; // 10 giây

const pickPrimaryPublicId = (images = []) => {
  const primary = images.find((im) => im?.isPrimary === true);
  if (primary?.publicId) return primary.publicId;
  const first = images[0];
  return typeof first === 'string' ? first : first?.publicId || '';
};

export const getCart = async ({
  userId,
  sessionId,
  allowFallback = false,
  mergeFallback = false,
}) => {
  const findCart = (query) =>
    Cart.findOne({ ...query, status: 'active' })
      .populate('items.productId', 'name slug images variants categoryId ratingAvg')
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
          // Merge guest cart vào user cart
          guestCart.items.forEach((g) => {
            const i = userCart.items.findIndex(
              (u) => String(u.productId) === String(g.productId) && u.variantSku === g.variantSku,
            );
            if (i >= 0) userCart.items[i].qty += g.qty;
            else userCart.items.push(g.toObject());
          });
          await userCart.save();
          //  XÓA guest cart sau khi merge để tránh merge lại
          await Cart.deleteOne({ _id: guestCart._id });
          cart = await findCart({ userId });
        } else {
          // Chưa có user cart, chuyển guest cart thành user cart
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

  const baseResponse = {
    items: [],
    subtotal: 0,
    discount: 0,
    total: 0,
    promotion: null,
    staleInfo: {
      hasStale: false,
      total: 0,
      items: [],
      thresholds: { warn: STALE_SOFT_HOURS, urgent: STALE_HARD_HOURS },
    },
  };

  if (!cart) {
    return baseResponse;
  }

  const now = Date.now();
  const staleItems = [];

  const items = cart.items.map((it) => {
    const p = it.productId;
    
    // ✅ LẤY THÔNG TIN MỚI NHẤT TỪ PRODUCT (không dùng snapshot)
    const name = p?.name || it.nameSnapshot || '';

    const imageSnapshot =
      p?.images?.find((im) => im.isPrimary)?.publicId ||
      p?.images?.[0]?.publicId ||
      (typeof it.imageSnapshot === 'string' && it.imageSnapshot) ||
      '';

    const variantFromSku = Array.isArray(p?.variants)
      ? p.variants.find((v) => v.sku === it.variantSku)
      : null;

    const color = it.color ?? variantFromSku?.color ?? null;
    const size = it.size ?? variantFromSku?.size ?? null;
    const variantName = it.variantName || [color, size].filter(Boolean).join(' / ');

    // Kiểm tra tồn kho
    const currentStock = variantFromSku?.stock ?? 0;
    const isOutOfStock = currentStock <= 0;
    const isInsufficientStock = !isOutOfStock && currentStock < it.qty;

    const touchedAt = it.touchedAt || it.addedAt || cart.updatedAt || cart.createdAt;
    const touchedMs = touchedAt ? new Date(touchedAt).getTime() : null;
    const staleHours = touchedMs ? (now - touchedMs) / (1000 * 60 * 60) : 0;
    const staleLevel =
      staleHours >= STALE_HARD_HOURS ? 'urgent' : staleHours >= STALE_SOFT_HOURS ? 'warn' : null;

    if (staleLevel) {
      staleItems.push({
        itemId: it._id,
        productId: p?._id || it.productId,
        name,
        variant: variantName,
        hours: Number(staleHours.toFixed(1)),
        level: staleLevel,
      });
    }

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

    // ✅ LẤY GIÁ MỚI NHẤT TỪ VARIANT (không dùng priceSnapshot)
    const currentPrice = Number(variantFromSku?.price ?? it.priceSnapshot ?? 0);
    
    return {
      _id: it._id,
      productId: p?._id || it.productId,
      slug: p?.slug || it.slugSnapshot || null,
      name,
      imageSnapshot,
      price: currentPrice, // ✅ Giá realtime từ product
      quantity: Number(it.qty) || 1,
      variantSku: it.variantSku,
      variantName,
      color,
      size,
      variantOptions,
      lastTouchedAt: touchedAt,
      staleHours: Number(staleHours.toFixed(1)),
      staleLevel,
      // Thông tin tồn kho
      currentStock,
      isOutOfStock,
      isInsufficientStock,
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
    staleInfo: {
      hasStale: staleItems.length > 0,
      total: staleItems.length,
      items: staleItems,
      thresholds: { warn: STALE_SOFT_HOURS, urgent: STALE_HARD_HOURS },
    },
  };
};

export const updateQty = async ({ userId, sessionId, cartItemId, qty }) => {
  if (!qty || qty < 1) throw new Error('Số lượng không hợp lệ');
  const q = userId ? { userId, status: 'active' } : { sessionId, status: 'active' };
  const cart = await Cart.findOne(q);
  if (!cart) throw new Error('Không tìm thấy giỏ hàng');
  const it = cart.items.id(cartItemId);
  if (!it) throw new Error('Không tìm thấy sản phẩm trong giỏ hàng');
  it.qty = qty;
  it.touchedAt = new Date();
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
  if (!v) throw new Error('Không tìm thấy biến thể sản phẩm');

  it.variantSku = v.sku;
  it.priceSnapshot = v.price;
  it.variantName = [v.color, v.size].filter(Boolean).join(' / ');
  it.color = v.color || null;
  it.size = v.size || null;
  it.imageSnapshot = v.imagePublicId || it.imageSnapshot;
  it.touchedAt = new Date();
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

  const imageSnapshot = variant?.imagePublicId || pickPrimaryPublicId(product.images);

  const variantName = [variant?.color, variant?.size].filter(Boolean).join(' / ');

  // ✅ Kiểm tra nếu sản phẩm này + biến thể đã có trong giỏ
  const idx = cart.items.findIndex(
    (i) => i.productId.toString() === productId && i.variantSku === variantSku,
  );

  if (idx >= 0) {
    cart.items[idx].qty += qty;
    cart.items[idx].touchedAt = new Date();
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
      addedAt: new Date(),
      touchedAt: new Date(),
    });
  }

  await cart.save();

  const normalized = await getCart({ userId, sessionId });
  return { message: 'Thêm vào giỏ thành công', cart: normalized };
};

export const getCartTotal = async ({ userId, sessionId, selectedItems }) => {
  let cart;
  if (userId) {
    cart = await Cart.findOne({ userId, status: 'active' })
      .populate('items.productId', 'name variants') // ✅ Populate product để lấy giá realtime
      .populate('promotion');
  } else if (sessionId) {
    cart = await Cart.findOne({ sessionId, status: 'active' })
      .populate('items.productId', 'name variants')
      .populate('promotion');
  }

  if (!cart) return { items: [], subtotal: 0, discount: 0, total: 0, promotion: null };

  let items = cart.items;
  
  // ✅ CHỈ filter nếu selectedItems là array có phần tử
  if (Array.isArray(selectedItems) && selectedItems.length > 0) {
    items = cart.items.filter((item) => {
      // item.productId là populated object sau khi .populate(), cần lấy _id
      const itemProductId = String(item.productId?._id || item.productId);
      return selectedItems.some(
        (sel) =>
          itemProductId === String(sel.productId) && item.variantSku === sel.variantSku,
      );
    });
  }

  // ✅ Chuẩn hóa với giá REALTIME từ product
  const normalized = items.map((it) => {
    const p = it.productId;
    const variantFromSku = Array.isArray(p?.variants)
      ? p.variants.find((v) => v.sku === it.variantSku)
      : null;
    
    // ✅ Lấy giá mới nhất từ variant, fallback về snapshot
    const currentPrice = Number(variantFromSku?.price ?? it.priceSnapshot ?? 0);
    
    return {
      _id: it._id,
      productId: it.productId,
      price: currentPrice, // ✅ Giá realtime
      quantity: Number(it.qty) || 1,
      variantSku: it.variantSku,
      name: p?.name || it.nameSnapshot || '',
      imageSnapshot: it.imageSnapshot || '',
      variantName: it.variantName || '',
      color: it.color ?? null,
      size: it.size ?? null,
    };
  });

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
  if (!cart) throw new Error('Không tìm thấy giỏ hàng');

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
 *  Chú ý: Nếu getCart() đã merge với mergeFallback=true,
 * thì guest cart đã bị xóa rồi, không cần gọi lại hàm này
 */
export const mergeGuestCartToUser = async ({ userId, sessionId }) => {
  if (!userId || !sessionId) return;

  const guestCart = await Cart.findOne({ sessionId, status: 'active' });
  //  Nếu không tìm thấy guest cart (đã được merge trước đó), return luôn
  if (!guestCart) {
    console.log('Guest cart not found or already merged');
    return;
  }

  let userCart = await Cart.findOne({ userId, status: 'active' });
  if (!userCart) {
    // Chưa có user cart, chuyển guest cart thành user cart
    guestCart.userId = userId;
    guestCart.sessionId = null;
    await guestCart.save();
    return guestCart;
  }

  // Merge items từ guest cart vào user cart
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
  //  Xóa guest cart sau khi merge
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
  if (!cart) throw new Error('Không tìm thấy giỏ hàng');
  const it = cart.items.id(cartItemId);
  if (!it) throw new Error('Không tìm thấy sản phẩm trong giỏ hàng');
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
  if (!cart) throw new Error('Không tìm thấy giỏ hàng');
  if (!Array.isArray(ids) || ids.length === 0) return await getCart({ userId, sessionId });
  cart.items = cart.items.filter((it) => !ids.some((id) => String(it._id) === String(id)));
  await cart.save();
  return await getCart({ userId, sessionId });
};

export const clearPromotion = async ({ userId, sessionId }) => {
  let cart = null;
  if (userId) cart = await Cart.findOne({ userId, status: 'active' });
  else if (sessionId) cart = await Cart.findOne({ sessionId, status: 'active' });
  if (!cart) throw new Error('Không tìm thấy giỏ hàng');
  cart.promotion = null;
  await cart.save();
  return await getCart({ userId, sessionId });
};

const sanitizeProduct = (product) => ({
  _id: product._id,
  name: product.name,
  slug: product.slug,
  images: product.images,
  variants: product.variants,
  ratingAvg: product.ratingAvg,
});

const collectCartContext = async ({ userId, sessionId }) => {
  const query = userId ? { userId, status: 'active' } : { sessionId, status: 'active' };
  if (!query.userId && !query.sessionId) return null;
  return Cart.findOne(query)
    .populate('items.productId', 'categoryId name slug images variants ratingAvg status')
    .exec();
};

const enrichFromOrderHistory = async ({ userId }) => {
  if (!userId) return { categories: new Set(), products: [] };
  const recent = await Order.findOne({ userId })
    .sort({ createdAt: -1 })
    .populate('items.productId', 'categoryId name slug images variants ratingAvg status')
    .lean();
  if (!recent) return { categories: new Set(), products: [] };

  const categories = new Set();
  const products = [];
  recent.items.forEach((item) => {
    if (item.productId?._id) {
      products.push(item.productId._id.toString());
      if (item.productId.categoryId) categories.add(item.productId.categoryId.toString());
    }
  });
  return { categories, products };
};

export const getRecommendations = async ({
  userId,
  sessionId,
  limit = 6,
  requireContext = false,
}) => {
  const categoryIds = new Set();
  const excludeIds = new Set();

  const cart = await collectCartContext({ userId, sessionId });
  const hasCartContext = Array.isArray(cart?.items) && cart.items.length > 0;
  if (hasCartContext) {
    cart.items.forEach((it) => {
      const prod = it.productId;
      if (!prod) return;
      excludeIds.add(prod._id.toString());
      if (prod.categoryId) categoryIds.add(prod.categoryId.toString());
    });
  }

  let hasOrderContext = false;
  if (userId) {
    const orderContext = await enrichFromOrderHistory({ userId });
    if (orderContext.categories.size > 0 || orderContext.products.length > 0) {
      hasOrderContext = true;
      orderContext.categories.forEach((id) => categoryIds.add(id));
      orderContext.products.forEach((id) => excludeIds.add(id));
    }
  }

  const hasContext = hasCartContext || hasOrderContext;
  if (requireContext && !hasContext) {
    return [];
  }

  const filters = { status: 'active' };
  if (categoryIds.size > 0) filters.categoryId = { $in: Array.from(categoryIds) };

  const query = Product.find(filters)
    .where('_id')
    .nin(Array.from(excludeIds))
    .sort({ ratingAvg: -1, createdAt: -1 })
    .limit(limit)
    .select('name slug images variants ratingAvg');

  let products = await query.lean();

  if (products.length < limit) {
    const needed = limit - products.length;
    const fallback = await Product.find({
      status: 'active',
      _id: { $nin: Array.from(excludeIds) },
    })
      .sort({ createdAt: -1 })
      .limit(needed)
      .select('name slug images variants ratingAvg')
      .lean();
    products = products.concat(fallback);
  }

  return products.map(sanitizeProduct);
};
