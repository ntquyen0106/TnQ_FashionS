import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import styles from './ShiftsPage.module.css';
import { shiftApi, usersApi } from '@/api';
import toast from 'react-hot-toast';

const STATUS_BADGE = {
  scheduled: styles.badgeScheduled,
  confirmed: styles.badgeConfirmed,
  completed: styles.badgeCompleted,
  cancelled: styles.badgeCancelled,
  swapped: styles.badgeSwapped,
};

const formatTimeRange = (shift) => {
  const start = shift.customStart || shift.shiftTemplate?.startTime;
  const end = shift.customEnd || shift.shiftTemplate?.endTime;
  if (!start || !end) return '—';
  return `${start} → ${end}`;
};

const formatDate = (date) => dayjs(date).format('DD/MM/YYYY');

const SHIFT_STATUSES = ['scheduled', 'confirmed', 'completed', 'cancelled', 'swapped'];
const RANGE_PRESETS = {
  week: 'week',
  month: 'month',
};

export default function ShiftsPage() {
  const [tab, setTab] = useState('schedule');
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [swapRequests, setSwapRequests] = useState([]);
  const [staffOptions, setStaffOptions] = useState([]);

  const buildDefaultTemplateForm = () => ({
    name: '',
    startTime: '09:00',
    endTime: '13:00',
    color: '#6366f1',
    notes: '',
  });

  const buildDefaultShiftForm = () => ({
    staffId: '',
    date: dayjs().format('YYYY-MM-DD'),
    shiftTemplateId: '',
    customStart: '',
    customEnd: '',
    notes: '',
  });

  const buildDefaultShiftFilters = (range = RANGE_PRESETS.week) => {
    const base = dayjs();
    const start = range === RANGE_PRESETS.month ? base.startOf('month') : base.startOf('week');
    const end = range === RANGE_PRESETS.month ? base.endOf('month') : start.add(6, 'day');
    return {
      staffId: '',
      status: '',
      templateId: '',
      range,
      from: start.format('YYYY-MM-DD'),
      to: end.format('YYYY-MM-DD'),
    };
  };

  const [templateForm, setTemplateForm] = useState(() => buildDefaultTemplateForm());
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [shiftForm, setShiftForm] = useState(() => buildDefaultShiftForm());
  const [editingShiftId, setEditingShiftId] = useState(null);
  const [shiftFilters, setShiftFilters] = useState(() => buildDefaultShiftFilters());
  const [shiftsLoading, setShiftsLoading] = useState(false);
  const [calendarAnchor, setCalendarAnchor] = useState(() => dayjs().startOf('week'));

  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [swapDecision, setSwapDecision] = useState({});
  const [calendarEditor, setCalendarEditor] = useState({
    open: false,
    mode: 'edit',
    shiftId: null,
    heading: '',
  });
  const [calendarEditorForm, setCalendarEditorForm] = useState(() => buildDefaultShiftForm());
  const [calendarEditorLoading, setCalendarEditorLoading] = useState(false);
  const calendarRange = shiftFilters.range || RANGE_PRESETS.week;

  const calendarRangeStart = useMemo(() => {
    if (calendarRange === RANGE_PRESETS.month) {
      return calendarAnchor.startOf('month');
    }
    return calendarAnchor.startOf('week');
  }, [calendarAnchor, calendarRange]);

  const calendarRangeEnd = useMemo(() => {
    if (calendarRange === RANGE_PRESETS.month) {
      return calendarRangeStart.endOf('month');
    }
    return calendarRangeStart.add(6, 'day');
  }, [calendarRange, calendarRangeStart]);

  const activeTemplates = useMemo(
    () => templates.filter((tpl) => tpl.isActive !== false),
    [templates],
  );

  const resetTemplateForm = () => {
    setTemplateForm(buildDefaultTemplateForm());
    setEditingTemplateId(null);
  };

  const resetShiftForm = () => {
    setShiftForm(buildDefaultShiftForm());
    setEditingShiftId(null);
  };

  const extractStaffOptions = (payload) => {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload.content)) return payload.content;
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.results)) return payload.results;
    return [];
  };

  const toMinutes = (time) => {
    if (!time) return -1;
    const [h, m] = String(time).split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return -1;
    return h * 60 + m;
  };

  const getShiftStartMinutes = (shift) =>
    toMinutes(shift.customStart || shift.shiftTemplate?.startTime || null);

  const calendarWeekDays = useMemo(() => {
    if (calendarRange !== RANGE_PRESETS.week) return [];
    return Array.from({ length: 7 }, (_, idx) => {
      const date = calendarRangeStart.add(idx, 'day');
      return {
        key: date.format('YYYY-MM-DD'),
        label: date.format('ddd'),
        date,
      };
    });
  }, [calendarRange, calendarRangeStart]);

  const calendarMonthWeeks = useMemo(() => {
    if (calendarRange !== RANGE_PRESETS.month) return [];
    const rangeStart = calendarRangeStart.startOf('week');
    const rangeEnd = calendarRangeEnd.endOf('week');
    const totalDays = rangeEnd.diff(rangeStart, 'day') + 1;
    const days = Array.from({ length: totalDays }, (_, idx) => {
      const date = rangeStart.add(idx, 'day');
      return {
        key: date.format('YYYY-MM-DD'),
        label: date.format('ddd'),
        date,
        inCurrentMonth: date.month() === calendarRangeStart.month(),
      };
    });
    const weeks = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }
    return weeks;
  }, [calendarRange, calendarRangeEnd, calendarRangeStart]);

  const calendarRangeDays = useMemo(() => {
    const days = [];
    let cursor = calendarRangeStart.startOf('day');
    const end = calendarRangeEnd.startOf('day');
    while (cursor.isBefore(end) || cursor.isSame(end, 'day')) {
      days.push(cursor);
      cursor = cursor.add(1, 'day');
    }
    return days;
  }, [calendarRangeEnd, calendarRangeStart]);

  const calendarShiftsByDay = useMemo(() => {
    const buckets = calendarRangeDays.reduce((acc, date) => {
      const key = date.format('YYYY-MM-DD');
      acc[key] = [];
      return acc;
    }, {});

    shifts.forEach((shift) => {
      const shiftDate = dayjs(shift.date).startOf('day');
      const key = shiftDate.format('YYYY-MM-DD');
      if (!buckets[key]) return;
      buckets[key].push({ ...shift, isPlaceholder: false });
    });

    calendarRangeDays.forEach((date) => {
      const key = date.format('YYYY-MM-DD');
      const list = buckets[key] || [];
      activeTemplates.forEach((tpl) => {
        const hasTemplateShift = list.some((item) => {
          const tplId = item.shiftTemplate?._id || item.shiftTemplate?.id;
          return item.isPlaceholder !== true && tplId && String(tplId) === String(tpl._id);
        });
        if (!hasTemplateShift) {
          list.push({
            _id: `placeholder-${key}-${tpl._id}`,
            date: date.toISOString(),
            shiftTemplate: tpl,
            status: 'unassigned',
            isPlaceholder: true,
          });
        }
      });
      list.sort((a, b) => {
        const startA = getShiftStartMinutes(a);
        const startB = getShiftStartMinutes(b);
        if (startA !== startB) return startA - startB;
        if (a.isPlaceholder && !b.isPlaceholder) return 1;
        if (!a.isPlaceholder && b.isPlaceholder) return -1;
        return 0;
      });
      buckets[key] = list;
    });

    return buckets;
  }, [activeTemplates, calendarRangeDays, shifts]);

  const calendarLabel = useMemo(() => {
    if (calendarRange === RANGE_PRESETS.month) {
      return `Tháng ${calendarRangeStart.format('MM/YYYY')}`;
    }
    return `${calendarRangeStart.format('DD/MM')} – ${calendarRangeEnd.format('DD/MM/YYYY')}`;
  }, [calendarRange, calendarRangeEnd, calendarRangeStart]);
  const buildShiftQueryParams = (filters) => {
    const params = {};
    if (filters.staffId) params.staffId = filters.staffId;
    if (filters.status) params.status = filters.status;
    if (filters.templateId) params.templateId = filters.templateId;
    if (filters.range) params.range = filters.range;
    if (filters.from) params.from = dayjs(filters.from).startOf('day').toISOString();
    if (filters.to) params.to = dayjs(filters.to).endOf('day').toISOString();
    return params;
  };

  const loadShifts = async (filters = shiftFilters, { silent = false } = {}) => {
    setShiftsLoading(true);
    try {
      const params = buildShiftQueryParams(filters);
      const res = await shiftApi.shifts.list(params);
      const items = Array.isArray(res)
        ? res
        : res?.items || res?.content || res?.data || res?.results || [];
      setShifts(items);
      return items;
    } catch (err) {
      console.error(err);
      if (!silent) toast.error('Không thể tải danh sách ca làm');
      throw err;
    } finally {
      setShiftsLoading(false);
    }
  };

  const loadSwapRequests = async () => {
    try {
      const res = await shiftApi.swaps.list({ status: 'pending' });
      setSwapRequests(Array.isArray(res) ? res : res?.items || res?.content || []);
    } catch (err) {
      console.error(err);
      toast.error('Không thể tải yêu cầu đổi ca');
    }
  };

  const loadInitial = async () => {
    setLoading(true);
    try {
      const [tplRes, staffRes] = await Promise.all([
        shiftApi.templates.list(),
        usersApi.list({ role: 'staff', limit: 200 }),
      ]);
      setTemplates(Array.isArray(tplRes) ? tplRes : []);
      const normalizedStaff = extractStaffOptions(staffRes)
        .filter((user) => (user.role || user?.data?.role || '').toLowerCase() === 'staff')
        .filter((user) => (user.status || '').toLowerCase() !== 'banned')
        .map((user) => ({
          _id: user._id || user.id,
          name: user.name,
          email: user.email,
        }))
        .filter((user) => Boolean(user._id))
        .sort((a, b) => a.name.localeCompare(b.name || '', 'vi', { sensitivity: 'base' }));
      setStaffOptions(normalizedStaff);
      await Promise.all([loadShifts(shiftFilters, { silent: true }), loadSwapRequests()]);
    } catch (err) {
      console.error(err);
      toast.error('Không thể tải dữ liệu ca làm');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitial();
  }, []);

  useEffect(() => {
    if (tab !== 'schedule' && showCalendarModal) {
      setShowCalendarModal(false);
    }
  }, [showCalendarModal, tab]);

  useEffect(() => {
    if (!shiftFilters.from) return;
    const base = dayjs(shiftFilters.from);
    const nextAnchor =
      calendarRange === RANGE_PRESETS.month ? base.startOf('month') : base.startOf('week');
    if (!nextAnchor.isSame(calendarAnchor, 'day')) {
      setCalendarAnchor(nextAnchor);
    }
  }, [calendarAnchor, calendarRange, shiftFilters.from]);

  const handleSubmitTemplate = async (e) => {
    e.preventDefault();
    try {
      if (editingTemplateId) {
        const res = await shiftApi.templates.update(editingTemplateId, templateForm);
        setTemplates((prev) =>
          prev.map((tpl) => (String(tpl._id || tpl.id) === String(res._id || res.id) ? res : tpl)),
        );
        toast.success('Đã cập nhật mẫu ca');
      } else {
        const res = await shiftApi.templates.create(templateForm);
        setTemplates((prev) => [...prev, res]);
        toast.success('Đã tạo mẫu ca');
      }
      resetTemplateForm();
    } catch (err) {
      const message = err.response?.data?.message;
      toast.error(
        message || (editingTemplateId ? 'Cập nhật mẫu ca thất bại' : 'Tạo mẫu ca thất bại'),
      );
    }
  };

  const handleEditTemplate = (tpl) => {
    setTemplateForm({
      name: tpl.name || '',
      startTime: tpl.startTime || '09:00',
      endTime: tpl.endTime || '13:00',
      color: tpl.color || '#6366f1',
      notes: tpl.notes || '',
    });
    setEditingTemplateId(tpl._id);
  };

  const handleDeleteTemplate = async (id) => {
    if (!window.confirm('Bạn chắc chắn xoá mẫu ca này?')) return;
    try {
      await shiftApi.templates.remove(id);
      setTemplates((prev) => prev.filter((tpl) => String(tpl._id) !== String(id)));
      if (String(editingTemplateId) === String(id)) {
        resetTemplateForm();
      }
      toast.success('Đã xoá mẫu ca');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Xoá mẫu ca thất bại');
    }
  };

  const handleCreateShift = async (e) => {
    e.preventDefault();
    try {
      if (editingShiftId) {
        const payload = {
          staffId: shiftForm.staffId,
          date: shiftForm.date,
          shiftTemplateId: shiftForm.shiftTemplateId || undefined,
          customStart: shiftForm.customStart || undefined,
          customEnd: shiftForm.customEnd || undefined,
          notes: shiftForm.notes || undefined,
        };
        await shiftApi.shifts.update(editingShiftId, payload);
        await loadShifts();
        toast.success('Đã cập nhật ca làm');
      } else {
        const payload = {
          shifts: [
            {
              staffId: shiftForm.staffId,
              date: shiftForm.date,
              shiftTemplateId: shiftForm.shiftTemplateId || undefined,
              customStart: shiftForm.customStart || undefined,
              customEnd: shiftForm.customEnd || undefined,
              notes: shiftForm.notes || undefined,
            },
          ],
        };
        await shiftApi.shifts.create(payload);
        await loadShifts();
        toast.success('Đã phân ca cho nhân viên');
      }
      resetShiftForm();
    } catch (err) {
      const message = err.response?.data?.message;
      toast.error(message || (editingShiftId ? 'Cập nhật ca thất bại' : 'Phân ca thất bại'));
    }
  };

  const handleDeleteShift = async (id) => {
    if (!window.confirm('Bạn chắc chắn xoá ca này?')) return;
    try {
      await shiftApi.shifts.remove(id);
      setShifts((prev) => prev.filter((s) => String(s._id) !== String(id)));
      if (String(editingShiftId) === String(id)) {
        resetShiftForm();
      }
      toast.success('Đã xoá ca');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Xoá ca thất bại');
    }
  };

  const handleEditShift = (shift) => {
    const staffId = shift.staff?._id || shift.staff?.id || shift.staff || '';
    const templateId = shift.shiftTemplate?._id || shift.shiftTemplate?.id || '';
    const formData = {
      staffId: staffId ? String(staffId) : '',
      date: shift.date ? dayjs(shift.date).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
      shiftTemplateId: templateId ? String(templateId) : '',
      customStart: shift.customStart || '',
      customEnd: shift.customEnd || '',
      notes: shift.notes || '',
    };
    setShiftForm(formData);
    setEditingShiftId(shift._id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeCalendarEditor = () => {
    setCalendarEditor({ open: false, mode: 'edit', shiftId: null, heading: '' });
    setCalendarEditorForm(buildDefaultShiftForm());
    setCalendarEditorLoading(false);
  };

  const openCalendarEditorForShift = (shift) => {
    if (!shift) return;
    const staffId = shift.staff?._id || shift.staff?.id || shift.staff || '';
    const templateId = shift.shiftTemplate?._id || shift.shiftTemplate?.id || '';
    setCalendarEditor({
      open: true,
      mode: 'edit',
      shiftId: shift._id,
      heading: `Chỉnh sửa ca ngày ${dayjs(shift.date).format('DD/MM/YYYY')}`,
    });
    setCalendarEditorForm({
      staffId: staffId ? String(staffId) : '',
      date: shift.date ? dayjs(shift.date).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
      shiftTemplateId: templateId ? String(templateId) : '',
      customStart: shift.customStart || '',
      customEnd: shift.customEnd || '',
      notes: shift.notes || '',
    });
  };

  const openCalendarEditorForTemplate = (date, template) => {
    if (!date || !template) return;
    const formatted = dayjs(date);
    setCalendarEditor({
      open: true,
      mode: 'create',
      shiftId: null,
      heading: `Phân ca ${template.name} ngày ${formatted.format('DD/MM/YYYY')}`,
    });
    setCalendarEditorForm({
      staffId: '',
      date: formatted.format('YYYY-MM-DD'),
      shiftTemplateId: String(template._id || template.id || ''),
      customStart: '',
      customEnd: '',
      notes: '',
    });
  };

  const handleCalendarEditorChange = (field) => (event) => {
    const value = event.target.value;
    setCalendarEditorForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleHideCalendarModal = () => {
    setShowCalendarModal(false);
    closeCalendarEditor();
  };

  const handleCalendarEditorSubmit = async (event) => {
    event.preventDefault();
    const payload = {
      staffId: calendarEditorForm.staffId,
      date: calendarEditorForm.date,
      shiftTemplateId: calendarEditorForm.shiftTemplateId || undefined,
      customStart: calendarEditorForm.customStart || undefined,
      customEnd: calendarEditorForm.customEnd || undefined,
      notes: calendarEditorForm.notes || undefined,
    };
    if (!payload.staffId) {
      toast.error('Vui lòng chọn nhân viên');
      return;
    }
    if (!payload.date) {
      toast.error('Vui lòng chọn ngày');
      return;
    }
    try {
      setCalendarEditorLoading(true);
      if (calendarEditor.mode === 'edit' && calendarEditor.shiftId) {
        await shiftApi.shifts.update(calendarEditor.shiftId, payload);
        toast.success('Đã cập nhật ca');
      } else {
        await shiftApi.shifts.create({ shifts: [payload] });
        toast.success('Đã phân ca');
      }
      await loadShifts(shiftFilters, { silent: true });
      setCalendarEditorLoading(false);
      closeCalendarEditor();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Không thể lưu ca');
      setCalendarEditorLoading(false);
    }
  };

  const handleCalendarEditorDelete = async () => {
    if (!calendarEditor.shiftId) return;
    if (!window.confirm('Xoá ca này?')) return;
    try {
      setCalendarEditorLoading(true);
      await shiftApi.shifts.remove(calendarEditor.shiftId);
      toast.success('Đã xoá ca');
      await loadShifts(shiftFilters, { silent: true });
      setCalendarEditorLoading(false);
      closeCalendarEditor();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Không thể xoá ca');
      setCalendarEditorLoading(false);
    }
  };

  const handleFilterChange = (field) => (event) => {
    const value = event.target.value;
    setShiftFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleApplyFilters = async (event) => {
    event?.preventDefault?.();
    if (shiftFilters.from && shiftFilters.to) {
      const from = dayjs(shiftFilters.from);
      const to = dayjs(shiftFilters.to);
      if (from.isAfter(to)) {
        toast.error('Khoảng ngày lọc không hợp lệ');
        return;
      }
    }
    const range = shiftFilters.range || RANGE_PRESETS.week;
    const baseDate = dayjs(shiftFilters.from || shiftFilters.to || dayjs());
    let rangeStart = baseDate;
    let rangeEnd = dayjs(shiftFilters.to || baseDate);
    if (range === RANGE_PRESETS.month) {
      rangeStart = baseDate.startOf('month');
      rangeEnd = rangeStart.endOf('month');
    } else {
      rangeStart = baseDate.startOf('week');
      rangeEnd = rangeStart.add(6, 'day');
    }
    const sanitizedFilters = {
      ...shiftFilters,
      from: rangeStart.format('YYYY-MM-DD'),
      to: rangeEnd.format('YYYY-MM-DD'),
    };
    setShiftFilters(sanitizedFilters);
    await loadShifts(sanitizedFilters);
    setCalendarAnchor(rangeStart);
  };

  const handleResetFilters = async () => {
    const defaults = buildDefaultShiftFilters();
    setShiftFilters(defaults);
    setCalendarAnchor(dayjs(defaults.from).startOf('week'));
    await loadShifts(defaults);
  };

  const handleCalendarNavigate = async (direction) => {
    const unit = calendarRange === RANGE_PRESETS.month ? 'month' : 'week';
    const nextAnchor = calendarAnchor.add(direction, unit);
    const nextStart =
      calendarRange === RANGE_PRESETS.month
        ? nextAnchor.startOf('month')
        : nextAnchor.startOf('week');
    const nextEnd =
      calendarRange === RANGE_PRESETS.month ? nextStart.endOf('month') : nextStart.add(6, 'day');
    const updatedFilters = {
      ...shiftFilters,
      range: calendarRange,
      from: nextStart.format('YYYY-MM-DD'),
      to: nextEnd.format('YYYY-MM-DD'),
    };
    setCalendarAnchor(nextAnchor);
    setShiftFilters(updatedFilters);
    try {
      await loadShifts(updatedFilters);
    } catch (err) {
      console.error('Load shifts error:', err);
    }
  };

  const handleRangeChange = async (nextRange) => {
    if (nextRange === calendarRange) return;
    const base = dayjs(shiftFilters.from || dayjs());
    const nextAnchor =
      nextRange === RANGE_PRESETS.month ? base.startOf('month') : base.startOf('week');
    const nextStart =
      nextRange === RANGE_PRESETS.month ? nextAnchor.startOf('month') : nextAnchor.startOf('week');
    const nextEnd =
      nextRange === RANGE_PRESETS.month ? nextStart.endOf('month') : nextStart.add(6, 'day');
    const updatedFilters = {
      ...shiftFilters,
      range: nextRange,
      from: nextStart.format('YYYY-MM-DD'),
      to: nextEnd.format('YYYY-MM-DD'),
    };
    setShiftFilters(updatedFilters);
    setCalendarAnchor(nextAnchor);
    try {
      await loadShifts(updatedFilters);
    } catch (err) {
      console.error('Load shifts error:', err);
    }
  };

  const handleResolveSwap = async (id, action) => {
    const body = { action, adminNote: swapDecision[id]?.note || '' };
    if (swapDecision[id]?.targetShiftId) body.targetShiftId = swapDecision[id]?.targetShiftId;
    try {
      await shiftApi.swaps.resolve(id, body);
      toast.success(action === 'approve' ? 'Đã duyệt đổi ca' : 'Đã từ chối');
      setSwapRequests((prev) => prev.filter((item) => String(item._id) !== String(id)));
      await loadInitial();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không thể xử lý yêu cầu');
    }
  };

  const renderCalendar = () => {
    const prevLabel = calendarRange === RANGE_PRESETS.month ? '◀ Tháng trước' : '◀ Tuần trước';
    const nextLabel = calendarRange === RANGE_PRESETS.month ? 'Tháng sau ▶' : 'Tuần sau ▶';

    return (
      <div className={styles.calendarWrap}>
        <div className={styles.calendarHeader}>
          <div className={styles.calendarControls}>
            <button
              type="button"
              className={styles.calendarNavBtn}
              onClick={() => handleCalendarNavigate(-1)}
              disabled={shiftsLoading}
            >
              {prevLabel}
            </button>
            <button
              type="button"
              className={styles.calendarNavBtn}
              onClick={() => handleCalendarNavigate(1)}
              disabled={shiftsLoading}
            >
              {nextLabel}
            </button>
          </div>
          <div className={styles.calendarTitle}>{calendarLabel}</div>
          <div className={styles.calendarRangeToggle}>
            <button
              type="button"
              className={`${styles.calendarRangeBtn} ${
                calendarRange === RANGE_PRESETS.week ? styles.calendarRangeBtnActive : ''
              }`}
              onClick={() => handleRangeChange(RANGE_PRESETS.week)}
              disabled={shiftsLoading}
            >
              Tuần
            </button>
            <button
              type="button"
              className={`${styles.calendarRangeBtn} ${
                calendarRange === RANGE_PRESETS.month ? styles.calendarRangeBtnActive : ''
              }`}
              onClick={() => handleRangeChange(RANGE_PRESETS.month)}
              disabled={shiftsLoading}
            >
              Tháng
            </button>
          </div>
        </div>
        {calendarRange === RANGE_PRESETS.week ? (
          <div className={styles.calendarGrid}>
            {calendarWeekDays.map((day) => {
              const dayKey = day.key;
              const shiftList = calendarShiftsByDay[dayKey] || [];
              const isToday = day.date.isSame(dayjs(), 'day');
              return (
                <div key={dayKey} className={styles.calendarColumn}>
                  <div
                    className={`${styles.calendarColumnHeader} ${
                      isToday ? styles.calendarToday : ''
                    }`}
                  >
                    <div className={styles.calendarDayName}>{day.label}</div>
                    <div className={styles.calendarDate}>{day.date.format('DD/MM')}</div>
                  </div>
                  <div className={styles.calendarColumnBody}>
                    {shiftList.length === 0 ? (
                      <div className={styles.calendarEmpty}>Không có ca</div>
                    ) : (
                      shiftList.map((shift) => {
                        const isPlaceholder = Boolean(shift.isPlaceholder);
                        const template = shift.shiftTemplate;
                        const borderColor = template?.color || '#cbd5f5';
                        return (
                          <div
                            key={shift._id}
                            className={`${styles.calendarShift} ${
                              isPlaceholder ? styles.calendarShiftPlaceholder : ''
                            }`}
                            style={{ borderLeft: `4px solid ${borderColor}` }}
                          >
                            <div className={styles.calendarShiftTemplate}>
                              {template?.name || 'Ca tuỳ chỉnh'}
                            </div>
                            <div className={styles.calendarShiftTime}>{formatTimeRange(shift)}</div>
                            <div className={styles.calendarShiftStaff}>
                              {isPlaceholder ? 'Chưa có nhân viên' : shift.staff?.name || 'Chưa rõ'}
                            </div>
                            <div className={styles.calendarShiftFooter}>
                              {isPlaceholder ? (
                                <button
                                  type="button"
                                  className={styles.calendarAssignBtn}
                                  onClick={() => openCalendarEditorForTemplate(day.date, template)}
                                  disabled={shiftsLoading}
                                >
                                  Phân ca
                                </button>
                              ) : (
                                <>
                                  <span
                                    className={`${styles.badge} ${
                                      STATUS_BADGE[shift.status] || ''
                                    }`}
                                  >
                                    {shift.status}
                                  </span>
                                  <button
                                    type="button"
                                    className={styles.calendarShiftEdit}
                                    onClick={() => openCalendarEditorForShift(shift)}
                                  >
                                    Sửa
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.calendarMonthGrid}>
            {calendarMonthWeeks.length > 0 ? (
              <>
                {calendarMonthWeeks[0].map((day) => (
                  <div key={`head-${day.key}`} className={styles.calendarMonthHeaderCell}>
                    {day.label}
                  </div>
                ))}
                {calendarMonthWeeks.map((week, idx) => (
                  <div key={`week-${idx}`} className={styles.calendarMonthRow}>
                    {week.map((day) => {
                      const shiftList = calendarShiftsByDay[day.key] || [];
                      const isToday = day.date.isSame(dayjs(), 'day');
                      const cellClasses = [styles.calendarMonthCell];
                      if (!day.inCurrentMonth) cellClasses.push(styles.calendarMonthCellMuted);
                      if (isToday) cellClasses.push(styles.calendarMonthCellToday);
                      return (
                        <div key={day.key} className={cellClasses.join(' ')}>
                          <div className={styles.calendarMonthCellHeader}>
                            <span className={styles.calendarMonthCellDate}>
                              {day.date.format('D')}
                            </span>
                          </div>
                          <div className={styles.calendarMonthCellBody}>
                            {shiftList.map((shift) => {
                              const isPlaceholder = Boolean(shift.isPlaceholder);
                              const template = shift.shiftTemplate;
                              const borderColor = template?.color || '#cbd5f5';
                              return (
                                <div
                                  key={shift._id}
                                  className={`${styles.calendarMonthShift} ${
                                    isPlaceholder ? styles.calendarMonthShiftPlaceholder : ''
                                  }`}
                                  style={{ borderLeft: `3px solid ${borderColor}` }}
                                >
                                  <div className={styles.calendarMonthShiftTemplate}>
                                    {template?.name || 'Ca tuỳ chỉnh'}
                                  </div>
                                  <div className={styles.calendarMonthShiftTime}>
                                    {formatTimeRange(shift)}
                                  </div>
                                  <div className={styles.calendarMonthShiftStaff}>
                                    {isPlaceholder ? 'Trống' : shift.staff?.name || 'Chưa rõ'}
                                  </div>
                                  <div className={styles.calendarMonthShiftActions}>
                                    {isPlaceholder ? (
                                      <button
                                        type="button"
                                        className={styles.calendarMonthAssignBtn}
                                        onClick={() =>
                                          openCalendarEditorForTemplate(day.date, template)
                                        }
                                        disabled={shiftsLoading}
                                      >
                                        Phân ca
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        className={styles.calendarMonthEditBtn}
                                        onClick={() => openCalendarEditorForShift(shift)}
                                      >
                                        Sửa
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </>
            ) : null}
          </div>
        )}
      </div>
    );
  };

  const renderCalendarModal = () => (
    <div
      className={styles.calendarModalOverlay}
      role="presentation"
      onClick={handleHideCalendarModal}
    >
      <div
        className={styles.calendarModal}
        role="dialog"
        aria-modal="true"
        aria-label="Lịch ca làm"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className={styles.calendarModalClose}
          onClick={handleHideCalendarModal}
        >
          ✕
        </button>
        <div className={styles.calendarModalBody}>{renderCalendar()}</div>
        {calendarEditor.open ? (
          <div
            className={styles.calendarEditorOverlay}
            role="presentation"
            onClick={() => {
              if (!calendarEditorLoading) closeCalendarEditor();
            }}
          >
            <div
              className={styles.calendarEditor}
              role="dialog"
              aria-modal="true"
              aria-label={calendarEditor.heading || 'Chỉnh sửa ca'}
              onClick={(event) => event.stopPropagation()}
            >
              <div className={styles.calendarEditorHeader}>
                <h4 className={styles.calendarEditorTitle}>
                  {calendarEditor.heading || 'Chỉnh sửa ca'}
                </h4>
                <button
                  type="button"
                  className={styles.calendarEditorClose}
                  onClick={closeCalendarEditor}
                  disabled={calendarEditorLoading}
                >
                  ✕
                </button>
              </div>
              <div className={styles.calendarEditorBody}>
                <form className={styles.calendarEditorForm} onSubmit={handleCalendarEditorSubmit}>
                  <label className={styles.formStackLabel}>
                    Nhân viên
                    <select
                      className={styles.select}
                      value={calendarEditorForm.staffId}
                      onChange={handleCalendarEditorChange('staffId')}
                      required
                      disabled={calendarEditorLoading}
                    >
                      <option value="">Chọn nhân viên</option>
                      {staffOptions.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.name || s.email}
                          {s.email ? ` (${s.email})` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.formStackLabel}>
                    Ngày
                    <input
                      type="date"
                      className={styles.dateInput}
                      value={calendarEditorForm.date}
                      onChange={handleCalendarEditorChange('date')}
                      required
                      disabled={calendarEditorLoading}
                    />
                  </label>
                  <label className={styles.formStackLabel}>
                    Mẫu ca
                    <select
                      className={styles.select}
                      value={calendarEditorForm.shiftTemplateId}
                      onChange={handleCalendarEditorChange('shiftTemplateId')}
                      disabled={calendarEditorLoading}
                    >
                      <option value="">Tuỳ chỉnh</option>
                      {activeTemplates.map((tpl) => (
                        <option key={tpl._id} value={tpl._id}>
                          {tpl.name} ({tpl.startTime} - {tpl.endTime})
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className={styles.gridTwo}>
                    <label className={styles.formStackLabel}>
                      Bắt đầu tuỳ chỉnh
                      <input
                        type="time"
                        className={styles.timeInput}
                        value={calendarEditorForm.customStart}
                        onChange={handleCalendarEditorChange('customStart')}
                        disabled={calendarEditorLoading}
                      />
                    </label>
                    <label className={styles.formStackLabel}>
                      Kết thúc tuỳ chỉnh
                      <input
                        type="time"
                        className={styles.timeInput}
                        value={calendarEditorForm.customEnd}
                        onChange={handleCalendarEditorChange('customEnd')}
                        disabled={calendarEditorLoading}
                      />
                    </label>
                  </div>
                  <label className={styles.formStackLabel}>
                    Ghi chú
                    <textarea
                      className={styles.textarea}
                      rows={3}
                      value={calendarEditorForm.notes}
                      onChange={handleCalendarEditorChange('notes')}
                      disabled={calendarEditorLoading}
                    />
                  </label>
                  <div className={styles.calendarEditorActions}>
                    {calendarEditor.mode === 'edit' && calendarEditor.shiftId ? (
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnSmall} ${styles.calendarEditorDanger}`}
                        onClick={handleCalendarEditorDelete}
                        disabled={calendarEditorLoading}
                      >
                        Xoá ca
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
                      onClick={closeCalendarEditor}
                      disabled={calendarEditorLoading}
                    >
                      Huỷ
                    </button>
                    <button
                      type="submit"
                      className={`${styles.btn} ${styles.btnSmall}`}
                      disabled={calendarEditorLoading}
                    >
                      {calendarEditor.mode === 'edit' ? 'Lưu thay đổi' : 'Phân ca'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
  const renderSchedule = () => {
    return (
      <div className={styles.gridSchedule}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>Phân ca</h3>
          </div>
          {editingShiftId ? (
            <div className={styles.editingAlert}>
              Đang chỉnh sửa ca đã chọn — bấm Huỷ để quay lại chế độ tạo mới.
            </div>
          ) : null}
          <form className={styles.formStack} onSubmit={handleCreateShift}>
            <label>
              Nhân viên
              <select
                className={styles.select}
                value={shiftForm.staffId}
                onChange={(e) => setShiftForm((f) => ({ ...f, staffId: e.target.value }))}
                required
              >
                <option value="">Chọn nhân viên</option>
                {staffOptions.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name || s.email}
                    {s.email ? ` (${s.email})` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ngày
              <input
                type="date"
                className={styles.dateInput}
                value={shiftForm.date}
                onChange={(e) => setShiftForm((f) => ({ ...f, date: e.target.value }))}
                required
              />
            </label>
            <label>
              Mẫu ca
              <select
                className={styles.select}
                value={shiftForm.shiftTemplateId}
                onChange={(e) => setShiftForm((f) => ({ ...f, shiftTemplateId: e.target.value }))}
              >
                <option value="">Chọn mẫu ca</option>
                {activeTemplates.map((tpl) => (
                  <option key={tpl._id} value={tpl._id}>
                    {tpl.name} ({tpl.startTime} - {tpl.endTime})
                  </option>
                ))}
              </select>
            </label>
            <div className={styles.gridTwo}>
              <label>
                Bắt đầu tuỳ chỉnh
                <input
                  type="time"
                  className={styles.timeInput}
                  value={shiftForm.customStart}
                  onChange={(e) => setShiftForm((f) => ({ ...f, customStart: e.target.value }))}
                />
              </label>
              <label>
                Kết thúc tuỳ chỉnh
                <input
                  type="time"
                  className={styles.timeInput}
                  value={shiftForm.customEnd}
                  onChange={(e) => setShiftForm((f) => ({ ...f, customEnd: e.target.value }))}
                />
              </label>
            </div>
            <label>
              Ghi chú
              <textarea
                className={styles.textarea}
                rows={3}
                value={shiftForm.notes}
                onChange={(e) => setShiftForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </label>
            <div className={styles.formActions}>
              <button className={styles.btn} type="submit" disabled={shiftsLoading}>
                {editingShiftId ? 'Lưu ca' : 'Giao ca'}
              </button>
              {editingShiftId ? (
                <button
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  type="button"
                  onClick={resetShiftForm}
                >
                  Huỷ
                </button>
              ) : null}
            </div>
          </form>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>Danh sách ca</h3>
            <div className={styles.headerActions}>
              <button
                className={styles.btn}
                type="button"
                onClick={() => setShowCalendarModal(true)}
                disabled={shiftsLoading}
              >
                Xem lịch ca
              </button>
              <button
                className={`${styles.btn} ${styles.btnSecondary}`}
                type="button"
                onClick={loadInitial}
                disabled={loading || shiftsLoading}
              >
                Tải lại dữ liệu
              </button>
            </div>
          </div>
          <form className={styles.filterBar} onSubmit={handleApplyFilters}>
            <label>
              Nhân viên
              <select
                className={styles.select}
                value={shiftFilters.staffId}
                onChange={handleFilterChange('staffId')}
              >
                <option value="">Tất cả</option>
                {staffOptions.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name || s.email}
                    {s.email ? ` (${s.email})` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Mẫu ca
              <select
                className={styles.select}
                value={shiftFilters.templateId}
                onChange={handleFilterChange('templateId')}
              >
                <option value="">Tất cả</option>
                {templates.map((tpl) => (
                  <option key={tpl._id} value={tpl._id}>
                    {tpl.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Trạng thái
              <select
                className={styles.select}
                value={shiftFilters.status}
                onChange={handleFilterChange('status')}
              >
                <option value="">Tất cả</option>
                {SHIFT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Từ ngày
              <input
                type="date"
                className={styles.dateInput}
                value={shiftFilters.from}
                onChange={handleFilterChange('from')}
              />
            </label>
            <label>
              Đến ngày
              <input
                type="date"
                className={styles.dateInput}
                value={shiftFilters.to}
                onChange={handleFilterChange('to')}
              />
            </label>
            <div className={styles.filterActions}>
              <button
                className={`${styles.btn} ${styles.btnSecondary}`}
                type="button"
                onClick={handleResetFilters}
                disabled={shiftsLoading}
              >
                Huỷ lọc
              </button>
              <button className={styles.btn} type="submit" disabled={shiftsLoading}>
                Áp dụng
              </button>
            </div>
          </form>
          {shifts.length === 0 ? (
            <div className={styles.empty}>Chưa có ca nào trong khoảng này</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Nhân viên</th>
                    <th>Ngày</th>
                    <th>Giờ</th>
                    <th>Trạng thái</th>
                    <th>Ghi chú</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {shifts.map((shift) => (
                    <tr key={shift._id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{shift.staff?.name || 'Chưa rõ'}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{shift.staff?.email}</div>
                      </td>
                      <td>{formatDate(shift.date)}</td>
                      <td>{formatTimeRange(shift)}</td>
                      <td>
                        <span className={`${styles.badge} ${STATUS_BADGE[shift.status] || ''}`}>
                          {shift.status}
                        </span>
                      </td>
                      <td style={{ maxWidth: 200 }}>{shift.notes}</td>
                      <td>
                        <div className={styles.actionRow}>
                          <button
                            className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
                            type="button"
                            onClick={() => handleEditShift(shift)}
                          >
                            Sửa
                          </button>
                          <button
                            className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`}
                            type="button"
                            onClick={() => handleDeleteShift(shift._id)}
                          >
                            Xoá
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {showCalendarModal ? renderCalendarModal() : null}
      </div>
    );
  };

  const renderTemplates = () => (
    <div className={styles.gridTwo}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>Tạo mẫu ca</h3>
        </div>
        <form className={styles.formStack} onSubmit={handleSubmitTemplate}>
          <label>
            Tên ca
            <input
              className={styles.input}
              value={templateForm.name}
              onChange={(e) => setTemplateForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </label>
          <div className={styles.gridTwo}>
            <label>
              Bắt đầu
              <input
                type="time"
                className={styles.timeInput}
                value={templateForm.startTime}
                onChange={(e) => setTemplateForm((f) => ({ ...f, startTime: e.target.value }))}
                required
              />
            </label>
            <label>
              Kết thúc
              <input
                type="time"
                className={styles.timeInput}
                value={templateForm.endTime}
                onChange={(e) => setTemplateForm((f) => ({ ...f, endTime: e.target.value }))}
                required
              />
            </label>
          </div>
          <label>
            Màu hiển thị
            <input
              type="color"
              className={styles.input}
              value={templateForm.color}
              onChange={(e) => setTemplateForm((f) => ({ ...f, color: e.target.value }))}
            />
          </label>
          <label>
            Ghi chú
            <textarea
              className={styles.textarea}
              rows={3}
              value={templateForm.notes}
              onChange={(e) => setTemplateForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </label>
          <div className={styles.formActions}>
            <button className={`${styles.btn} ${styles.btnSmall}`} type="submit">
              {editingTemplateId ? 'Lưu thay đổi' : 'Tạo mẫu'}
            </button>
            {editingTemplateId ? (
              <button
                className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
                type="button"
                onClick={resetTemplateForm}
              >
                Huỷ
              </button>
            ) : null}
          </div>
        </form>
      </div>

      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>Danh sách mẫu ca</h3>
        </div>
        {templates.length === 0 ? (
          <div className={styles.empty}>Chưa có mẫu ca nào</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Tên</th>
                  <th>Khung giờ</th>
                  <th>Màu</th>
                  <th>Ghi chú</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {templates.map((tpl) => (
                  <tr key={tpl._id}>
                    <td>{tpl.name}</td>
                    <td>
                      {tpl.startTime} - {tpl.endTime}
                    </td>
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          width: 18,
                          height: 18,
                          borderRadius: 6,
                          background: tpl.color,
                        }}
                      />
                    </td>
                    <td style={{ maxWidth: 220 }}>{tpl.notes}</td>
                    <td>
                      <div className={styles.actionRow}>
                        <button
                          className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
                          type="button"
                          onClick={() => handleEditTemplate(tpl)}
                        >
                          Sửa
                        </button>
                        <button
                          className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`}
                          type="button"
                          onClick={() => handleDeleteTemplate(tpl._id)}
                        >
                          Xoá
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  const renderSwaps = () => (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>Yêu cầu đổi ca</h3>
        <button className={styles.btn} type="button" onClick={loadInitial}>
          Làm mới
        </button>
      </div>
      {swapRequests.length === 0 ? (
        <div className={styles.empty}>Không có yêu cầu chờ xử lý</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Người gửi</th>
                <th>Ca gốc</th>
                <th>Ca muốn đổi</th>
                <th>Lý do</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {swapRequests.map((req) => (
                <tr key={req._id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{req.requester?.name}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{req.requester?.email}</div>
                  </td>
                  <td>
                    {req.fromShift ? (
                      <>
                        <div>{formatDate(req.fromShift.date)}</div>
                        <div>{formatTimeRange(req.fromShift)}</div>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {req.targetShift ? (
                      <>
                        <div>{req.targetShift.staff?.name}</div>
                        <div>{formatDate(req.targetShift.date)}</div>
                      </>
                    ) : (
                      <input
                        className={styles.input}
                        placeholder="ID ca muốn gán"
                        value={swapDecision[req._id]?.targetShiftId || ''}
                        onChange={(e) =>
                          setSwapDecision((prev) => ({
                            ...prev,
                            [req._id]: { ...prev[req._id], targetShiftId: e.target.value },
                          }))
                        }
                      />
                    )}
                  </td>
                  <td style={{ maxWidth: 220 }}>{req.reason || '—'}</td>
                  <td>
                    <div className={styles.formStack}>
                      <textarea
                        className={styles.textarea}
                        rows={2}
                        placeholder="Ghi chú cho quyết định"
                        value={swapDecision[req._id]?.note || ''}
                        onChange={(e) =>
                          setSwapDecision((prev) => ({
                            ...prev,
                            [req._id]: { ...prev[req._id], note: e.target.value },
                          }))
                        }
                      />
                      <div className={styles.actionRow}>
                        <button
                          className={styles.btn}
                          type="button"
                          onClick={() => handleResolveSwap(req._id, 'approve')}
                        >
                          Duyệt
                        </button>
                        <button
                          className={`${styles.btn} ${styles.btnDanger}`}
                          type="button"
                          onClick={() => handleResolveSwap(req._id, 'reject')}
                        >
                          Từ chối
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className={styles.wrap}>
      <div className={styles.tabs}>
        <button
          className={`${styles.tabBtn} ${tab === 'schedule' ? styles.tabBtnActive : ''}`}
          type="button"
          onClick={() => setTab('schedule')}
        >
          Phân ca
        </button>
        <button
          className={`${styles.tabBtn} ${tab === 'templates' ? styles.tabBtnActive : ''}`}
          type="button"
          onClick={() => setTab('templates')}
        >
          Mẫu ca
        </button>
        <button
          className={`${styles.tabBtn} ${tab === 'swaps' ? styles.tabBtnActive : ''}`}
          type="button"
          onClick={() => setTab('swaps')}
        >
          Đổi ca
        </button>
      </div>

      {tab === 'schedule' && renderSchedule()}
      {tab === 'templates' && renderTemplates()}
      {tab === 'swaps' && renderSwaps()}
    </div>
  );
}
