import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ordersApi } from '@/api';
import ConfirmModal from '@/components/ConfirmModal';
import styles from './OrderQueuePage.module.css';

export default function OrderQueuePage() {
  const [queue, setQueue] = useState([]);
  const [q, setQ] = useState('');
  const [claiming, setClaiming] = useState({});
  const [err, setErr] = useState('');
  const [confirm, setConfirm] = useState({ open: false, id: null });
  const navigate = useNavigate();

  const load = async () => {
    try {
      setErr('');
      // Luôn lọc đơn chưa gán ở trạng thái pending
      const params = { unassigned: true, status: 'pending' };
      const data = await ordersApi.list(params);
      setQueue(data.items || data || []);
    } catch (e) {
      console.error(e);
      setErr(e?.response?.data?.message || 'Không tải được danh sách');
      setQueue([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const claim = async (orderId) => {
    setClaiming((x) => ({ ...x, [orderId]: true }));
    try {
      await ordersApi.claim(orderId);
      // Sau khi nhận đơn, chuyển sang "Đơn hàng của tôi"
      navigate('/dashboard/my-orders');
    } finally {
      setClaiming((x) => ({ ...x, [orderId]: false }));
    }
  };

  const askCancel = (orderId) => {
    setConfirm({ open: true, id: orderId });
  };

  const doCancel = async () => {
    const id = confirm.id;
    if (!id) return setConfirm({ open: false, id: null });
    try {
      await ordersApi.updateStatus(id, 'canceled');
      await load();
    } finally {
      setConfirm({ open: false, id: null });
    }
  };

  // Search/filter by code, customer name, phone, item name/SKU
  const term = q.trim().toLowerCase();
  const filteredQueue = term
    ? (queue || []).filter((o) => {
        const code = String(o.code || o._id || '').toLowerCase();
        const name = String(
          (o.shippingAddress && o.shippingAddress.fullName) || o.customerName || '',
        ).toLowerCase();
        const phone = String(
          (o.shippingAddress && o.shippingAddress.phone) || o.customerPhone || '',
        ).toLowerCase();
        const itemText = (o.items || [])
          .map((it) => `${it?.nameSnapshot || it?.name || ''} ${it?.variantSku || ''}`)
          .join(' ')
          .toLowerCase();
        return (
          code.includes(term) ||
          name.includes(term) ||
          phone.includes(term) ||
          itemText.includes(term)
        );
      })
    : queue;

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <h2 className={styles.title}>Hàng đợi đơn hàng</h2>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.toolLeft}>
          <span className={styles.hint}>Đơn PENDING: {queue.length}</span>
        </div>
        <div className={styles.toolRight}>
          <div className={styles.searchBox}>
            <svg
              className={styles.searchIcon}
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
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
              placeholder="Tìm mã đơn, tên, SĐT, SKU..."
            />
          </div>
          {err && <span style={{ color: 'crimson' }}>{err}</span>}
          <button className={`btn ${styles.btnSecondary}`} onClick={load}>
            Tải lại
          </button>
        </div>
      </div>

      <div className={styles.list}>
        <div className={`${styles.row} ${styles.headerRow}`}>
          <div className={`${styles.cell} ${styles.th}`}>Mã đơn</div>
          <div className={`${styles.cell} ${styles.th}`}>Khách hàng</div>
          <div className={`${styles.cell} ${styles.th}`}>Tổng</div>
          <div className={`${styles.cell} ${styles.th}`}>Ngày tạo</div>
          <div className={`${styles.cell} ${styles.th}`} />
        </div>

        {filteredQueue.map((o) => {
          const id = o.id || o._id;
          return (
            <div
              className={`${styles.row} ${styles.clickable || ''}`}
              key={id}
              tabIndex={0}
              onClick={() =>
                navigate(`/orders/${id}`, {
                  state: { from: 'staff', backTo: '/dashboard', queue: true },
                })
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  navigate(`/orders/${id}`, {
                    state: { from: 'staff', backTo: '/dashboard', queue: true },
                  });
                }
              }}
            >
              <div className={styles.cell}>
                <span className={styles.code}>{o.code || o._id}</span>
              </div>
              <div className={styles.cell}>
                {(o.shippingAddress?.fullName || o.customerName) ?? ''} ·{' '}
                {(o.shippingAddress?.phone || o.customerPhone) ?? ''}
              </div>
              <div className={styles.cell}>
                {(o.amounts?.grandTotal || o.total || 0).toLocaleString('vi-VN')} đ
              </div>
              <div className={styles.cell}>
                {o.createdAt ? new Date(o.createdAt).toLocaleString('vi-VN') : ''}
              </div>
              <div
                className={styles.cell}
                style={{ textAlign: 'right', display: 'flex', gap: 8, justifyContent: 'flex-end' }}
                onClick={(e) => e.stopPropagation()}
              >
                <button className={`btn ${styles.btnDanger}`} onClick={() => askCancel(id)}>
                  Hủy đơn
                </button>
                <button
                  className={`btn ${styles.btnClaim}`}
                  onClick={() => claim(id)}
                  disabled={!!claiming[id]}
                >
                  Nhận đơn
                </button>
              </div>
            </div>
          );
        })}

        {filteredQueue.length === 0 && (
          <div className={styles.empty}>
            {q ? 'Không có đơn phù hợp.' : 'Không có đơn PENDING.'}
          </div>
        )}
      </div>
      <ConfirmModal
        open={confirm.open}
        title="Xác nhận hủy đơn"
        message="Bạn có chắc muốn hủy đơn hàng này?"
        confirmText="Hủy đơn"
        cancelText="Quay lại"
        confirmType="danger"
        onConfirm={doCancel}
        onCancel={() => setConfirm({ open: false, id: null })}
      />
    </div>
  );
}
