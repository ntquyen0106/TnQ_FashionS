import { useEffect, useState } from 'react';
import { ordersApi } from '@/api';
import styles from './PersonalStatsPage.module.css';

export default function PersonalStatsPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [from, setFrom] = useState(''); // yyyy-mm-dd
  const [to, setTo] = useState('');
  const [status, setStatus] = useState(''); // '', 'PENDING', 'DONE', 'CANCELLED', ...

  const load = async () => {
    setLoading(true);
    setErr('');
    try {
      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;
      if (status) params.status = status;
      const data = await ordersApi.statsMe(params);
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

  const done = stats?.done || 0;
  const total = stats?.total || 0;
  const rate = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className={styles.wrap}>
      <h2 className={styles.title}>Thống kê cá nhân</h2>
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
      {loading && <div>Đang tải…</div>}
      {err && <div className={styles.err}>{err}</div>}
      {stats && (
        <div className={styles.grid}>
          <div className={styles.card}>
            <div className={styles.label}>Tổng đơn</div>
            <div className={styles.value}>{total}</div>
          </div>
          <div className={styles.card}>
            <div className={styles.label}>Hoàn tất</div>
            <div className={styles.value}>{done}</div>
          </div>
          <div className={styles.card}>
            <div className={styles.label}>Tỉ lệ hoàn thành</div>
            <div className={styles.value}>{rate}%</div>
          </div>
          <div className={styles.card}>
            <div className={styles.label}>Đang chờ</div>
            <div className={styles.value}>{stats?.pending || 0}</div>
          </div>
        </div>
      )}
    </div>
  );
}
