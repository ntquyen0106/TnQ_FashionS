import { useEffect, useState } from 'react';
import { staffApi } from '@/api';
import styles from './PersonalStatsPage.module.css';

export default function PersonalStatsPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [from, setFrom] = useState(''); // yyyy-mm-dd
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('');

  const load = async () => {
    setLoading(true);
    setErr('');
    try {
      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;
      const data = await staffApi.statsMe(params);
      setStats(data);
    } catch (e) {
      setErr(e?.response?.data?.message || 'Không tải được thống kê');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const formatMinutesToHours = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}p` : `${h}h`;
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  };

  // Get status badge color
  const getStatusColor = (value, type) => {
    if (type === 'attendance') {
      if (value >= 90) return styles.statusGood;
      if (value >= 70) return styles.statusWarning;
      return styles.statusBad;
    }
    if (type === 'completion') {
      if (value >= 80) return styles.statusGood;
      if (value >= 60) return styles.statusWarning;
      return styles.statusBad;
    }
    return '';
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h2 className={styles.title}>📊 Thống kê cá nhân</h2>
        {stats?.period && (
          <div className={styles.period}>
            Kỳ: {stats.period.from} → {stats.period.to}
          </div>
        )}
      </div>
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <label className={styles.fItem}>
            Từ ngày
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className={styles.fItem}>
            Đến ngày
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label className={styles.fItem}>
            Trạng thái
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Tất cả</option>
              <option value="PENDING">Chờ xác nhận</option>
              <option value="CONFIRMED">Đã xác nhận</option>
              <option value="SHIPPING">Vận chuyển</option>
              <option value="DELIVERING">Đang giao</option>
              <option value="DONE">Hoàn tất</option>
              <option value="CANCELLED">Đã hủy</option>
              <option value="RETURNED">Trả/Hoàn tiền</option>
            </select>
          </label>
          <div className={styles.presets}>
            <button
              type="button"
              className={`btn ${styles.btnLight}`}
              onClick={() => {
                const now = new Date();
                const yyyy = now.getFullYear();
                const mm = String(now.getMonth() + 1).padStart(2, '0');
                const dd = String(now.getDate()).padStart(2, '0');
                const d = `${yyyy}-${mm}-${dd}`;
                setFrom(d);
                setTo(d);
                setTimeout(load, 0);
              }}
            >
              Hôm nay
            </button>
            <button
              type="button"
              className={`btn ${styles.btnLight}`}
              onClick={() => {
                const now = new Date();
                const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const start = new Date(end);
                start.setDate(start.getDate() - 6); // 7 ngày tính cả hôm nay
                const fmt = (d) => {
                  const yyyy = d.getFullYear();
                  const mm = String(d.getMonth() + 1).padStart(2, '0');
                  const dd = String(d.getDate()).padStart(2, '0');
                  return `${yyyy}-${mm}-${dd}`;
                };
                setFrom(fmt(start));
                setTo(fmt(end));
                setTimeout(load, 0);
              }}
            >
              7 ngày qua
            </button>
            <button
              type="button"
              className={`btn ${styles.btnLight}`}
              onClick={() => {
                const now = new Date();
                const start = new Date(now.getFullYear(), now.getMonth(), 1);
                const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                const fmt = (d) => {
                  const yyyy = d.getFullYear();
                  const mm = String(d.getMonth() + 1).padStart(2, '0');
                  const dd = String(d.getDate()).padStart(2, '0');
                  return `${yyyy}-${mm}-${dd}`;
                };
                setFrom(fmt(start));
                setTo(fmt(end));
                setTimeout(load, 0);
              }}
            >
              Tháng này
            </button>
          </div>
        </div>
        <div className={styles.actions}>
          <button className="btn" onClick={load} disabled={loading}>
            {loading ? 'Đang lọc…' : 'Áp dụng'}
          </button>
          {(from || to || status) && (
            <button
              className={`btn ${styles.btnSecondary}`}
              onClick={() => {
                setFrom('');
                setTo('');
                setStatus('');
                setTimeout(load, 0);
              }}
            >
              Xóa lọc
            </button>
          )}
        </div>
      </div>
      {loading && <div className={styles.loading}>Đang tải…</div>}
      {err && <div className={styles.err}>{err}</div>}

      {stats && (
        <>
          {/* Alerts Section */}
          {stats.alerts && stats.alerts.length > 0 && (
            <div className={styles.alertsSection}>
              {stats.alerts.map((alert, idx) => (
                <div key={idx} className={`${styles.alert} ${styles[`alert-${alert.severity}`]}`}>
                  {alert.severity === 'warning' && '⚠️ '}
                  {alert.severity === 'info' && 'ℹ️ '}
                  {alert.message}
                </div>
              ))}
            </div>
          )}

          {/* Row 1: Chấm công */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>✅ Chấm công</h3>
            <div className={styles.gridRow}>
              <div className={`${styles.card} ${styles.cardHighlight}`}>
                <div className={styles.cardIcon}>📊</div>
                <div className={styles.label}>Tỷ lệ chấm công</div>
                <div
                  className={`${styles.value} ${getStatusColor(
                    stats.shifts?.attendanceRatePct || 0,
                    'attendance',
                  )}`}
                >
                  {stats.shifts?.attendanceRatePct || 0}%
                </div>
              </div>
              <div className={styles.card}>
                <div className={styles.cardIcon}>📅</div>
                <div className={styles.label}>Ca được phân</div>
                <div className={styles.value}>{stats.shifts?.scheduledCount || 0}</div>
              </div>
              <div className={styles.card}>
                <div className={styles.cardIcon}>✅</div>
                <div className={styles.label}>Ca hoàn tất</div>
                <div className={styles.value}>{stats.shifts?.completedCount || 0}</div>
              </div>
              <div className={styles.card}>
                <div className={styles.cardIcon}>⏰</div>
                <div className={styles.label}>Tổng giờ làm</div>
                <div className={styles.value}>
                  {formatMinutesToHours(stats.shifts?.workedMinutes || 0)}
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Đơn hàng */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>📦 Đơn hàng</h3>
            <div className={styles.gridRow}>
              <div className={styles.card}>
                <div className={styles.cardIcon}>📋</div>
                <div className={styles.label}>Tổng đơn</div>
                <div className={styles.value}>{stats.orders?.total || 0}</div>
              </div>
              <div className={`${styles.card} ${styles.cardHighlight}`}>
                <div className={styles.cardIcon}>📈</div>
                <div className={styles.label}>Tỷ lệ hoàn thành</div>
                <div
                  className={`${styles.value} ${getStatusColor(
                    stats.orders?.completionRatePct || 0,
                    'completion',
                  )}`}
                >
                  {stats.orders?.completionRatePct || 0}%
                </div>
              </div>
              <div className={styles.card}>
                <div className={styles.cardIcon}>💰</div>
                <div className={styles.label}>Giá trị đã xử lý</div>
                <div className={styles.valueMoney}>
                  {formatCurrency(stats.orders?.handledValueTotal || 0)}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
