import Attendance from '../models/Attendance.js';
import StaffShift from '../models/shifts/StaffShift.js';
import ShiftTemplate from '../models/shifts/ShiftTemplate.js';

const parseTimeToMinutes = (t) => {
  if (!t) return null;
  const [h, m] = String(t).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

const getShiftWindowMinutes = async (shift) => {
  let start = null;
  let end = null;
  if (shift.customStart && shift.customEnd) {
    start = parseTimeToMinutes(shift.customStart);
    end = parseTimeToMinutes(shift.customEnd);
  } else if (shift.shiftTemplate) {
    const tpl = shift.shiftTemplate.startTime
      ? shift.shiftTemplate
      : await ShiftTemplate.findById(shift.shiftTemplate).lean();
    if (tpl) {
      start = parseTimeToMinutes(tpl.startTime);
      end = parseTimeToMinutes(tpl.endTime);
    }
  }
  return { start, end };
};

const minutesOfNow = () => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
};

const dayRange = (d = new Date()) => {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  const e = new Date(s);
  e.setDate(e.getDate() + 1);
  return { s, e };
};

export const myStatus = async (req, res, next) => {
  try {
    const staffId = req.userId;
    const { s, e } = dayRange();
    const shifts = await StaffShift.find({
      staff: staffId,
      date: { $gte: s, $lt: e },
      status: { $in: ['scheduled', 'confirmed', 'swapped'] },
    })
      .populate('shiftTemplate')
      .lean();

    const nowMin = minutesOfNow();
    let currentShift = null;
    for (const sh of shifts) {
      const { start, end } = await getShiftWindowMinutes(sh);
      if (start != null && end != null && nowMin >= start && nowMin <= end) {
        currentShift = { ...sh, _startMin: start, _endMin: end };
        break;
      }
    }

    let attendance = null;
    let checkedIn = false;
    let canCheckIn = false;
    let canCheckOut = false;

    if (currentShift) {
      attendance = await Attendance.findOne({ staff: staffId, shift: currentShift._id });
      // checkedIn only true if checked in and NOT yet checked out
      checkedIn = !!(attendance?.checkInAt && !attendance?.checkOutAt);
      canCheckIn = !checkedIn;
      canCheckOut = !!(attendance?.checkInAt && !attendance?.checkOutAt);
    }

    res.json({
      withinShift: !!currentShift,
      shift: currentShift,
      checkedIn,
      canCheckIn,
      canCheckOut,
    });
  } catch (e) {
    next(e);
  }
};

export const checkIn = async (req, res, next) => {
  try {
    const staffId = req.userId;
    const { s, e } = dayRange();
    const shifts = await StaffShift.find({
      staff: staffId,
      date: { $gte: s, $lt: e },
      status: { $in: ['scheduled', 'confirmed', 'swapped'] },
    })
      .populate('shiftTemplate')
      .lean();

    const nowMin = minutesOfNow();
    let cur = null;
    for (const sh of shifts) {
      const { start, end } = await getShiftWindowMinutes(sh);
      if (start != null && end != null && nowMin >= start && nowMin <= end) {
        cur = sh;
        break;
      }
    }
    if (!cur) return res.status(400).json({ message: 'Chưa tới giờ hoặc không có ca hôm nay' });

    const existing = await Attendance.findOne({ staff: staffId, shift: cur._id });
    if (existing?.checkInAt) return res.status(400).json({ message: 'Đã check-in' });

    const doc = await Attendance.findOneAndUpdate(
      { staff: staffId, shift: cur._id },
      { $setOnInsert: { date: cur.date }, $set: { checkInAt: new Date() } },
      { new: true, upsert: true },
    );
    res.json(doc);
  } catch (e) {
    next(e);
  }
};

export const checkOut = async (req, res, next) => {
  try {
    const staffId = req.userId;
    const { shiftId } = req.body || {};

    const att = await Attendance.findOne({ staff: staffId, shift: shiftId });
    if (!att || !att.checkInAt) return res.status(400).json({ message: 'Chưa check-in' });
    if (att.checkOutAt) return res.status(400).json({ message: 'Đã check-out' });

    const now = new Date();
    const minutes = Math.max(
      0,
      Math.round((now.getTime() - new Date(att.checkInAt).getTime()) / 60000),
    );

    att.checkOutAt = now;
    att.minutes = minutes;
    await att.save();
    res.json(att);
  } catch (e) {
    next(e);
  }
};
