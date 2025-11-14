import { useEffect, useState } from 'react';
import { staffApi } from '@/api';
import styles from './PersonalStatsPage.module.css';

export default function PersonalStatsPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [from, setFrom] = useState(''); // yyyy-mm-dd
  const [to, setTo] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // overview, shifts, orders, productivity

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
              <h3 className={styles.sectionTitle}>⚠️ Cảnh báo</h3>
              {stats.alerts.map((alert, idx) => (
                <div key={idx} className={`${styles.alert} ${styles[`alert-${alert.severity}`]}`}>
                  {alert.severity === 'warning' && '⚠️ '}
                  {alert.severity === 'info' && 'ℹ️ '}
                  {alert.message}
                </div>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div className={styles.tabs}>
            <button
              className={activeTab === 'overview' ? styles.tabActive : styles.tab}
              onClick={() => setActiveTab('overview')}
            >
              Tổng quan
            </button>
            <button
              className={activeTab === 'shifts' ? styles.tabActive : styles.tab}
              onClick={() => setActiveTab('shifts')}
            >
              Ca làm & Chấm công
            </button>
            <button
              className={activeTab === 'orders' ? styles.tabActive : styles.tab}
              onClick={() => setActiveTab('orders')}
            >
              Đơn hàng
            </button>
            <button
              className={activeTab === 'productivity' ? styles.tabActive : styles.tab}
              onClick={() => setActiveTab('productivity')}
            >
              Năng suất
            </button>
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className={styles.grid}>
              <div className={`${styles.card} ${styles.cardHighlight}`}>
                <div className={styles.cardIcon}>✅</div>
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
                <div className={styles.label}>Tổng ca được phân</div>
                <div className={styles.value}>{stats.shifts?.scheduledCount || 0}</div>
              </div>
              <div className={styles.card}>
                <div className={styles.cardIcon}>⏰</div>
                <div className={styles.label}>Thời gian làm việc</div>
                <div className={styles.value}>
                  {formatMinutesToHours(stats.shifts?.workedMinutes || 0)}
                </div>
              </div>
              <div className={styles.card}>
                <div className={styles.cardIcon}>⏱️</div>
                <div className={styles.label}>Làm thêm giờ</div>
                <div className={styles.value}>
                  {formatMinutesToHours(stats.shifts?.overtimeMinutes || 0)}
                </div>
              </div>
              <div className={styles.card}>
                <div className={styles.cardIcon}>📦</div>
                <div className={styles.label}>Tổng đơn hàng</div>
                <div className={styles.value}>{stats.orders?.total || 0}</div>
              </div>
              <div className={styles.card}>
                <div className={styles.cardIcon}>✔️</div>
                <div className={styles.label}>Hoàn tất</div>
                <div className={styles.value}>{stats.orders?.done || 0}</div>
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
                <div className={styles.cardIcon}>⚡</div>
                <div className={styles.label}>Đơn/giờ làm</div>
                <div className={styles.value}>{stats.productivity?.ordersPerWorkedHour || 0}</div>
              </div>
            </div>
          )}

          {/* Shifts Tab */}
          {activeTab === 'shifts' && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>📅 Ca làm việc & Chấm công</h3>
              <div className={styles.grid}>
                <div className={styles.card}>
                  <div className={styles.cardIcon}>📋</div>
                  <div className={styles.label}>Ca được phân</div>
                  <div className={styles.value}>{stats.shifts?.scheduledCount || 0}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardIcon}>✅</div>
                  <div className={styles.label}>Ca hoàn tất</div>
                  <div className={styles.value}>{stats.shifts?.completedCount || 0}</div>
                </div>
                <div
                  className={`${styles.card} ${
                    (stats.shifts?.missedCount || 0) > 0 ? styles.cardDanger : ''
                  }`}
                >
                  <div className={styles.cardIcon}>❌</div>
                  <div className={styles.label}>Ca vắng</div>
                  <div className={styles.value}>{stats.shifts?.missedCount || 0}</div>
                </div>
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
                  <div className={styles.cardIcon}>🕐</div>
                  <div className={styles.label}>Thời gian ca (dự kiến)</div>
                  <div className={styles.value}>
                    {formatMinutesToHours(stats.shifts?.scheduledMinutes || 0)}
                  </div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardIcon}>⏰</div>
                  <div className={styles.label}>Thời gian thực làm</div>
                  <div className={styles.value}>
                    {formatMinutesToHours(stats.shifts?.workedMinutes || 0)}
                  </div>
                </div>
                <div
                  className={`${styles.card} ${
                    (stats.shifts?.overtimeMinutes || 0) > 0 ? styles.cardWarning : ''
                  }`}
                >
                  <div className={styles.cardIcon}>⏱️</div>
                  <div className={styles.label}>Làm thêm giờ</div>
                  <div className={styles.value}>
                    {formatMinutesToHours(stats.shifts?.overtimeMinutes || 0)}
                  </div>
                </div>
                <div
                  className={`${styles.card} ${
                    (stats.shifts?.lateCheckIns?.count || 0) > 0 ? styles.cardWarning : ''
                  }`}
                >
                  <div className={styles.cardIcon}>🕐</div>
                  <div className={styles.label}>Số lần đi trễ</div>
                  <div className={styles.value}>
                    {stats.shifts?.lateCheckIns?.count || 0}
                    {stats.shifts?.lateCheckIns?.count > 0 && (
                      <small className={styles.subtext}>
                        (~{stats.shifts.lateCheckIns.avgMinutesLate}p/lần)
                      </small>
                    )}
                  </div>
                </div>
                <div
                  className={`${styles.card} ${
                    (stats.shifts?.lateCheckIns?.totalMinutes || 0) > 0 ? styles.cardWarning : ''
                  }`}
                >
                  <div className={styles.cardIcon}>⏲️</div>
                  <div className={styles.label}>Tổng phút đi trễ</div>
                  <div className={styles.value}>
                    {stats.shifts?.lateCheckIns?.totalMinutes || 0}{' '}
                    <small className={styles.unit}>phút</small>
                  </div>
                </div>
                <div
                  className={`${styles.card} ${
                    (stats.shifts?.earlyCheckOuts?.count || 0) > 0 ? styles.cardWarning : ''
                  }`}
                >
                  <div className={styles.cardIcon}>🏃</div>
                  <div className={styles.label}>Số lần về sớm</div>
                  <div className={styles.value}>
                    {stats.shifts?.earlyCheckOuts?.count || 0}
                    {stats.shifts?.earlyCheckOuts?.count > 0 && (
                      <small className={styles.subtext}>
                        (~{stats.shifts.earlyCheckOuts.avgMinutesEarly}p/lần)
                      </small>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Orders Tab */}
          {activeTab === 'orders' && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>📦 Đơn hàng</h3>
              <div className={styles.grid}>
                <div className={styles.card}>
                  <div className={styles.cardIcon}>📋</div>
                  <div className={styles.label}>Tổng đơn</div>
                  <div className={styles.value}>{stats.orders?.total || 0}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardIcon}>✅</div>
                  <div className={styles.label}>Hoàn tất</div>
                  <div className={styles.value}>{stats.orders?.done || 0}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardIcon}>⏳</div>
                  <div className={styles.label}>Đang chờ</div>
                  <div className={styles.value}>{stats.orders?.pending || 0}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardIcon}>❌</div>
                  <div className={styles.label}>Đã hủy</div>
                  <div className={styles.value}>{stats.orders?.cancelled || 0}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardIcon}>↩️</div>
                  <div className={styles.label}>Trả/Hoàn</div>
                  <div className={styles.value}>{stats.orders?.returned || 0}</div>
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
                <div className={styles.card}>
                  <div className={styles.cardIcon}>💵</div>
                  <div className={styles.label}>Giá trị TB/đơn</div>
                  <div className={styles.valueMoney}>
                    {formatCurrency(stats.orders?.avgOrderValue || 0)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Productivity Tab */}
          {activeTab === 'productivity' && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>⚡ Năng suất làm việc</h3>
              <div className={styles.grid}>
                <div className={`${styles.card} ${styles.cardHighlight}`}>
                  <div className={styles.cardIcon}>⚡</div>
                  <div className={styles.label}>Đơn/giờ làm việc</div>
                  <div className={styles.value}>{stats.productivity?.ordersPerWorkedHour || 0}</div>
                </div>
                <div className={`${styles.card} ${styles.cardHighlight}`}>
                  <div className={styles.cardIcon}>💰</div>
                  <div className={styles.label}>Doanh thu/giờ làm việc</div>
                  <div className={styles.valueMoney}>
                    {formatCurrency(stats.productivity?.valuePerWorkedHour || 0)}
                  </div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardIcon}>📊</div>
                  <div className={styles.label}>Tỷ lệ sử dụng ca</div>
                  <div className={styles.value}>
                    {stats.shifts?.scheduledMinutes > 0
                      ? Math.round(
                          ((stats.shifts?.workedMinutes || 0) / stats.shifts.scheduledMinutes) *
                            100,
                        )
                      : 0}
                    %
                  </div>
                </div>
              </div>

              {/* Per Day Chart */}
              {stats.perDay && stats.perDay.length > 0 && (
                <div className={styles.chartSection}>
                  <h4 className={styles.chartTitle}>📈 Biểu đồ theo ngày</h4>
                  <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>📅 Ngày</th>
                          <th>🕐 Giờ dự kiến</th>
                          <th>⏰ Giờ làm thực</th>
                          <th>⏱️ Làm thêm</th>
                          <th>📦 Đơn hàng</th>
                          <th>✅ Hoàn tất</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.perDay.map((day) => (
                          <tr key={day.date}>
                            <td className={styles.dateCell}>{day.date}</td>
                            <td>{formatMinutesToHours(day.scheduledMinutes)}</td>
                            <td>
                              <strong>{formatMinutesToHours(day.workedMinutes)}</strong>
                            </td>
                            <td className={day.overtimeMinutes > 0 ? styles.overtimeCell : ''}>
                              {formatMinutesToHours(day.overtimeMinutes)}
                            </td>
                            <td>{day.totalOrders}</td>
                            <td className={styles.doneCell}>{day.doneOrders}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
