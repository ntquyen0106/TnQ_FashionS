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
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ fromShiftId: '', targetShiftId: '', reason: '' });
  const [weekStart, setWeekStart] = useState(() => dayjs().startOf('week'));
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
      setShifts(Array.isArray(res) ? res : res?.items || []);
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
        </div>
        <div className={styles.calendarTitle}>{weekLabel}</div>
      </div>
      <div className={styles.calendarGrid}>
        {weekDays.map((day) => {
          const list = weekShiftsByDay[day.key] || [];
          const isToday = day.date.isSame(dayjs(), 'day');
          return (
            <div key={day.key} className={styles.calendarColumn}>
              <div
                className={`${styles.calendarColumnHeader} ${isToday ? styles.calendarToday : ''}`}
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
        })}
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
              {shifts.map((shift) => (
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
              {shifts.map((shift) => (
                <option key={shift._id} value={shift._id}>
                  {dayjs(shift.date).format('DD/MM')} – {formatRange(shift)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ca muốn đổi (Mã ca, tuỳ chọn)
            <input
              className={styles.input}
              value={form.targetShiftId}
              onChange={(e) => setForm((prev) => ({ ...prev, targetShiftId: e.target.value }))}
              placeholder="Nhập mã ca nếu muốn đổi trực tiếp"
            />
          </label>
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
