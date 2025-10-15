import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import ordersApi from '@/api/orders-api';
import ConfirmModal from '@/components/ConfirmModal';
import { useAuth } from '@/auth/AuthProvider';
import styles from './OrderDetail.module.css';

const fmtVND = (n) => new Intl.NumberFormat('vi-VN').format(Number(n) || 0);
const STATUS_LABEL = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  SHIPPING: 'Vận chuyển',
  DELIVERING: 'Đang giao',
  DONE: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
  RETURNED: 'Trả hàng/Hoàn tiền',
};

const PM_LABEL = {
  COD: 'Thanh toán khi nhận hàng',
  BANK: 'Thanh toán online',
};

const useCloudImage = () => {
  const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  return (snap, w = 96) => {
    if (!snap) return '/no-image.png';
    if (typeof snap === 'string' && /^https?:\/\//i.test(snap)) return snap;
    const pid = encodeURIComponent(snap).replace(/%2F/g, '/');
    return `https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto,dpr_auto,w_${w}/${pid}`;
  };
};

export default function OrderDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const loc = useLocation();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState({ claim: false, cancel: false });
  const [confirm, setConfirm] = useState(false);
  const [qConfirm, setQConfirm] = useState({ claim: false, cancel: false });
  const [reasons, setReasons] = useState([]);
  const [reasonOther, setReasonOther] = useState('');
  const buildImageUrl = useCloudImage();
  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      const fromStaff = loc.state?.from === 'staff';
      try {
        const res = fromStaff ? await ordersApi.getAny(id) : await ordersApi.get(id);
        setOrder(res || null);
      } catch (e) {
        try {
          const alt = fromStaff ? await ordersApi.get(id) : await ordersApi.getAny(id);
          setOrder(alt || null);
        } catch (e2) {
          setOrder(null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id, loc.state]);

  if (loading) return <div className={styles.wrap}>Đang tải…</div>;
  if (!order) return <div className={styles.wrap}>Không tìm thấy đơn.</div>;

  const amounts = order.amounts || {};
  const addr = order.shippingAddress || {};
  const code = order.code || order._id;
  const status = String(order.status || 'PENDING');
  const pmLabel = PM_LABEL[order.paymentMethod] || order.paymentMethod || '—';
  const canCancel = String(order.status || 'PENDING').toUpperCase() === 'PENDING';
  const isStaff = user && (user.role === 'staff' || user.role === 'admin');
  const inQueue = isStaff && loc.state?.from === 'staff' && loc.state?.queue;

  const nextStatus = (s) => {
    const cur = String(s || '').toLowerCase();
    const map = {
      pending: 'Xác nhận', // PENDING -> CONFIRMED
      confirmed: 'Đang vận chuyển', // CONFIRMED -> SHIPPING
      shipping: 'Đang giao', // SHIPPING -> DELIVERING
      delivering: 'Hoàn tất', // DELIVERING -> DONE
    };
    return map[cur] || '';
  };

  const updateToNext = async () => {
    const to = nextStatus(order.status);
    if (!to) return;
    try {
      await ordersApi.updateStatus(order._id || order.id, to);
      const refreshed = await (loc.state?.from === 'staff'
        ? ordersApi.getAny(id)
        : ordersApi.get(id));
      setOrder(refreshed || null);
    } catch (e) {}
  };

  const claimFromDetail = async () => {
    setActing((x) => ({ ...x, claim: true }));
    try {
      await ordersApi.claim(order._id || order.id);
      nav('/dashboard/my-orders');
    } catch (e) {
      // optional: show an alert on failure
      alert(e?.response?.data?.message || 'Không thể nhận đơn.');
    } finally {
      setActing((x) => ({ ...x, claim: false }));
    }
  };

  const cancelFromDetail = async () => {
    setActing((x) => ({ ...x, cancel: true }));
    try {
      await ordersApi.updateStatus(order._id || order.id, 'canceled');
      nav('/dashboard');
    } catch (e) {
      alert(e?.response?.data?.message || 'Không thể hủy đơn.');
    } finally {
      setActing((x) => ({ ...x, cancel: false }));
    }
  };

  const doCancel = async () => {
    try {
      await ordersApi.cancelMine(order._id || order.id, { reasons, other: reasonOther });
      const res = await ordersApi.get(id);
      setOrder(res || null);
    } finally {
      setConfirm(false);
      setReasons([]);
      setReasonOther('');
    }
  };

  return (
    <div className={styles.wrap}>
      {inQueue && (
        <div className={styles.infoBanner}>
          Đơn này đang ở hàng đợi. Bạn có thể Nhận đơn để xử lý hoặc Hủy đơn nếu cần.
        </div>
      )}
      <div className={styles.header}>
        <button
          className={styles.back}
          onClick={() => {
            const target =
              loc.state?.backTo ||
              (loc.state?.from === 'staff' ? '/dashboard/my-orders' : '/orders');
            // Try history first; if it returns to same page, force navigate
            if (history.length > 1) nav(-1);
            else nav(target);
          }}
          aria-label="Quay lại"
        >
          <span className={styles.arrow}>←</span>
        </button>
        <div className={styles.titleBox}>
          <h2>Chi tiết đơn hàng</h2>
        </div>
        <div className={`${styles.chip} ${styles[`st_${status}`]}`}>
          {STATUS_LABEL[status] || status}
        </div>
      </div>

      <div className={styles.grid}>
        <section className={styles.card}>
          <h3>Thông tin giao hàng</h3>
          <div className={styles.addr}>
            <div>
              <strong>{addr.fullName}</strong> · {addr.phone}
            </div>
            <div className={styles.addrLine}>
              {addr.line1}, {addr.ward}, {addr.district}, {addr.city}
            </div>
          </div>
        </section>

        <section className={styles.card}>
          <h3>Sản phẩm</h3>
          <div className={styles.items}>
            {(order.items || []).map((it, idx) => (
              <div key={idx} className={styles.item}>
                <img src={buildImageUrl(it.imageSnapshot)} alt={it.nameSnapshot} />
                <div className={styles.meta}>
                  <div className={styles.name}>{it.nameSnapshot}</div>
                  {it.variantSku && <div className={styles.sku}>{it.variantSku}</div>}
                </div>
                <div className={styles.unit}>{fmtVND(it.price)}₫</div>
                <div className={styles.qty}>x{it.qty}</div>
                <div className={styles.line}>{fmtVND(it.lineTotal)}₫</div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.card}>
          <h3>Chi tiết đơn hàng</h3>
          <div className={styles.totals}>
            <div>
              <span>Mã đơn</span>
              <span>{code}</span>
            </div>
            <div>
              <span>Ngày đặt</span>
              <span>{new Date(order.createdAt).toLocaleString('vi-VN')}</span>
            </div>
            <div>
              <span>Phương thức</span>
              <span>{pmLabel}</span>
            </div>
            {null}
          </div>
        </section>

        <section className={styles.card}>
          <h3>Thanh toán</h3>
          <div className={styles.totals}>
            <div>
              <span>Tạm tính</span>
              <span>{fmtVND(amounts.subtotal)}₫</span>
            </div>
            <div>
              <span>Giảm giá</span>
              <span>-{fmtVND(amounts.discount)}₫</span>
            </div>
            <div>
              <span>Phí vận chuyển</span>
              <span>{fmtVND(amounts.shippingFee)}₫</span>
            </div>
            <div className={styles.hr} />
            <div className={styles.grand}>
              <span>Tổng thanh toán</span>
              <span>{fmtVND(amounts.grandTotal)}₫</span>
            </div>
          </div>
        </section>
      </div>
      {!inQueue && isStaff && nextStatus(order.status) && (
        <div className={styles.bottomActions}>
          <button className={`btn ${styles.btnPrimary}`} onClick={updateToNext}>
            Chuyển → {nextStatus(order.status)}
          </button>
        </div>
      )}
      {!inQueue && canCancel && (
        <div className={styles.bottomActions}>
          <button className={`btn ${styles.btnDanger}`} onClick={() => setConfirm(true)}>
            Hủy đơn
          </button>
        </div>
      )}

      {inQueue && (
        <div className={styles.bottomActions}>
          <button
            className={`btn ${styles.btnDanger}`}
            onClick={() => setQConfirm((s) => ({ ...s, cancel: true }))}
            disabled={acting.cancel}
          >
            {acting.cancel ? 'Đang hủy…' : 'Hủy đơn'}
          </button>
          <button
            className={`btn ${styles.btnPrimary}`}
            onClick={() => setQConfirm((s) => ({ ...s, claim: true }))}
            disabled={acting.claim}
          >
            {acting.claim ? 'Đang nhận…' : 'Nhận đơn'}
          </button>
        </div>
      )}

      {/* Queue-specific confirmations */}
      <ConfirmModal
        open={inQueue && qConfirm.cancel}
        title="Xác nhận hủy đơn"
        message="Bạn có chắc muốn hủy đơn này?"
        confirmText="Hủy đơn"
        cancelText="Quay lại"
        confirmType="danger"
        onConfirm={async () => {
          await cancelFromDetail();
          setQConfirm((s) => ({ ...s, cancel: false }));
        }}
        onCancel={() => setQConfirm((s) => ({ ...s, cancel: false }))}
        disabled={acting.cancel}
      />
      <ConfirmModal
        open={inQueue && qConfirm.claim}
        title="Xác nhận nhận đơn"
        message="Bạn sẽ nhận đơn này và chuyển sang mục Đơn hàng của tôi."
        confirmText="Nhận đơn"
        cancelText="Quay lại"
        onConfirm={async () => {
          await claimFromDetail();
          setQConfirm((s) => ({ ...s, claim: false }));
        }}
        onCancel={() => setQConfirm((s) => ({ ...s, claim: false }))}
        disabled={acting.claim}
      />

      <ConfirmModal
        open={!!confirm}
        title="Xác nhận hủy đơn"
        message={
          <div className={styles.cancelReasons}>
            <div>Vui lòng chọn lý do hủy đơn:</div>
            <label className={styles.cancelReasonItem}>
              <input
                type="checkbox"
                checked={reasons.includes('Phí ship cao')}
                onChange={(e) =>
                  setReasons((prev) =>
                    e.target.checked
                      ? [...prev, 'Phí ship cao']
                      : prev.filter((x) => x !== 'Phí ship cao'),
                  )
                }
              />
              Phí ship cao
            </label>
            <label className={styles.cancelReasonItem}>
              <input
                type="checkbox"
                checked={reasons.includes('Không còn nhu cầu')}
                onChange={(e) =>
                  setReasons((prev) =>
                    e.target.checked
                      ? [...prev, 'Không còn nhu cầu']
                      : prev.filter((x) => x !== 'Không còn nhu cầu'),
                  )
                }
              />
              Không còn nhu cầu
            </label>
            <label className={styles.cancelReasonItem}>
              <input
                type="checkbox"
                checked={reasons.includes('Giao quá lâu')}
                onChange={(e) =>
                  setReasons((prev) =>
                    e.target.checked
                      ? [...prev, 'Giao quá lâu']
                      : prev.filter((x) => x !== 'Giao quá lâu'),
                  )
                }
              />
              Giao quá lâu
            </label>
            <label className={styles.cancelReasonItem}>
              <input
                type="checkbox"
                checked={reasons.includes('Xác nhận đơn quá chậm')}
                onChange={(e) =>
                  setReasons((prev) =>
                    e.target.checked
                      ? [...prev, 'Xác nhận đơn quá chậm']
                      : prev.filter((x) => x !== 'Xác nhận đơn quá chậm'),
                  )
                }
              />
              Xác nhận đơn quá chậm
            </label>
            <div className={styles.cancelOther}>
              <label>Lý do khác</label>
              <input
                value={reasonOther}
                onChange={(e) => setReasonOther(e.target.value)}
                placeholder="Nhập lý do khác (không bắt buộc)"
              />
            </div>
          </div>
        }
        confirmText="Hủy đơn"
        cancelText="Quay lại"
        confirmType="danger"
        onConfirm={doCancel}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}
