import Order from '../models/Order.js';
import { cancelPayOSPayment } from './payment.service.js';
import { releaseInventoryForOrder } from './inventory.service.js';

/**
 * Tự động hủy các đơn hàng AWAITING_PAYMENT quá 24h
 * Chạy mỗi 1 giờ
 */
export const cancelExpiredOrders = async () => {
  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    console.log(`\n⏰ [Order Scheduler] Checking for expired orders...`);
    console.log(`   Current time: ${now.toLocaleString('vi-VN')}`);
    console.log(`   Cutoff time: ${twentyFourHoursAgo.toLocaleString('vi-VN')}`);

    // Tìm các đơn hàng AWAITING_PAYMENT tạo từ 24h trước
    const expiredOrders = await Order.find({
      status: 'AWAITING_PAYMENT',
      createdAt: { $lt: twentyFourHoursAgo },
    });

    if (expiredOrders.length === 0) {
      console.log(`✅ [Order Scheduler] No expired orders found\n`);
      return { cancelled: 0 };
    }

    console.log(`🔍 [Order Scheduler] Found ${expiredOrders.length} expired orders`);

    let cancelledCount = 0;
    let failedCount = 0;

    for (const order of expiredOrders) {
      try {
        console.log(`\n🚫 [Order Scheduler] Cancelling expired order: ${order._id}`);
        console.log(`   Created at: ${order.createdAt.toLocaleString('vi-VN')}`);
        console.log(`   Payment Order Code: ${order.paymentOrderCode || 'N/A'}`);

        // Hủy link thanh toán trên PayOS nếu có
        if (order.paymentOrderCode) {
          try {
            await cancelPayOSPayment(order.paymentOrderCode, 'Đơn hàng quá hạn thanh toán (24h)');
            console.log(`   ✅ PayOS link cancelled`);
          } catch (error) {
            console.warn(`   ⚠️  Failed to cancel PayOS link: ${error.message}`);
            // Vẫn tiếp tục hủy order trong DB
          }
        }

        // Trả lại tồn kho
        console.log(`   🔄 Releasing inventory...`);
        try {
          await releaseInventoryForOrder(order);
        } catch (err) {
          console.error(`   ⚠️  Failed to release inventory: ${err.message}`);
          // Vẫn tiếp tục cancel order
        }

        // Cập nhật status trong DB
        order.status = 'CANCELLED';
        order.history.push({
          action: 'AUTO_CANCEL',
          fromStatus: 'AWAITING_PAYMENT',
          toStatus: 'CANCELLED',
          note: 'Tự động hủy do quá hạn thanh toán (24 giờ)',
        });
        await order.save();

        console.log(`✅ Order cancelled in DB`);
        cancelledCount++;
      } catch (error) {
        console.error(`   ❌ Failed to cancel order ${order._id}:`, error.message);
        failedCount++;
      }
    }

    console.log(`\n✅ [Order Scheduler] Summary:`);
    console.log(`   Total expired: ${expiredOrders.length}`);
    console.log(`   Successfully cancelled: ${cancelledCount}`);
    console.log(`   Failed: ${failedCount}\n`);

    return {
      total: expiredOrders.length,
      cancelled: cancelledCount,
      failed: failedCount,
    };
  } catch (error) {
    console.error('💥 [Order Scheduler] Error:', error);
    throw error;
  }
};

/**
 * Khởi động scheduler
 * Chạy mỗi 1 giờ để check và hủy đơn hàng quá hạn
 */
export const startOrderScheduler = () => {
  console.log('🚀 [Order Scheduler] Started - Running every 1 hour');
  
  // Chạy ngay lần đầu
  cancelExpiredOrders().catch((err) =>
    console.error('[Order Scheduler] Initial run failed:', err)
  );

  // Chạy mỗi 1 giờ (3600000ms)
  setInterval(() => {
    cancelExpiredOrders().catch((err) =>
      console.error('[Order Scheduler] Scheduled run failed:', err)
    );
  }, 60 * 60 * 1000); // 1 hour
};
