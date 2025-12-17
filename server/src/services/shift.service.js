import mongoose from 'mongoose';
import { ShiftTemplate, StaffShift, ShiftSwapRequest, User } from '../models/index.js';

const parseTimeToMinutes = (time) => {
  if (!time) return null;
  const [h, m] = String(time).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

const resolveShiftTimes = async (payload) => {
  if (payload.customStart && payload.customEnd) {
    return {
      start: parseTimeToMinutes(payload.customStart),
      end: parseTimeToMinutes(payload.customEnd),
    };
  }
  const templateRef = payload.shiftTemplate || payload.shiftTemplateId;
  if (templateRef) {
    const tpl =
      typeof templateRef === 'object' && templateRef.startTime
        ? templateRef
        : await ShiftTemplate.findById(templateRef).lean();
    if (!tpl) return { start: null, end: null };
    return {
      start: parseTimeToMinutes(tpl.startTime),
      end: parseTimeToMinutes(tpl.endTime),
    };
  }
  return { start: null, end: null };
};

const ensureNoOverlap = async ({ staffId, date, start, end, excludeId }) => {
  if (start == null || end == null) return;
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const query = {
    staff: staffId,
    date: { $gte: dayStart, $lt: dayEnd },
  };
  if (excludeId) query._id = { $ne: excludeId };

  const shifts = await StaffShift.find(query).populate('shiftTemplate', 'startTime endTime').lean();

  for (const shift of shifts) {
    const { start: existStart, end: existEnd } = await resolveShiftTimes({
      shiftTemplate: shift.shiftTemplate,
      customStart: shift.customStart,
      customEnd: shift.customEnd,
    });
    if (existStart == null || existEnd == null) continue;
    if (start < existEnd && end > existStart) {
      throw new Error('Shift overlaps with existing assignment');
    }
  }
};

// Overtime & hours constraints
const MAX_DAILY_MINUTES = 12 * 60; // 12h/ngày
const MAX_YEARLY_MINUTES = 300 * 60; // 300h/năm (giờ làm thêm tổng)

const MINUTES_IN_DAY = 24 * 60;

const computeShiftDuration = ({ start, end }) => {
  if (start == null || end == null) return 0;
  let diff = end - start;
  if (diff <= 0) diff += MINUTES_IN_DAY; // hỗ trợ ca qua ngày (ví dụ 16:00 → 02:00)
  if (diff <= 0 || diff > MINUTES_IN_DAY) return 0;
  return diff;
};

const ensureHourLimits = async ({ staffId, date, start, end, excludeId }) => {
  const duration = computeShiftDuration({ start, end });
  if (!duration) throw new Error('Thời lượng ca không hợp lệ');

  // Day range
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const yearStart = new Date(date);
  yearStart.setUTCMonth(0, 1);
  yearStart.setUTCHours(0, 0, 0, 0);
  const yearEnd = new Date(date);
  yearEnd.setUTCMonth(11, 31);
  yearEnd.setUTCHours(23, 59, 59, 999);

  const baseQuery = { staff: staffId };
  if (excludeId) baseQuery._id = { $ne: excludeId };

  const existingDay = await StaffShift.find({
    ...baseQuery,
    date: { $gte: dayStart, $lt: dayEnd },
    status: { $nin: ['cancelled'] },
  })
    .populate('shiftTemplate', 'startTime endTime')
    .lean();
  let dayTotal = 0;
  for (const s of existingDay) {
    const { start: es, end: ee } = await resolveShiftTimes({
      shiftTemplate: s.shiftTemplate,
      customStart: s.customStart,
      customEnd: s.customEnd,
    });
    dayTotal += computeShiftDuration({ start: es, end: ee });
  }
  if (dayTotal + duration > MAX_DAILY_MINUTES)
    throw new Error('Vượt quá tổng giờ làm tối đa trong ngày (12h)');

  const existingYear = await StaffShift.find({
    ...baseQuery,
    date: { $gte: yearStart, $lte: yearEnd },
    status: { $nin: ['cancelled'] },
  })
    .populate('shiftTemplate', 'startTime endTime')
    .lean();
  let yearTotal = 0;
  for (const s of existingYear) {
    const { start: es, end: ee } = await resolveShiftTimes({
      shiftTemplate: s.shiftTemplate,
      customStart: s.customStart,
      customEnd: s.customEnd,
    });
    yearTotal += computeShiftDuration({ start: es, end: ee });
  }
  if (yearTotal + duration > MAX_YEARLY_MINUTES)
    throw new Error('Vượt quá tổng giờ làm thêm tối đa trong năm (300h)');
};

export const listTemplates = async (query = {}) => {
  const filter = {};
  if (query.active != null) {
    const active = String(query.active).toLowerCase();
    if (['1', 'true'].includes(active)) filter.isActive = true;
    if (['0', 'false'].includes(active)) filter.isActive = false;
  }
  return ShiftTemplate.find(filter).sort({ startTime: 1 }).lean();
};

export const createTemplate = async (payload) => {
  return ShiftTemplate.create(payload);
};

export const updateTemplate = async (id, payload) => {
  const doc = await ShiftTemplate.findByIdAndUpdate(id, payload, { new: true });
  if (!doc) throw new Error('Template not found');
  return doc;
};

export const deleteTemplate = async (id) => {
  const used = await StaffShift.exists({ shiftTemplate: id });
  if (used) throw new Error('Template đang được sử dụng bởi ca làm');
  await ShiftTemplate.findByIdAndDelete(id);
  return { ok: true };
};

export const listShifts = async (query = {}) => {
  const filter = {};
  if (query.staffId) filter.staff = query.staffId;
  if (query.status) filter.status = query.status;
  if (query.templateId) filter.shiftTemplate = query.templateId;
  if (query.templateIds) {
    const ids = Array.isArray(query.templateIds)
      ? query.templateIds
      : String(query.templateIds).split(',');
    filter.shiftTemplate = { $in: ids };
  }
  if (query.from || query.to) {
    filter.date = {};
    if (query.from) filter.date.$gte = new Date(query.from);
    if (query.to) filter.date.$lte = new Date(query.to);
  }
  if (query.staffIds) {
    const ids = Array.isArray(query.staffIds) ? query.staffIds : String(query.staffIds).split(',');
    filter.staff = { $in: ids }; // override
  }

  return StaffShift.find(filter)
    .populate('staff', 'name email role')
    .populate('shiftTemplate')
    .lean();
};

export const createShifts = async (payload = {}, actorId) => {
  const { shifts = [] } = payload;
  if (!Array.isArray(shifts) || !shifts.length) throw new Error('Không có ca làm để tạo');

  const results = [];
  for (const item of shifts) {
    const staffId = item.staffId || item.staff;
    if (!staffId) throw new Error('Thiếu nhân viên cho ca');
    const staff = await User.findById(staffId).select('_id role status').lean();
    if (!staff || staff.status !== 'active') throw new Error('Nhân viên không hợp lệ');

    const { start, end } = await resolveShiftTimes({
      ...item,
      shiftTemplate: item.shiftTemplate || item.shiftTemplateId,
    });
    if (start == null || end == null) throw new Error('Thời gian ca làm không hợp lệ');

    await ensureNoOverlap({ staffId, date: item.date, start, end });
    await ensureHourLimits({ staffId, date: item.date, start, end });
    const doc = await StaffShift.create({
      staff: staffId,
      date: item.date,
      shiftTemplate: item.shiftTemplateId || item.shiftTemplate,
      customStart: item.customStart,
      customEnd: item.customEnd,
      breaks: item.breaks || [],
      notes: item.notes || '',
      createdBy: actorId,
    });
    const hydrated = await StaffShift.findById(doc._id)
      .populate('staff', 'name email role')
      .populate('shiftTemplate')
      .lean();
    results.push(hydrated);
  }
  return results;
};

export const updateShift = async (id, payload = {}, actorId) => {
  const shift = await StaffShift.findById(id);
  if (!shift) throw new Error('Không tìm thấy ca làm');
  // allow changing assigned staff when provided
  if (payload.staffId) {
    const staff = await User.findById(payload.staffId).select('_id role status').lean();
    if (!staff || staff.status !== 'active') throw new Error('Nhân viên không hợp lệ');
  }

  const next = {
    staff: payload.staffId || shift.staff,
    shiftTemplate: payload.shiftTemplateId || payload.shiftTemplate || shift.shiftTemplate,
    customStart: payload.customStart ?? shift.customStart,
    customEnd: payload.customEnd ?? shift.customEnd,
    breaks: payload.breaks ?? shift.breaks,
    status: payload.status ?? shift.status,
    notes: payload.notes ?? shift.notes,
    updatedBy: actorId,
  };
  if (payload.date) next.date = payload.date;

  const { start, end } = await resolveShiftTimes({
    shiftTemplate: next.shiftTemplate,
    customStart: next.customStart,
    customEnd: next.customEnd,
  });
  if (start == null || end == null) throw new Error('Thời gian ca làm không hợp lệ');

  await ensureNoOverlap({
    staffId: payload.staffId || shift.staff,
    date: payload.date || shift.date,
    start,
    end,
    excludeId: id,
  });
  await ensureHourLimits({
    staffId: payload.staffId || shift.staff,
    date: payload.date || shift.date,
    start,
    end,
    excludeId: id,
  });

  Object.assign(shift, next);
  await shift.save();

  // return hydrated shift for consistency with createShifts
  const hydrated = await StaffShift.findById(shift._id)
    .populate('staff', 'name email role')
    .populate('shiftTemplate')
    .lean();
  return hydrated;
};

export const deleteShift = async (id) => {
  await StaffShift.findByIdAndDelete(id);
  return { ok: true };
};

export const getStaffShifts = async (staffId, query = {}) => {
  const filter = { staff: staffId };
  if (query.from || query.to) {
    filter.date = {};
    if (query.from) filter.date.$gte = new Date(query.from);
    if (query.to) filter.date.$lte = new Date(query.to);
  }
  if (query.status) filter.status = query.status;

  return StaffShift.find(filter).populate('shiftTemplate').sort({ date: 1 }).lean();
};

export const requestSwap = async (userId, payload = {}) => {
  const { fromShiftId, targetShiftId, reason } = payload;
  if (!fromShiftId) throw new Error('Thiếu ca muốn đổi');
  const fromShift = await StaffShift.findById(fromShiftId);
  if (!fromShift) throw new Error('Không tìm thấy ca làm');
  if (String(fromShift.staff) !== String(userId)) {
    throw new Error('Bạn chỉ có thể yêu cầu đổi ca của chính mình');
  }

  if (targetShiftId) {
    const targetShift = await StaffShift.findById(targetShiftId);
    if (!targetShift) throw new Error('Ca đổi mục tiêu không tồn tại');
  }

  const existing = await ShiftSwapRequest.findOne({
    requester: userId,
    fromShift: fromShiftId,
    status: 'pending',
  });
  if (existing) throw new Error('Bạn đã gửi yêu cầu đổi ca này rồi');

  return ShiftSwapRequest.create({
    requester: userId,
    fromShift: fromShiftId,
    targetShift: targetShiftId,
    reason,
  });
};

export const listSwapRequests = async (query = {}) => {
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.requesterId) filter.requester = query.requesterId;

  return ShiftSwapRequest.find(filter)
    .populate({ path: 'requester', select: 'name email role' })
    .populate({ path: 'fromShift', populate: ['staff', 'shiftTemplate'] })
    .populate({ path: 'targetShift', populate: ['staff', 'shiftTemplate'] })
    .sort({ createdAt: -1 })
    .lean();
};

