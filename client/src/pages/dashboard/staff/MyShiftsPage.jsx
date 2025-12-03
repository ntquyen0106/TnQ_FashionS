import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import styles from './MyShiftsPage.module.css';
import { shiftApi } from '@/api/shifts-api';
import toast from 'react-hot-toast';

const STATUS_BADGE = {
  scheduled: styles.badgeScheduled,
  confirmed: styles.badgeConfirmed,
  completed: styles.badgeCompleted,
  cancelled: styles.badgeCancelled,
  swapped: styles.badgeSwapped,
};

const formatRange = (shift) => {
  const start = shift.customStart || shift.shiftTemplate?.startTime;
  const end = shift.customEnd || shift.shiftTemplate?.endTime;
  if (!start || !end) return '—';
  return `${start} → ${end}`;
};

export default function MyShiftsPage() {
  const [shifts, setShifts] = useState([]);
  const [swapTargets, setSwapTargets] = useState([]); // other staff shifts user can target
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ fromShiftId: '', targetShiftId: '', reason: '' });
  const [weekStart, setWeekStart] = useState(() => dayjs().startOf('week'));
  const [viewMode, setViewMode] = useState('week'); // 'week' or 'month'
  const [monthStart, setMonthStart] = useState(() => dayjs().startOf('month'));
  const [showCalendarModal, setShowCalendarModal] = useState(false);

  const upcoming = useMemo(() => {
    const now = dayjs();
    return shifts.filter((item) => dayjs(item.date).diff(now, 'day') >= 0);
  }, [shifts]);

  const summary = useMemo(() => {
    const total = shifts.length;
    const currentMonth = dayjs();
    const monthCount = shifts.filter((s) => dayjs(s.date).isSame(currentMonth, 'month')).length;
    const hours = shifts.reduce((sum, shift) => {
      const start = shift.customStart || shift.shiftTemplate?.startTime;
      const end = shift.customEnd || shift.shiftTemplate?.endTime;
      if (!start || !end) return sum;
      const [sh, sm] = start.split(':').map(Number);
      const [eh, em] = end.split(':').map(Number);
      const diff = eh * 60 + em - (sh * 60 + sm);
      return sum + Math.max(0, diff / 60);
    }, 0);
    return { total, monthCount, hours: Math.round(hours * 10) / 10 };
  }, [shifts]);

  const weekEnd = useMemo(() => weekStart.add(6, 'day'), [weekStart]);

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, idx) => {
        const date = weekStart.add(idx, 'day');
        return {
          key: date.format('YYYY-MM-DD'),
          label: date.format('ddd'),
          date,
        };
      }),
    [weekStart],
  );

  const toMinutes = (time) => {
    if (!time) return -1;
    const [h, m] = String(time).split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return -1;
    return h * 60 + m;
  };

  const isShiftInProgress = (s) => {
    const startStr = s.customStart || s.shiftTemplate?.startTime;
    const endStr = s.customEnd || s.shiftTemplate?.endTime;
    if (!startStr || !endStr) return false;
    const [sh, sm] = startStr.split(':').map(Number);
    const [eh, em] = endStr.split(':').map(Number);
    const startMoment = dayjs(s.date).hour(sh).minute(sm);
    const endMoment = dayjs(s.date).hour(eh).minute(em);
    const now = dayjs();
    return now.isAfter(startMoment) && now.isBefore(endMoment) && now.isSame(s.date, 'day');
  };

  const weekShiftsByDay = useMemo(() => {
    const startTs = weekStart.startOf('day').valueOf();
    const endTs = weekEnd.endOf('day').valueOf();
    const buckets = weekDays.reduce((acc, day) => {
      acc[day.key] = [];
      return acc;
    }, {});

    shifts.forEach((shift) => {
      const shiftDate = dayjs(shift.date);
      const ts = shiftDate.valueOf();
      if (ts < startTs || ts > endTs) return;
      const key = shiftDate.format('YYYY-MM-DD');
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(shift);
    });

    Object.values(buckets).forEach((list) =>
      list.sort(
        (a, b) =>
          toMinutes(a.customStart || a.shiftTemplate?.startTime) -
          toMinutes(b.customStart || b.shiftTemplate?.startTime),
      ),
    );

    return buckets;
  }, [shifts, weekDays, weekEnd, weekStart]);

  const weekLabel = useMemo(
    () => `${weekStart.format('DD/MM')} – ${weekEnd.format('DD/MM/YYYY')}`,
    [weekEnd, weekStart],
  );

  const loadShifts = async () => {
    setLoading(true);
    try {
      const res = await shiftApi.shifts.mine({
        from: dayjs().startOf('month').toISOString(),
        to: dayjs().add(1, 'month').endOf('month').toISOString(),
      });
      const myList = Array.isArray(res) ? res : res?.items || [];
      setShifts(myList);

      // derive current staff id (mine shifts all belong to me)
      const myStaffId = myList[0]?.staff?._id || myList[0]?.staff?.id;
      const myShiftIds = new Set(
        myList.map((s) => String(s._id || s.id || '')).filter((id) => !!id),
      );
      // fetch all shifts in same extended range to allow choosing a target
      const allRes = await shiftApi.shifts.list({
        from: dayjs().startOf('month').toISOString(),
        to: dayjs().add(1, 'month').endOf('month').toISOString(),
      });
      const allList = Array.isArray(allRes) ? allRes : allRes?.items || [];
      const now = dayjs();
      const targets = allList
        .filter((s) => String(s.staff?._id || s.staff?.id) !== String(myStaffId))
        .filter((s) => !myShiftIds.has(String(s._id || s.id)))
        .filter((s) => {
          const st = (s.status || '').toLowerCase();
          if (['cancelled', 'completed'].includes(st)) return false; // hide cancelled & completed
          // hide in-progress (đang làm) shifts today
          const startStr = s.customStart || s.shiftTemplate?.startTime;
          const endStr = s.customEnd || s.shiftTemplate?.endTime;
          if (!startStr || !endStr) return true;
          const [sh, sm] = startStr.split(':').map(Number);
          const [eh, em] = endStr.split(':').map(Number);
          const startMoment = dayjs(s.date).hour(sh).minute(sm);
          const endMoment = dayjs(s.date).hour(eh).minute(em);
          const inProgress =
            now.isAfter(startMoment) && now.isBefore(endMoment) && now.isSame(s.date, 'day');
          return !inProgress;
        })
        .slice(0, 300); // cap list for performance
      setSwapTargets(targets);
    } catch (err) {
      console.error(err);
      toast.error('Không thể tải ca làm');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShifts();
  }, []);

  const handleWeekNavigate = (direction) => {
    setWeekStart((prev) => prev.add(direction, 'week'));
  };

  const handleSubmitSwap = async (e) => {
    e.preventDefault();
    if (!form.fromShiftId) {
      toast.error('Vui lòng chọn ca muốn đổi');
      return;
    }
    try {
      setSubmitting(true);
      await shiftApi.swaps.create({
        fromShiftId: form.fromShiftId,
        targetShiftId: form.targetShiftId || undefined,
        reason: form.reason,
      });
      toast.success('Đã gửi yêu cầu đổi ca');
      setForm({ fromShiftId: '', targetShiftId: '', reason: '' });
      await loadShifts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gửi yêu cầu thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const renderCalendar = () => (
    <div className={styles.calendarModalContent}>
      <div className={styles.calendarHeader}>
        <div className={styles.calendarControls}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className={
                styles.calendarModeBtn + (viewMode === 'week' ? ` ${styles.activeMode}` : '')
              }
              onClick={() => setViewMode('week')}
            >
              Tuần
            </button>
            <button
              type="button"
              className={
                styles.calendarModeBtn + (viewMode === 'month' ? ` ${styles.activeMode}` : '')
              }
              onClick={() => setViewMode('month')}
            >
              Tháng
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {viewMode === 'week' ? (
              <>
                <button
                  type="button"
                  className={styles.calendarNavBtn}
                  onClick={() => handleWeekNavigate(-1)}
                  disabled={loading}
                >
                  ◀ Tuần trước
                </button>
                <button
                  type="button"
                  className={styles.calendarNavBtn}
                  onClick={() => handleWeekNavigate(1)}
                  disabled={loading}
                >
                  Tuần sau ▶
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={styles.calendarNavBtn}
                  onClick={() => setMonthStart((m) => m.subtract(1, 'month'))}
                  disabled={loading}
                >
                  ◀ Tháng trước
                </button>
                <button
                  type="button"
                  className={styles.calendarNavBtn}
                  onClick={() => setMonthStart((m) => m.add(1, 'month'))}
                  disabled={loading}
                >
                  Tháng sau ▶
                </button>
              </>
            )}
          </div>
        </div>

        <div className={styles.calendarTitle}>
          {viewMode === 'week' ? weekLabel : monthStart.format('MMMM YYYY')}
        </div>
      </div>
      <div className={viewMode === 'week' ? styles.calendarWeekGrid : styles.calendarMonthGrid}>
        {viewMode === 'week'
          ? weekDays.map((day) => {
              const list = weekShiftsByDay[day.key] || [];
              const isToday = day.date.isSame(dayjs(), 'day');
              return (
                <div key={day.key} className={styles.calendarColumn}>
                  <div
                    className={`${styles.calendarColumnHeader} ${
                      isToday ? styles.calendarToday : ''
                    }`}
                  >
                    <div className={styles.calendarDayName}>{day.label}</div>
                    <div className={styles.calendarDate}>{day.date.format('DD/MM')}</div>
                  </div>
                  <div className={styles.calendarColumnBody}>
                    {list.length === 0 ? (
                      <div className={styles.calendarEmpty}>Không có ca</div>
                    ) : (
                      list.map((shift) => (
                        <div
                          key={shift._id}
                          className={styles.calendarShift}
                          style={{
                            borderLeft: `4px solid ${shift.shiftTemplate?.color || '#6366f1'}`,
                          }}
                        >
                          <div className={styles.calendarShiftTime}>{formatRange(shift)}</div>
                          <div className={styles.calendarShiftMeta}>
                            <div className={styles.calendarShiftTemplate}>
                              {shift.shiftTemplate?.name || 'Ca tuỳ chỉnh'}
                            </div>
                            <span className={`${styles.badge} ${STATUS_BADGE[shift.status] || ''}`}>
                              {shift.status}
                            </span>
                          </div>
                          {shift.notes ? (
                            <div className={styles.calendarShiftNote}>{shift.notes}</div>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })
          : // month view: show days of month in simple grid grouped by date
            (() => {
              const start = monthStart.startOf('month');
              const end = monthStart.endOf('month');
              // build array of days for month
              const days = [];
              for (let d = start.clone(); d.isBefore(end) || d.isSame(end); d = d.add(1, 'day')) {
                days.push(d.clone());
              }
              return days.map((date) => {
                const key = date.format('YYYY-MM-DD');
                const list = shifts.filter((s) => dayjs(s.date).format('YYYY-MM-DD') === key);
                const isToday = date.isSame(dayjs(), 'day');
                return (
                  <div key={key} className={styles.calendarColumn}>
                    <div
                      className={`${styles.calendarColumnHeader} ${
                        isToday ? styles.calendarToday : ''
                      }`}
                    >
                      <div className={styles.calendarDayName}>{date.format('ddd')}</div>
                      <div className={styles.calendarDate}>{date.format('DD/MM')}</div>
                    </div>
                    <div className={styles.calendarColumnBody}>
                      {list.length === 0 ? (
                        <div className={styles.calendarEmpty}>Không có ca</div>
                      ) : (
                        list.map((shift) => (
                          <div
                            key={shift._id}
                            className={styles.calendarShift}
                            style={{
                              borderLeft: `4px solid ${shift.shiftTemplate?.color || '#6366f1'}`,
                            }}
                          >
                            <div className={styles.calendarShiftTime}>{formatRange(shift)}</div>
                            <div className={styles.calendarShiftMeta}>
                              <div className={styles.calendarShiftTemplate}>
                                {shift.shiftTemplate?.name || 'Ca tuỳ chỉnh'}
                              </div>
                              <span
                                className={`${styles.badge} ${STATUS_BADGE[shift.status] || ''}`}
                              >
                                {shift.status}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              });
            })()}
      </div>
    </div>
  );

  const renderCalendarModal = () => (
    <div
      className={styles.calendarModalOverlay}
      role="presentation"
      onClick={() => setShowCalendarModal(false)}
    >
      <div
        className={styles.calendarModal}
        role="dialog"
        aria-modal="true"
        aria-label="Lịch ca của tôi"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className={styles.calendarModalClose}
          onClick={() => setShowCalendarModal(false)}
        >
          ✕
        </button>
        <div className={styles.calendarModalBody}>{renderCalendar()}</div>
      </div>
    </div>
  );

  return (
    <div className={styles.wrap}>
      <div className={styles.gridThree}>
        <div className={styles.summaryCard}>
          <h2 className={styles.sectionTitle}>Ca sắp tới</h2>
          {upcoming.length === 0 ? (
            <div className={styles.empty}>Không có ca sắp tới</div>
          ) : (
            upcoming.slice(0, 3).map((shift) => (
              <div
                key={shift._id}
                style={{
                  borderLeft: `4px solid ${shift.shiftTemplate?.color || '#6366f1'}`,
                  paddingLeft: 12,
                }}
              >
                <div style={{ fontWeight: 700 }}>{dayjs(shift.date).format('dddd, DD/MM')}</div>
                <div style={{ color: '#1e293b', marginTop: 4 }}>{formatRange(shift)}</div>
              </div>
            ))
          )}
        </div>
        <div className={styles.summaryCard}>
          <h2 className={styles.sectionTitle}>Tổng quan</h2>
          <div>
            Số ca đã phân: <strong>{summary.total}</strong>
          </div>
          <div>
            Trong tháng này: <strong>{summary.monthCount}</strong>
          </div>
          <div>
            Ước tính giờ làm tháng: <strong>{summary.hours}h</strong>
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div>
            <h2 className={styles.sectionTitle}>Lịch ca</h2>
            <p className={styles.sectionSubtext}>
              Bấm "Xem lịch ca" để mở lịch tuần và điều hướng giữa các ngày.
            </p>
          </div>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => setShowCalendarModal(true)}
            disabled={loading}
          >
            Xem lịch ca
          </button>
        </div>
      </div>

      <div className={styles.tableWrap}>
        <h2 className={styles.sectionTitle} style={{ marginBottom: 16 }}>
          Danh sách ca của tôi
        </h2>
        {shifts.length === 0 ? (
          <div className={styles.empty}>Chưa có ca làm được giao</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Giờ</th>
                <th>Trạng thái</th>
                <th>Ghi chú</th>
                <th>Mã ca</th>
              </tr>
            </thead>
            <tbody>
              {shifts
                .filter((shift) => {
                  const st = (shift.status || '').toLowerCase();
                  if (st === 'completed') return false;
                  if (isShiftInProgress(shift)) return false;
                  return true;
                })
                .map((shift) => (
                  <tr key={shift._id}>
                    <td>{dayjs(shift.date).format('DD/MM/YYYY')}</td>
                    <td>{formatRange(shift)}</td>
                    <td>
                      <span className={`${styles.badge} ${STATUS_BADGE[shift.status] || ''}`}>
                        {shift.status}
                      </span>
                    </td>
                    <td style={{ maxWidth: 220 }}>{shift.notes || '—'}</td>
                    <td>{shift._id}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>

      <div className={styles.summaryCard}>
        <h2 className={styles.sectionTitle}>Gửi yêu cầu đổi ca</h2>
        <form className={styles.formStack} onSubmit={handleSubmitSwap}>
          <label>
            Chọn ca của bạn (Mã ca)
            <select
              className={styles.select}
              value={form.fromShiftId}
              onChange={(e) => setForm((prev) => ({ ...prev, fromShiftId: e.target.value }))}
              required
            >
              <option value="">Chọn...</option>
              {shifts
                .filter((shift) => {
                  const st = (shift.status || '').toLowerCase();
                  if (st === 'completed') return false;
                  if (isShiftInProgress(shift)) return false;
                  return true;
                })
                .map((shift) => (
                  <option key={shift._id} value={shift._id}>
                    {dayjs(shift.date).format('DD/MM')} – {formatRange(shift)}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Ca muốn đổi (tuỳ chọn)
            <select
              className={styles.select}
              value={form.targetShiftId}
              onChange={(e) => setForm((prev) => ({ ...prev, targetShiftId: e.target.value }))}
            >
              <option value="">Không chọn (chỉ huỷ / xin đổi tự do)</option>
              {swapTargets.map((s) => (
                <option key={s._id} value={s._id}>
                  {dayjs(s.date).format('DD/MM')} – {formatRange(s)} – {s.staff?.name || 'NV'}
                </option>
              ))}
            </select>
          </label>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            Nếu không chọn ca mục tiêu, yêu cầu sẽ là xin huỷ/đổi ca gốc. Chọn một ca khác để hệ
            thống tự hoán đổi nhân viên giữa hai ca.
          </div>
          <label>
            Lý do
            <textarea
              className={styles.textarea}
              rows={3}
              value={form.reason}
              onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
              placeholder="Ví dụ: bận lịch học, muốn đổi sang ca chiều..."
            />
          </label>
          <button className={styles.btnPrimary} type="submit" disabled={loading || submitting}>
            Gửi yêu cầu
          </button>
        </form>
      </div>
      {showCalendarModal ? renderCalendarModal() : null}
    </div>
  );
}
