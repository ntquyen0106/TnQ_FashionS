import Product from '../models/Product.js';

/**
 * Gộp các items theo productId + variantSku để tránh xử lý trùng
 */
const groupItemsBySku = (items = []) => {
  const map = new Map();
  for (const it of items) {
    const key = `${String(it.productId)}__${String(it.variantSku)}`;
    const qty = Number(it.qty || 0);
    if (!qty) continue;
    const existing = map.get(key) || { productId: it.productId, variantSku: it.variantSku, qty: 0 };
    existing.qty += qty;
    map.set(key, existing);
  }
  return Array.from(map.values());
};

/**
 * Trừ tồn kho (reserve) cho order items
 * - Kiểm tra đủ hàng trước khi trừ
 * - Nếu fail thì rollback các items đã trừ trước đó
 * - Sử dụng atomic $inc để tránh race condition
 */
export const reserveOrderItems = async (orderItems = []) => {
  const grouped = groupItemsBySku(orderItems);
  const reserved = [];

  console.log(`\n📦 [Inventory] Reserving stock for ${grouped.length} unique SKUs...`);

  try {
    for (const g of grouped) {
      const qty = Number(g.qty || 0);
      if (qty <= 0) continue;

      console.log(`   Attempting to reserve: ${g.variantSku} x${qty}`);

      // Atomic update: chỉ trừ nếu stock >= qty
      const res = await Product.updateOne(
        {
          _id: g.productId,
          'variants.sku': g.variantSku,
          'variants.stock': { $gte: qty },
        },
        { $inc: { 'variants.$.stock': -qty } },
      );

      if (!res || res.modifiedCount !== 1) {
        console.error(`   ❌ Out of stock: ${g.variantSku}`);
        throw new Error(`Sản phẩm ${g.variantSku} không đủ tồn kho`);
      }

      console.log(`   ✅ Reserved: ${g.variantSku} x${qty}`);
      reserved.push(g);
    }

    console.log(`✅ [Inventory] Successfully reserved ${reserved.length} SKUs\n`);
    return { ok: true, reserved: reserved.length };
  } catch (err) {
    // Rollback: trả lại các items đã reserve thành công
    console.error(`❌ [Inventory] Reservation failed, rolling back ${reserved.length} SKUs...`);
    for (const r of reserved) {
      await Product.updateOne(
        { _id: r.productId, 'variants.sku': r.variantSku },
        { $inc: { 'variants.$.stock': r.qty } },
      );
      console.log(`   ↩️  Rolled back: ${r.variantSku} x${r.qty}`);
    }
    console.log(`💥 [Inventory] Rollback complete\n`);

    const error = new Error(err?.message || 'Không đủ tồn kho');
    error.code = 'OUT_OF_STOCK';
    error.sku = err?.sku || (grouped[0] ? grouped[0].variantSku : 'unknown');
    throw error;
  }
};

/**
 * Trả lại tồn kho (release) cho order items
 * - Dùng khi hủy đơn, thanh toán thất bại, hoặc đơn hết hạn
 */
export const releaseOrderItems = async (orderItems = []) => {
  const grouped = groupItemsBySku(orderItems);
  
  console.log(`\n📦 [Inventory] Releasing stock for ${grouped.length} unique SKUs...`);
  
  for (const g of grouped) {
    const qty = Number(g.qty || 0);
    if (qty <= 0) continue;

    await Product.updateOne(
      { _id: g.productId, 'variants.sku': g.variantSku },
      { $inc: { 'variants.$.stock': qty } },
    );
    
    console.log(`   ✅ Released: ${g.variantSku} x${qty}`);
  }
  
  console.log(`✅ [Inventory] Successfully released ${grouped.length} SKUs\n`);
  return { ok: true, released: grouped.length };
};

/**
 * Trả lại tồn kho cho 1 order (kiểm tra trạng thái reserved/released)
 * - Chỉ release nếu order đã reserve và chưa release
 * - Đảm bảo idempotency (không trả lại 2 lần)
 */
export const releaseInventoryForOrder = async (order) => {
  if (!order || !order.items || !order.items.length) {
    console.log(`⚠️  [Inventory] Order has no items, skipping release`);
    return { ok: true, skipped: true, reason: 'NO_ITEMS' };
  }

  const inv = order.inventory || {};
  
  if (!inv.reserved) {
    console.log(`⚠️  [Inventory] Order ${order._id} was never reserved, skipping release`);
    return { ok: true, skipped: true, reason: 'NOT_RESERVED' };
  }

  if (inv.released) {
    console.log(`⚠️  [Inventory] Order ${order._id} already released, skipping release`);
    return { ok: true, skipped: true, reason: 'ALREADY_RELEASED' };
  }

  console.log(`\n📦 [Inventory] Releasing inventory for order ${order._id}...`);
  
  await releaseOrderItems(order.items);

  order.inventory.released = true;
  order.inventory.releasedAt = new Date();
  await order.save();

  console.log(`✅ [Inventory] Order ${order._id} inventory released\n`);
  return { ok: true };
};