export const cancelSwapRequest = async (userId, id) => {
  const req = await ShiftSwapRequest.findById(id);
  if (!req) throw new Error('Không tìm thấy yêu cầu đổi ca');
  if (String(req.requester) !== String(userId)) throw new Error('Bạn không thể huỷ yêu cầu này');
  if (req.status !== 'pending') throw new Error('Yêu cầu đã được xử lý');
  req.status = 'cancelled';
  req.resolvedAt = new Date();
  await req.save();
  return req;
};

export const resolveSwapRequest = async (id, payload = {}, adminId) => {
  const req = await ShiftSwapRequest.findById(id).populate('fromShift').populate('targetShift');
  if (!req) throw new Error('Không tìm thấy yêu cầu đổi ca');
  if (req.status !== 'pending') throw new Error('Yêu cầu đã được xử lý');

  const action = payload.action;
  if (!['approve', 'reject'].includes(action)) throw new Error('Hành động không hợp lệ');

  if (action === 'reject') {
    req.status = 'rejected';
    req.adminNote = payload.adminNote || '';
    req.resolvedBy = adminId;
    req.resolvedAt = new Date();
    await req.save();
    return req;
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const fromShift = await StaffShift.findById(req.fromShift._id).session(session);
    if (!fromShift) throw new Error('Ca gốc không tồn tại');

    let targetShift = null;
    if (payload.targetShiftId || req.targetShift) {
      const targetId = payload.targetShiftId || req.targetShift?._id;
      targetShift = await StaffShift.findById(targetId).session(session);
      if (!targetShift) throw new Error('Ca mục tiêu không tồn tại');
    }

    if (targetShift) {
      // Hoán đổi nhân viên giữa hai ca, đánh dấu cả hai là swapped.
      // Job nền sẽ tự chuyển sang completed khi hết giờ.
      const tmpStaff = targetShift.staff;
      targetShift.staff = fromShift.staff;
      fromShift.staff = tmpStaff;
      fromShift.status = 'swapped';
      targetShift.status = 'swapped';
      await fromShift.save({ session });
      await targetShift.save({ session });
    } else {
      fromShift.status = 'cancelled';
      await fromShift.save({ session });
    }

    req.status = 'approved';
    req.adminNote = payload.adminNote || '';
    req.resolvedBy = adminId;
    req.resolvedAt = new Date();
    await req.save({ session });

    await session.commitTransaction();
    session.endSession();
    return req;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};
