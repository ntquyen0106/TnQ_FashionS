import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ordersApi from '@/api/orders-api';
import styles from './MyOrders.module.css';

const fmtVND = (n) => new Intl.NumberFormat('vi-VN').format(Number(n) || 0);
const fmtDate = (d) => new Date(d).toLocaleString('vi-VN');

// Accent-insensitive normalizer for robust search (Vietnamese diacritics)
const normalize = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();

const STATUS_LABEL = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  SHIPPING: 'Vận chuyển',
  DELIVERING: 'Đang giao',
  DONE: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
  RETURNED: 'Trả hàng/Hoàn tiền',
};

const STATUS_KEYS = [
  'ALL',
  'PENDING',
  'CONFIRMED',
  'SHIPPING',
  'DELIVERING',
  'DONE',
  'CANCELLED',
  'RETURNED',
];
const PM_LABEL = {
  COD: 'Thanh toán khi nhận hàng',
  BANK: 'Thanh toán online',
};

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    (async () => {
      try {
        const res = await ordersApi.listMine();
        setOrders(res.items || []);
      } catch (e) {
        setOrders([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const term = normalize(q);
    return (orders || []).filter((o) => {
      const code = String(o.code || o._id || '');
      const codeNorm = normalize(code);
      const namesJoined = (o.items || []).map((it) => it?.nameSnapshot || it?.name || '').join(' ');
      const namesNorm = normalize(namesJoined);
      const byText = !term || codeNorm.includes(term) || namesNorm.includes(term);
      const byStatus = filter === 'ALL' || String(o.status) === filter;
      return byText && byStatus;
    });
  }, [orders, q, filter]);

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h2>Đơn hàng của tôi</h2>
        <div className={styles.tools}>
          <div className={styles.tabs}>
            {STATUS_KEYS.map((s) => (
              <button
                key={s}
                className={`${styles.tab} ${filter === s ? styles.active : ''}`}
                onClick={() => setFilter(s)}
              >
                {s === 'ALL' ? 'Tất cả' : STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          <div className={styles.searchBox}>
            <svg
              className={styles.searchIcon}
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm theo mã đơn hoặc sản phẩm..."
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>Đang tải đơn hàng…</div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>Chưa có đơn hàng</div>
      ) : (
        <div className={styles.list}>
          {filtered.map((o) => {
            const total = o.amounts?.grandTotal ?? 0;
            const sub = o.amounts?.subtotal ?? 0;
            const discount = o.amounts?.discount ?? 0;
            const status = String(o.status);
            const label = STATUS_LABEL[status] || status;
            const first = (o.items && o.items[0]) || null;
            const img = first?.imageSnapshot
              ? /^https?:\/\//i.test(first.imageSnapshot)
                ? first.imageSnapshot
                : `https://res.cloudinary.com/${
                    import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
                  }/image/upload/f_auto,q_auto,dpr_auto,w_80/${encodeURIComponent(
                    first.imageSnapshot,
                  ).replace(/%2F/g, '/')}`
              : '/no-image.png';
            return (
              <Link to={`/orders/${o._id}`} className={styles.card}>
                <div className={styles.rowTop}>
                  <div className={styles.prodHead}>
                    <img src={img} alt={first?.nameSnapshot || 'Sản phẩm'} />
                    <div className={styles.prodMeta}>
                      <div className={styles.prodName}>
                        {first?.nameSnapshot || 'Sản phẩm'}
                        {o.items?.length > 1 && (
                          <span className={styles.more}> +{o.items.length - 1} sản phẩm</span>
                        )}
                      </div>
                      {/* Ẩn mã đơn ở danh sách theo yêu cầu */}
                      <div className={styles.codeSmall} style={{ visibility: 'hidden', height: 0 }}>
                        &nbsp;
                      </div>
                    </div>
                  </div>
                  <div className={`${styles.chip} ${styles[`st_${status}`]}`}>{label}</div>
                </div>

                <div className={styles.rowMid}>
                  {/* <div>
                    <div className={styles.k}>Ngày đặt</div>
                    <div className={styles.v}>{fmtDate(o.createdAt)}</div>
                  </div> */}
                  <div>
                    <div className={styles.k}>Sản phẩm</div>
                    <div className={styles.v}>{o.items?.length || 0} mặt hàng</div>
                  </div>
                  <div>
                    <div className={styles.k}>Phương thức</div>
                    <div className={styles.v}>
                      {PM_LABEL[o.paymentMethod] || o.paymentMethod || '—'}
                    </div>
                  </div>
                  <div>
                    <div className={styles.k}>Tạm tính</div>
                    <div className={styles.v}>{fmtVND(sub)}₫</div>
                  </div>
                  <div>
                    <div className={styles.k}>Giảm giá</div>
                    <div className={styles.v}>-{fmtVND(discount)}₫</div>
                  </div>
                </div>

                <div className={styles.rowBot}>
                  <div className={styles.total}>
                    Tổng thanh toán: <strong>{fmtVND(total)}₫</strong>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
