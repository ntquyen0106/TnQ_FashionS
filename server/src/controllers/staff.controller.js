import mongoose from 'mongoose';
import StaffShift from '../models/shifts/StaffShift.js';
import ShiftTemplate from '../models/shifts/ShiftTemplate.js';
import Attendance from '../models/Attendance.js';
import Order from '../models/Order.js';

// Helper: parse HH:mm to minutes
const parseHHMM = (str) => {
  if (!str) return 0;
  const [h, m] = str.split(':').map(Number);
  return h * 60 + m;
};

// Helper: calculate shift duration in minutes
const getShiftMinutes = (shift, template) => {
  const start = shift.customStart || template?.startTime;
  const end = shift.customEnd || template?.endTime;
  if (!start || !end) return 0;
  return parseHHMM(end) - parseHHMM(start);
};

// GET /api/staff/stats/me
export const getMyStats = async (req, res, next) => {
  try {
    const staffId = req.userId;
    const { from, to } = req.query;

    // Default to current month if no range provided
    const now = new Date();
    const startDate = from
      ? new Date(from + 'T00:00:00.000Z')
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = to
      ? new Date(to + 'T23:59:59.999Z')
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // 1. SHIFTS DATA
    const shifts = await StaffShift.find({
      staff: new mongoose.Types.ObjectId(staffId),
      date: { $gte: startDate, $lte: endDate },
      status: { $in: ['scheduled', 'confirmed', 'completed'] },
    })
      .populate('shiftTemplate')
      .lean();

    let scheduledCount = 0;
    let completedCount = 0;
    let scheduledMinutes = 0;
    const shiftsByDate = {};

    shifts.forEach((shift) => {
      scheduledCount++;
      if (shift.status === 'completed') completedCount++;

      const minutes = getShiftMinutes(shift, shift.shiftTemplate);
      scheduledMinutes += minutes;

      const dateKey = shift.date.toISOString().split('T')[0];
      if (!shiftsByDate[dateKey]) {
        shiftsByDate[dateKey] = { scheduledMinutes: 0, workedMinutes: 0 };
      }
      shiftsByDate[dateKey].scheduledMinutes += minutes;
    });

    // 2. ATTENDANCE DATA
    const attendances = await Attendance.find({
      staff: new mongoose.Types.ObjectId(staffId),
      date: { $gte: startDate, $lte: endDate },
    })
      .populate({
        path: 'shift',
        populate: { path: 'shiftTemplate' },
      })
      .lean();

    let workedMinutes = 0;
    let missedCount = 0;
    let lateCheckIns = { count: 0, totalMinutes: 0 };
    let earlyCheckOuts = { count: 0, totalMinutes: 0 };

    attendances.forEach((att) => {
      if (att.checkInAt && att.checkOutAt) {
        workedMinutes += att.minutes || 0;

        const dateKey = att.date.toISOString().split('T')[0];
        if (shiftsByDate[dateKey]) {
          shiftsByDate[dateKey].workedMinutes += att.minutes || 0;
        }

        // Check late/early
        if (att.shift) {
          const template = att.shift.shiftTemplate;
          const shiftStart = att.shift.customStart || template?.startTime;
          const shiftEnd = att.shift.customEnd || template?.endTime;

          if (shiftStart && att.checkInAt) {
            const [sh, sm] = shiftStart.split(':').map(Number);
            const expectedStart = new Date(att.date);
            expectedStart.setHours(sh, sm, 0, 0);
            const diffMs = att.checkInAt - expectedStart;
            const diffMin = Math.floor(diffMs / 60000);
            if (diffMin > 5) {
              lateCheckIns.count++;
              lateCheckIns.totalMinutes += diffMin;
            }
          }

          if (shiftEnd && att.checkOutAt) {
            const [eh, em] = shiftEnd.split(':').map(Number);
            const expectedEnd = new Date(att.date);
            expectedEnd.setHours(eh, em, 0, 0);
            const diffMs = expectedEnd - att.checkOutAt;
            const diffMin = Math.floor(diffMs / 60000);
            if (diffMin > 5) {
              earlyCheckOuts.count++;
              earlyCheckOuts.totalMinutes += diffMin;
            }
          }
        }
      }
    });

    // Missed shifts = scheduled but no attendance or no check-in
    const attendanceShiftIds = new Set(
      attendances.filter((a) => a.checkInAt).map((a) => a.shift?._id?.toString()),
    );
    missedCount = shifts.filter(
      (s) => s.status !== 'cancelled' && !attendanceShiftIds.has(s._id.toString()),
    ).length;

    const overtimeMinutes = Math.max(0, workedMinutes - scheduledMinutes);
    const attendanceRatePct =
      scheduledCount > 0 ? Math.round(((scheduledCount - missedCount) / scheduledCount) * 100) : 0;

    // 3. ORDERS DATA
    const orders = await Order.find({
      assignedStaffId: new mongoose.Types.ObjectId(staffId),
      createdAt: { $gte: startDate, $lte: endDate },
    }).lean();

    let totalOrders = 0;
    let doneOrders = 0;
    let pendingOrders = 0;
    let cancelledOrders = 0;
    let returnedOrders = 0;
    let handledValueTotal = 0;
    let totalHandlingMinutes = 0;
    let handlingCount = 0;
    let totalPrintLatencyMinutes = 0;
    let printCount = 0;
    const ordersByDate = {};

    orders.forEach((order) => {
      totalOrders++;
      const status = String(order.status).toUpperCase();

      if (status === 'DONE') {
        doneOrders++;
        handledValueTotal += order.amounts?.grandTotal || 0;

        // Calculate handling time (assign -> done)
        const assignEvent = order.history?.find((h) => h.action === 'ASSIGN');
        const doneEvent = order.history?.find((h) => h.toStatus === 'DONE');
        if (assignEvent && doneEvent) {
          const diffMs = doneEvent.at - assignEvent.at;
          totalHandlingMinutes += Math.floor(diffMs / 60000);
          handlingCount++;
        }
      } else if (status === 'PENDING') {
        pendingOrders++;
      } else if (status === 'CANCELLED') {
        cancelledOrders++;
      } else if (status === 'RETURNED') {
        returnedOrders++;
      }

      // Print latency
      if (order.printedAt) {
        const assignEvent = order.history?.find((h) => h.action === 'ASSIGN');
        const baseTime = assignEvent?.at || order.createdAt;
        const diffMs = order.printedAt - baseTime;
        totalPrintLatencyMinutes += Math.floor(diffMs / 60000);
        printCount++;
      }

      // Per day
      const dateKey = order.createdAt.toISOString().split('T')[0];
      if (!ordersByDate[dateKey]) {
        ordersByDate[dateKey] = { total: 0, done: 0 };
      }
      ordersByDate[dateKey].total++;
      if (status === 'DONE') ordersByDate[dateKey].done++;
    });

    const completionRatePct = totalOrders > 0 ? Math.round((doneOrders / totalOrders) * 100) : 0;
    const avgOrderValue = doneOrders > 0 ? Math.round(handledValueTotal / doneOrders) : 0;
    const avgHandlingMinutes =
      handlingCount > 0 ? Math.round(totalHandlingMinutes / handlingCount) : 0;
    const avgPrintLatencyMinutes =
      printCount > 0 ? Math.round(totalPrintLatencyMinutes / printCount) : 0;

    // 4. PRODUCTIVITY
    const workedHours = workedMinutes / 60;
    const ordersPerWorkedHour = workedHours > 0 ? (totalOrders / workedHours).toFixed(2) : 0;
    const valuePerWorkedHour = workedHours > 0 ? Math.round(handledValueTotal / workedHours) : 0;

    // 5. PER DAY AGGREGATION
    const perDay = [];
    const allDates = new Set([...Object.keys(shiftsByDate), ...Object.keys(ordersByDate)]);
    allDates.forEach((date) => {
      perDay.push({
        date,
        scheduledMinutes: shiftsByDate[date]?.scheduledMinutes || 0,
        workedMinutes: shiftsByDate[date]?.workedMinutes || 0,
        overtimeMinutes: Math.max(
          0,
          (shiftsByDate[date]?.workedMinutes || 0) - (shiftsByDate[date]?.scheduledMinutes || 0),
        ),
        totalOrders: ordersByDate[date]?.total || 0,
        doneOrders: ordersByDate[date]?.done || 0,
      });
    });
    perDay.sort((a, b) => a.date.localeCompare(b.date));

    // 6. ALERTS
    const alerts = [];
    const dayOvertimeLimit = 12 * 60; // 12 hours in minutes
    if (overtimeMinutes > dayOvertimeLimit) {
      alerts.push({
        type: 'overtime',
        message: `Làm thêm giờ vượt ngưỡng: ${Math.round(overtimeMinutes / 60)}h`,
        severity: 'warning',
      });
    }
    if (attendanceRatePct < 80) {
      alerts.push({
        type: 'attendance',
        message: `Tỷ lệ chấm công thấp: ${attendanceRatePct}%`,
        severity: 'warning',
      });
    }
    if (avgHandlingMinutes > 120) {
      alerts.push({
        type: 'handling_time',
        message: `Thời gian xử lý đơn trung bình cao: ${avgHandlingMinutes} phút`,
        severity: 'info',
      });
    }

    // RESPONSE
    res.json({
      period: {
        from: startDate.toISOString().split('T')[0],
        to: endDate.toISOString().split('T')[0],
      },
      shifts: {
        scheduledCount,
        completedCount,
        scheduledMinutes,
        workedMinutes,
        attendanceRatePct,
        missedCount,
        lateCheckIns: {
          count: lateCheckIns.count,
          totalMinutes: lateCheckIns.totalMinutes,
          avgMinutesLate:
            lateCheckIns.count > 0 ? Math.round(lateCheckIns.totalMinutes / lateCheckIns.count) : 0,
        },
        earlyCheckOuts: {
          count: earlyCheckOuts.count,
          totalMinutes: earlyCheckOuts.totalMinutes,
          avgMinutesEarly:
            earlyCheckOuts.count > 0
              ? Math.round(earlyCheckOuts.totalMinutes / earlyCheckOuts.count)
              : 0,
        },
        overtimeMinutes,
      },
      orders: {
        total: totalOrders,
        done: doneOrders,
        pending: pendingOrders,
        cancelled: cancelledOrders,
        returned: returnedOrders,
        completionRatePct,
        handledValueTotal,
        avgOrderValue,
        avgHandlingMinutes,
        avgPrintLatencyMinutes,
      },
      productivity: {
        ordersPerWorkedHour: Number(ordersPerWorkedHour),
        valuePerWorkedHour,
      },
      perDay,
      alerts,
    });
  } catch (e) {
    next(e);
  }
};
