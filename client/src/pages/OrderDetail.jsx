import React from 'react';
import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import ordersApi from '@/api/orders-api';
import paymentsApi from '@/api/payments-api';
import { productsApi } from '@/api/products-api';
import { reviewsApi } from '@/api/reviews-api';
import ConfirmModal from '@/components/ConfirmModal';
import { useAuth } from '@/auth/AuthProvider';
import styles from './OrderDetail.module.css';

const fmtVND = (n) => new Intl.NumberFormat('vi-VN').format(Number(n) || 0);
const STATUS_LABEL = {
  PENDING: 'Chờ xác nhận',
  AWAITING_PAYMENT: 'Chờ thanh toán',
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
  const [err, setErr] = useState('');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState({ claim: false, cancel: false });
  const [editing, setEditing] = useState({ open: false, index: -1 });
  const [variants, setVariants] = useState([]);
  const [editSel, setEditSel] = useState({ color: '', size: '', sku: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [qConfirm, setQConfirm] = useState({ claim: false, cancel: false });
  const [reasons, setReasons] = useState([]);
  const [reasonOther, setReasonOther] = useState('');
  const [remainSec, setRemainSec] = useState(null); // đếm ngược thời gian còn lại để thanh toán
  const [autoCancelling, setAutoCancelling] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const buildImageUrl = useCloudImage();
  const { user } = useAuth();

  // Bulk edit states
  const [bulkVariantsByProduct, setBulkVariantsByProduct] = useState({}); // { [productId]: variants[] }
  const [bulkSel, setBulkSel] = useState([]); // per-index { color, size }
  const [bulkSearch, setBulkSearch] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [savingIdx, setSavingIdx] = useState(-1);

  // 2) ADD helpers & timeline map in OrderDetail.jsx (above return)
  const statusKey = (s) => String(s || '').toUpperCase();
  const STATUS_LABEL2 = {
    PENDING: 'Chờ xác nhận',
    AWAITING_PAYMENT: 'Chờ thanh toán',
    CONFIRMED: 'Đã xác nhận',
    PACKING: 'Đang đóng gói',
    SHIPPING: 'Vận chuyển',
    DELIVERING: 'Đang giao',
    DONE: 'Hoàn tất',
    CANCELLED: 'Đã hủy',
    RETURNED: 'Trả/Hoàn tiền',
  };

  const timeline = (order?.history || []).map((h) => {
    // BE đã map sẵn -> dùng luôn
    if (h.label || h.actorName || h.changedAt) {
      return {
        label: h.label || STATUS_LABEL2[statusKey(h.status)] || h.status || 'Sự kiện',
        actorName: h.actorName || 'Hệ thống',
        actorRole: h.actorRole || 'Hệ thống',
        assigneeName: h.assigneeName,
        at: h.changedAt || h.at || h.createdAt,
      };
    }

    // Fallback từ dữ liệu thô
    const action = statusKey(h.action);
    const to = statusKey(h.toStatus);
    let label = 'Sự kiện';
    if (action === 'CREATE') label = 'Tạo đơn';
    else if (action === 'ASSIGN') label = 'Gán phụ trách';
    else if (action === 'STATUS_CHANGE' || to) label = STATUS_LABEL2[to] || to || 'Đổi trạng thái';

    let actorName = 'Hệ thống',
      actorRole = 'Hệ thống';
    const by = h.byUserId;
    if (by && typeof by === 'object') {
      const isCus = order?.userId && String(by._id) === String(order.userId);
      actorName =
        by.name ||
        (isCus
          ? order.shippingAddress?.fullName || order.customerName || 'Khách hàng'
          : 'Hệ thống');
      actorRole =
        by.role === 'staff'
          ? 'Nhân viên'
          : by.role === 'admin'
          ? 'Admin'
          : isCus
          ? 'Khách hàng'
          : 'Hệ thống';
    } else if (action === 'CREATE') {
      actorName = order.shippingAddress?.fullName || order.customerName || 'Khách hàng';
      actorRole = 'Khách hàng';
    }

    let assigneeName;
    if (action === 'ASSIGN' && typeof h.note === 'string') {
      const m = h.note.match(/Assign to\s+([0-9a-f]{24})/i);
      if (m) assigneeName = m[1]; // nếu BE chưa map tên
    }
    return { label, actorName, actorRole, assigneeName, at: h.at || h.createdAt };
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const isStaff = !!(user && (user.role === 'staff' || user.role === 'admin'));
        const data = isStaff ? await ordersApi.getAny(id) : await ordersApi.get(id);
        if (!cancelled) setOrder(data);
      } catch (e) {
        if (!cancelled) setOrder(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, user?.role]);

  // Check if the current order has already been reviewed (for customer)
  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        const isStaff = !!(user && (user.role === 'staff' || user.role === 'admin'));
        if (isStaff || !order?._id) {
          if (!stop) setAlreadyReviewed(false);
          return;
        }
        const res = await reviewsApi.mine();
        const list = Array.isArray(res?.reviews) ? res.reviews : res || [];
        const match = list.some((rv) => String(rv.orderId) === String(order._id || order.id));
        if (!stop) setAlreadyReviewed(!!match);
      } catch {
        if (!stop) setAlreadyReviewed(false);
      }
    })();
    return () => {
      stop = true;
    };
  }, [order?._id, order?.id, user?.role]);

  // Đếm ngược 24h cho đơn đang chờ thanh toán (khách hàng)
  useEffect(() => {
    // luôn đăng ký hook (không phụ thuộc early return) để không vi phạm Rules of Hooks
    const isStaff = !!(user && (user.role === 'staff' || user.role === 'admin'));
    const awaitingBank =
      !isStaff &&
      order &&
      String(order.paymentMethod).toUpperCase() === 'BANK' &&
      String(order.status).toUpperCase() === 'AWAITING_PAYMENT';

    if (!awaitingBank) {
      setRemainSec(null);
      return; // cleanup none
    }
    const TTL_MS = 24 * 60 * 60 * 1000; // 24 giờ
    const createdAtMs = new Date(order.createdAt).getTime();
    const expiry = createdAtMs + TTL_MS;

    const calcRemain = () => Math.max(0, Math.floor((expiry - Date.now()) / 1000));
    setRemainSec(calcRemain());

    const t = setInterval(() => {
      const r = calcRemain();
      setRemainSec(r);
      if (r <= 0) {
        clearInterval(t);
        (async () => {
          if (autoCancelling) return;
          setAutoCancelling(true);
          try {
            await paymentsApi.userCancelPayment(order._id || order.id);
          } catch {}
          try {
            const refreshed = await ordersApi.get(order._id || order.id);
            setOrder(refreshed || null);
          } catch {}
          setAutoCancelling(false);
        })();
      }
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?._id, order?.id, order?.createdAt, order?.status, order?.paymentMethod, user?.role]);

  if (loading) return <div className={styles.wrap}>Đang tải…</div>;
  if (!order) return <div className={styles.wrap}>Không tìm thấy đơn.</div>;

  const amounts = order.amounts || {};
  const addr = order.shippingAddress || {};
  const code = order.code || order._id;
  const status = String(order.status || 'PENDING');
  const pmLabel = PM_LABEL[order.paymentMethod] || order.paymentMethod || '—';
  const isStaff = user && (user.role === 'staff' || user.role === 'admin');
  const canPayNow =
    !isStaff &&
    String(order.paymentMethod).toUpperCase() === 'BANK' &&
    String(order.status).toUpperCase() === 'AWAITING_PAYMENT';
  const canCancel = ['PENDING', 'AWAITING_PAYMENT'].includes(
    String(order.status || 'PENDING').toUpperCase(),
  );
  const inQueue = isStaff && loc.state?.from === 'staff' && loc.state?.queue;
  const canEditItems = isStaff && String(order.status).toUpperCase() === 'PENDING';

  const fmtRemain = (s) => {
    if (s == null) return '';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
  };

  // Next status: use code for API, label for UI
  const nextStatusCode = (s) => {
    const cur = String(s || '').toLowerCase();
    const map = {
      pending: 'confirmed',
      confirmed: 'shipping',
      shipping: 'delivering',
      delivering: 'done',
    };
    return map[cur] || '';
  };
  const nextStatusLabel = (s) => {
    const cur = String(s || '').toLowerCase();
    const map = {
      pending: 'Đã xác nhận',
      confirmed: 'Đang vận chuyển',
      shipping: 'Đang giao',
      delivering: 'Hoàn tất',
    };
    return map[cur] || '';
  };

  const updateToNext = async () => {
    const toCode = nextStatusCode(order.status);
    if (!toCode) return;
    try {
      await ordersApi.updateStatus(order._id || order.id, toCode);
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
      alert(e?.response?.data?.message || 'Không thể nhận đơn.');
    } finally {
      setActing((x) => ({ ...x, claim: false }));
    }
  };

  const openBulkUpdateModal = async () => {
    if (String(order.status).toUpperCase() !== 'PENDING') return;
    setEditing({ open: true, index: -1 });
    setBulkSearch('');
    setBulkLoading(true);
    try {
      const items = order.items || [];
      const uniqIds = [...new Set(items.map((it) => it.productId))];
      const details = await Promise.all(
        uniqIds.map((pid) => productsApi.detail(pid).catch(() => null)),
      );
      const map = {};
      uniqIds.forEach((pid, i) => {
        map[pid] = details[i]?.variants || [];
      });
      setBulkVariantsByProduct(map);
      const initSel = items.map((it) => {
        const vs = map[it.productId] || [];
        const cur = vs.find((v) => v.sku === it.variantSku) || vs[0] || {};
        return { color: cur.color || '', size: cur.size || '' };
      });
      setBulkSel(initSel);
    } finally {
      setBulkLoading(false);
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

  // Derived for modal validation (single-item edit mode)
  const currentItem = editing.open ? (order.items || [])[editing.index] : null;
  const allVariants = variants || [];
  const validVariant = allVariants.find(
    (x) =>
      String(x.color || '') === String(editSel.color || '') &&
      String(x.size || '') === String(editSel.size || ''),
  );
  const isSamePrice = validVariant
    ? Number(validVariant.price) === Number(currentItem?.price ?? Number.NaN)
    : false;

  return (
    <div className={styles.wrap}>
      <div className={styles.panel}>
        {inQueue && (
          <div className={styles.infoBanner}>
            Đơn này đang ở hàng đợi. Bạn có thể Nhận đơn để xử lý hoặc Hủy đơn nếu cần.
          </div>
        )}
        {!inQueue && canPayNow && (
          <div className={styles.infoBanner}>
            Đơn hàng đang chờ thanh toán. Thời gian còn lại để thanh toán:{' '}
            <b>{fmtRemain(remainSec)}</b>. Khi hết thời gian, đơn sẽ tự động hủy.
          </div>
        )}
        <div className={styles.header}>
          <button
            className={styles.back}
            onClick={() => {
              const target =
                loc.state?.backTo ||
                (loc.state?.from === 'staff' ? '/dashboard/my-orders' : '/orders');
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

          {/* 3) ADD this section inside JSX, before bottom action buttons */}
          {Array.isArray(order.history) && order.history.length > 0 && user?.role === 'admin' && (
            <section className={styles.card}>
              <h3>Lịch sử xử lý</h3>
              <ul className={styles.timeline}>
                {timeline.map((t, i) => (
                  <li key={i}>
                    <b>{t.label}</b>
                    {t.assigneeName ? ` → ${t.assigneeName}` : ''}
                    {t.actorName ? ` bởi ${t.actorName}` : ''}
                    {t.actorRole ? ` (${t.actorRole})` : ''}
                    <br />
                    <small>{t.at ? new Date(t.at).toLocaleString('vi-VN') : ''}</small>
                  </li>
                ))}
              </ul>
            </section>
          )}

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

        {/* Staff (non-queue): combine actions into one row with Cancel | Cập nhật | Chuyển */}
        {!inQueue && isStaff && (
          <div className={styles.bottomActions}>
            {canCancel && (
              <button className={`btn ${styles.btnDanger}`} onClick={() => setConfirm(true)}>
                Hủy đơn
              </button>
            )}
            {canEditItems && (
              <button className="btn" onClick={openBulkUpdateModal} disabled={!canEditItems}>
                Cập nhật
              </button>
            )}
            {nextStatusCode(order.status) && (
              <button className={`btn ${styles.btnPrimary}`} onClick={updateToNext}>
                Chuyển → {nextStatusLabel(order.status)}
              </button>
            )}
          </div>
        )}
        {/* Customer (non-staff): keep cancel button as before */}
        {!inQueue && !isStaff && (
          <div className={styles.bottomActions}>
            {canCancel && (
              <button className={`btn ${styles.btnDanger}`} onClick={() => setConfirm(true)}>
                Hủy đơn
              </button>
            )}
            {canPayNow && (
              <button
                className={`btn ${styles.btnPrimary}`}
                onClick={async () => {
                  try {
                    const r = await paymentsApi.createLink(order._id || order.id);
                    const url = r?.paymentData?.checkoutUrl;
                    if (url) window.location.href = url;
                    else alert('Không tạo được link thanh toán');
                  } catch (e) {
                    alert(e?.response?.data?.message || 'Không tạo được link thanh toán');
                  }
                }}
              >
                Thanh toán ngay
              </button>
            )}
            {['DONE', 'RETURNED'].includes(String(order.status).toUpperCase()) && (
              <button
                className={`btn ${styles.btnPrimary}`}
                onClick={() => nav(`/orders/${order._id || order.id}/review`)}
              >
                {alreadyReviewed ? 'Xem đánh giá' : 'Đánh giá'}
              </button>
            )}
          </div>
        )}

        {inQueue && (
          <div className={styles.bottomActions}>
            <button
              className={`btn ${styles.btnDanger}`}
              onClick={() => setConfirm(true)}
              disabled={acting.cancel}
            >
              {acting.cancel ? 'Đang hủy…' : 'Hủy đơn'}
            </button>
            <button
              className="btn"
              onClick={openBulkUpdateModal}
              disabled={String(order.status).toUpperCase() !== 'PENDING'}
            >
              Cập nhật
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
          onConfirm={async () => {
            const isAwaitingBank =
              String(order.paymentMethod).toUpperCase() === 'BANK' &&
              String(order.status).toUpperCase() === 'AWAITING_PAYMENT';

            // If staff/admin, send cancel via staff route so history note is recorded
            if (isStaff) {
              setConfirm(false);
              try {
                // Try cancel pending online payment first (best-effort)
                if (isAwaitingBank) {
                  try {
                    await paymentsApi.userCancelPayment(order._id || order.id);
                  } catch {}
                }
                const payload = {};
                if (Array.isArray(reasons) && reasons.length) payload.reasons = reasons;
                if (reasonOther && String(reasonOther).trim()) payload.other = reasonOther;
                await ordersApi.updateStatus(order._id || order.id, 'canceled', payload);
                // After staff cancels from queue, navigate back to dashboard
                if (inQueue) {
                  nav('/dashboard');
                  return;
                }
                const refreshed = await (loc.state?.from === 'staff'
                  ? ordersApi.getAny(id)
                  : ordersApi.get(id));
                setOrder(refreshed || null);
              } catch (e) {
                alert(e?.response?.data?.message || 'Không thể hủy đơn.');
              }
              return;
            }

            // default: customer cancel flow
            try {
              if (isAwaitingBank) {
                try {
                  await paymentsApi.userCancelPayment(order._id || order.id);
                } catch {}
              }
            } finally {
              await doCancel();
            }
          }}
          onCancel={() => setConfirm(false)}
        />

        {/* Edit item variant modal */}
        <ConfirmModal
          open={editing.open}
          title="Cập nhật sản phẩm trong đơn"
          contentClassName={styles.modalTightContent}
          message={
            <div style={{ display: 'grid', gap: 14 }}>
              {editing.index < 0 ? (
                <>
                  <div className={`${styles.modalSection} ${styles.stickyBar}`}>
                    <label>Tìm kiếm sản phẩm</label>
                    <input
                      value={bulkSearch}
                      onChange={(e) => setBulkSearch(e.target.value)}
                      placeholder="Nhập tên hoặc SKU để tìm…"
                      style={{
                        width: '100%',
                        padding: 8,
                        borderRadius: 6,
                        border: '1px solid #ddd',
                      }}
                    />
                  </div>
                  {bulkLoading ? (
                    <div className={styles.modalSection}>Đang tải biến thể…</div>
                  ) : (
                    <div className={styles.modalSection}>
                      <div style={{ display: 'grid', gap: 12 }}>
                        {(order.items || [])
                          .map((it, idx) => ({ it, idx }))
                          .filter(({ it }) => {
                            const q = bulkSearch.trim().toLowerCase();
                            if (!q) return true;
                            return (
                              String(it.nameSnapshot || '')
                                .toLowerCase()
                                .includes(q) ||
                              String(it.variantSku || '')
                                .toLowerCase()
                                .includes(q)
                            );
                          })
                          .map(({ it, idx }) => {
                            const vs = bulkVariantsByProduct[it.productId] || [];
                            const sel = bulkSel[idx] || { color: '', size: '' };
                            const currentPrice = Number(it.price || 0);

                            const colors = [...new Set(vs.map((v) => v.color || ''))];
                            const anyDiffByColor = (c) =>
                              vs.some(
                                (v) =>
                                  String(v.color || '') === String(c) &&
                                  Number(v.price) !== currentPrice,
                              );
                            const sizesForColor = vs.filter(
                              (v) => String(v.color || '') === String(sel.color || ''),
                            );
                            const uniqSizes = [...new Set(sizesForColor.map((v) => v.size || ''))];
                            const variantForSel = vs.find(
                              (v) =>
                                String(v.color || '') === String(sel.color || '') &&
                                String(v.size || '') === String(sel.size || ''),
                            );
                            const samePrice = variantForSel
                              ? Number(variantForSel.price) === currentPrice
                              : false;

                            return (
                              <div
                                key={idx}
                                style={{ border: '1px solid #eee', borderRadius: 8, padding: 12 }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    gap: 12,
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                  }}
                                >
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 12,
                                      minWidth: 0,
                                    }}
                                  >
                                    <img
                                      src={buildImageUrl(it.imageSnapshot, 64)}
                                      alt={it.nameSnapshot}
                                      style={{
                                        width: 48,
                                        height: 48,
                                        objectFit: 'cover',
                                        borderRadius: 6,
                                        flex: '0 0 auto',
                                      }}
                                    />
                                    <div style={{ display: 'grid', minWidth: 0 }}>
                                      <strong
                                        style={{
                                          whiteSpace: 'nowrap',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                        }}
                                      >
                                        {it.nameSnapshot}
                                      </strong>
                                      {it.variantSku ? (
                                        <small style={{ opacity: 0.7 }}>
                                          SKU hiện tại: {it.variantSku}
                                        </small>
                                      ) : null}
                                    </div>
                                  </div>
                                  <div className={styles.unit}>{fmtVND(it.price)}₫</div>
                                </div>

                                <div className={styles.optionRow} style={{ marginTop: 8 }}>
                                  {colors.map((c) => {
                                    const cls = [styles.pill];
                                    if (String(sel.color || '') === String(c))
                                      cls.push(styles.pillActive);
                                    if (anyDiffByColor(c)) cls.push(styles.pillWarn);
                                    return (
                                      <button
                                        type="button"
                                        key={c}
                                        className={cls.join(' ')}
                                        onClick={() =>
                                          setBulkSel((arr) => {
                                            const next = [...arr];
                                            next[idx] = { ...(next[idx] || {}), color: c };
                                            return next;
                                          })
                                        }
                                      >
                                        {c || '—'}
                                      </button>
                                    );
                                  })}
                                </div>

                                <div className={styles.optionRow}>
                                  {uniqSizes.map((sz) => {
                                    const v = sizesForColor.find(
                                      (x) => String(x.size || '') === String(sz),
                                    );
                                    const same = v && Number(v.price) === currentPrice;
                                    const cls = [styles.pill];
                                    if (String(sel.size || '') === String(sz))
                                      cls.push(styles.pillActive);
                                    if (!same) cls.push(styles.pillWarn);
                                    return (
                                      <button
                                        type="button"
                                        key={sz}
                                        className={cls.join(' ')}
                                        onClick={() =>
                                          setBulkSel((arr) => {
                                            const next = [...arr];
                                            next[idx] = { ...(next[idx] || {}), size: sz };
                                            return next;
                                          })
                                        }
                                      >
                                        {sz || '—'}
                                      </button>
                                    );
                                  })}
                                </div>

                                <div className={styles.hint}>
                                  {variantForSel
                                    ? `SKU: ${variantForSel.sku} — Giá: ${fmtVND(
                                        variantForSel.price,
                                      )}₫${samePrice ? '' : ' (khác giá với sản phẩm trong đơn)'}`
                                    : 'Hãy chọn Màu + Size.'}
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                  <button
                                    className="btn"
                                    disabled={savingIdx === idx || !variantForSel || !samePrice}
                                    onClick={async () => {
                                      if (!variantForSel) return;
                                      setSavingIdx(idx);
                                      try {
                                        const oid = order._id || order.id;
                                        await ordersApi.updateItemVariant(oid, idx, {
                                          color: sel.color,
                                          size: sel.size,
                                        });
                                        const refreshed = await (loc.state?.from === 'staff'
                                          ? ordersApi.getAny(id)
                                          : ordersApi.get(id));
                                        setOrder(refreshed || null);
                                      } catch (e) {
                                        alert(
                                          e?.response?.data?.message || 'Cập nhật không thành công',
                                        );
                                      } finally {
                                        setSavingIdx(-1);
                                      }
                                    }}
                                  >
                                    {savingIdx === idx ? 'Đang lưu…' : 'Cập nhật'}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className={styles.modalSection}>
                    <label>Màu sắc</label>
                    <div className={styles.optionRow}>
                      {[...new Set(allVariants.map((v) => v.color || ''))].map((c) => {
                        const anyDiff = allVariants.some(
                          (v) =>
                            String(v.color || '') === String(c) &&
                            Number(v.price) !== Number(currentItem?.price ?? Number.NaN),
                        );
                        const cls = [styles.pill];
                        if (String(editSel.color || '') === String(c)) cls.push(styles.pillActive);
                        if (anyDiff) cls.push(styles.pillWarn);
                        return (
                          <button
                            type="button"
                            key={c}
                            className={cls.join(' ')}
                            onClick={() => setEditSel((s) => ({ ...s, color: c }))}
                          >
                            {c || '—'}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className={styles.modalSection}>
                    <label>Size</label>
                    <div className={styles.optionRow}>
                      {(() => {
                        const sizesForColor = allVariants.filter(
                          (v) => String(v.color || '') === String(editSel.color || ''),
                        );
                        const uniqSizes = [...new Set(sizesForColor.map((v) => v.size || ''))];
                        return uniqSizes.map((sz) => {
                          const v = sizesForColor.find((x) => String(x.size || '') === String(sz));
                          const same =
                            v && Number(v.price) === Number(currentItem?.price ?? Number.NaN);
                          const cls = [styles.pill];
                          if (String(editSel.size || '') === String(sz))
                            cls.push(styles.pillActive);
                          if (!same) cls.push(styles.pillWarn);
                          return (
                            <button
                              type="button"
                              key={sz}
                              className={cls.join(' ')}
                              onClick={() => setEditSel((s) => ({ ...s, size: sz }))}
                            >
                              {sz || '—'}
                            </button>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  <div className={styles.hint}>
                    {validVariant
                      ? `SKU: ${validVariant.sku} — Giá: ${fmtVND(validVariant.price)}₫${
                          isSamePrice ? '' : ' (khác giá với sản phẩm trong đơn)'
                        }`
                      : 'Hãy chọn tổ hợp Màu + Size.'}
                  </div>
                </>
              )}
            </div>
          }
          confirmText={editing.index < 0 ? 'Đóng' : 'Lưu'}
          cancelText="Hủy"
          onConfirm={async () => {
            if (editing.index < 0) {
              setEditing({ open: false, index: -1 });
              return;
            }
            if (!validVariant || !isSamePrice) return;
            setSavingEdit(true);
            try {
              const oid = order._id || order.id;
              await ordersApi.updateItemVariant(oid, editing.index, {
                color: editSel.color,
                size: editSel.size,
              });
              const refreshed = await (loc.state?.from === 'staff'
                ? ordersApi.getAny(id)
                : ordersApi.get(id));
              setOrder(refreshed || null);
            } catch (e) {
              alert(e?.response?.data?.message || 'Cập nhật không thành công');
            } finally {
              setSavingEdit(false);
              setEditing({ open: false, index: -1 });
            }
          }}
          onCancel={() => setEditing({ open: false, index: -1 })}
          disabled={editing.index < 0 ? false : savingEdit || !validVariant || !isSamePrice}
          hideCancel={editing.index < 0}
        />
      </div>
    </div>
  );
}
