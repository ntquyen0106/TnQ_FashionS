import Order from '../models/Order.js';

/**
 * Auto-confirm pending orders older than 12 hours
 * Runs every 30 minutes
 */
export const autoConfirmPendingOrders = async () => {
  try {
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

    const result = await Order.updateMany(
      {
        status: 'PENDING',
        createdAt: { $lt: twelveHoursAgo },
        printedAt: null, // only auto-confirm if not printed yet
      },
      {
        $set: { status: 'CONFIRMED' },
        $push: {
          history: {
            action: 'STATUS_CHANGE',
            fromStatus: 'PENDING',
            toStatus: 'CONFIRMED',
            note: 'Auto-confirmed after 12 hours (not printed)',
          },
        },
      },
    );

    if (result.modifiedCount > 0) {
      console.log(
        `✅ [AutoConfirm] Confirmed ${result.modifiedCount} pending orders older than 12 hours`,
      );
    }
  } catch (err) {
    console.error('❌ [AutoConfirm] Error:', err);
  }
};

export const scheduleAutoConfirmJob = () => {
  // Run every 30 minutes
  const interval = 30 * 60 * 1000;
  setInterval(autoConfirmPendingOrders, interval);
  console.log('✅ [AutoConfirm] Job scheduled (every 30 min)');

  // Run immediately on startup
  autoConfirmPendingOrders();
};
