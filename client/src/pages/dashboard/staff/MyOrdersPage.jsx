import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ordersApi } from '@/api';
import ConfirmModal from '@/components/ConfirmModal';
import styles from './MyOrdersPage.module.css';

export default function MyOrdersPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState(''); // <= bộ lọc trạng thái
  const [saving, setSaving] = useState({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [confirm, setConfirm] = useState({ open: false, id: null });

  const STATUS_LABEL = {
    PENDING: 'Chờ xác nhận',
    CONFIRMED: 'Đã xác nhận',
    SHIPPING: 'Vận chuyển',
    DELIVERING: 'Đang giao',
    DONE: 'Hoàn tất',
    CANCELLED: 'Đã hủy',
    RETURNED: 'Trả/Hoàn tiền',
  };

  const statusKey = (s) => {
    const cur = String(s || '').toLowerCase();
    const map = {
      pending: 'PENDING',
      confirmed: 'CONFIRMED',
      processing: 'CONFIRMED',
      shipping: 'SHIPPING',
      delivering: 'DELIVERING',
      delivered: 'DELIVERING',
      done: 'DONE',
      completed: 'DONE',
      canceled: 'CANCELLED',
      cancelled: 'CANCELLED',
      returned: 'RETURNED',
    };
    return map[cur] || cur.toUpperCase();
  };

  const load = async () => {
    try {
      setErr('');
      setLoading(true);
      // lọc theo trạng thái nếu có
      const data = await ordersApi.list({
        assignee: 'me',
        status: status || undefined,
      });
      const list = data.items || data || [];
      list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setItems(list);
    } catch (e) {
      console.error(e);
      setErr(e?.response?.data?.message || 'Không tải được danh sách');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]); // tự load khi đổi filter

  // Trạng thái kế tiếp cho nút “Chuyển → …”
  const nextStatus = (s) => {
    const cur = String(s || '').toLowerCase();
    const map = {
      pending: 'processing',
      confirmed: 'shipping',
      processing: 'shipping',
      shipping: 'delivering',
      delivering: 'completed',
    };
    return map[cur] || '';
  };

  const nextLabel = (to) => {
    const key = String(to || '').toLowerCase();
    const map = {
      processing: 'Đã xác nhận',
      shipping: 'Vận chuyển',
      delivering: 'Đang giao',
      completed: 'Hoàn tất',
    };
    return map[key] || to;
  };

  const onUpdate = async (id, to) => {
    if (!to) return;
    setSaving((x) => ({ ...x, [id]: true }));
    try {
      await ordersApi.updateStatus(id, to);
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving((x) => ({ ...x, [id]: false }));
    }
  };

  const askCancel = (id) => setConfirm({ open: true, id });

  const doCancel = async () => {
    const id = confirm.id;
    if (!id) return setConfirm({ open: false, id: null });
    await onUpdate(id, 'canceled');
    setConfirm({ open: false, id: null });
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <h2 className={styles.title}>Đơn hàng của tôi</h2>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.left}>
          <div className={styles.filters}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Lọc trạng thái</label>
              <select
                className={styles.select}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">Tất cả</option>
                <option value="pending">Chờ xác nhận</option>
                <option value="processing">Đã xác nhận</option>
                <option value="shipping">Vận chuyển</option>
                <option value="delivering">Đang giao</option>
                <option value="completed">Hoàn tất</option>
                <option value="canceled">Hủy</option>
                <option value="returned">Trả/Hoàn tiền</option>
              </select>
            </div>
            {status && (
              <button className="btn" onClick={() => setStatus('')}>
                Bỏ lọc
              </button>
            )}
          </div>
          <span className={styles.hint}>Tổng: {items.length}</span>
        </div>

        <div className={styles.right}>
          {err && <span style={{ color: 'crimson' }}>{err}</span>}
          <button className={`btn ${styles.btnSecondary}`} onClick={load} disabled={loading}>
            {loading ? 'Đang tải...' : 'Tải lại'}
          </button>
        </div>
      </div>

      <div className={styles.list}>
        <div className={`${styles.row} ${styles.headerRow}`}>
          <div className={`${styles.cell} ${styles.th}`}>Mã đơn</div>
          <div className={`${styles.cell} ${styles.th}`}>Khách hàng</div>
          <div className={`${styles.cell} ${styles.th}`}>Tổng</div>
          <div className={`${styles.cell} ${styles.th}`}>Ngày tạo</div>
          <div className={`${styles.cell} ${styles.th} ${styles.hideSm} ${styles.center}`}>
            Trạng thái
          </div>
          <div className={`${styles.cell} ${styles.th}`} />
        </div>

        {loading &&
          Array.from({ length: 6 }).map((_, i) => (
            <div className={styles.row} key={`sk-${i}`}>
              <div className={styles.cell}>
                <div className={styles.skel} style={{ width: 90 }} />
              </div>
              <div className={styles.cell}>
                <div className={styles.skel} style={{ width: '70%' }} />
              </div>
              <div className={styles.cell}>
                <div className={styles.skel} style={{ width: 80 }} />
              </div>
              <div className={styles.cell}>
                <div className={styles.skel} style={{ width: 120 }} />
              </div>
              <div className={`${styles.cell} ${styles.hideSm} ${styles.center}`}>
                <div className={styles.skel} style={{ width: 100 }} />
              </div>
              <div className={styles.cell} />
            </div>
          ))}

        {!loading &&
          items.map((o) => {
            const id = o.id || o._id;
            const itemCount = o.items?.length ?? o.lineItems?.length ?? 0;
            const to = nextStatus(o.status);
            const skey = statusKey(o.status);

            return (
              <div
                className={`${styles.row} ${styles.clickable} ${styles['hl_' + skey] || ''}`}
                key={id}
                tabIndex={0}
                onClick={() =>
                  navigate(`/orders/${id}`, {
                    state: { from: 'staff', backTo: '/dashboard/my-orders' },
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    navigate(`/orders/${id}`, {
                      state: { from: 'staff', backTo: '/dashboard/my-orders' },
                    });
                  }
                }}
              >
                <div className={styles.cell}>
                  <span className={styles.codeBadge}>{o.code || o._id}</span>
                </div>

                <div className={styles.cell}>
                  {(o.shippingAddress?.fullName || o.customerName) ?? ''}
                  {' · '}
                  {(o.shippingAddress?.phone || o.customerPhone) ?? ''}
                  {itemCount ? ` · ${itemCount} sản phẩm` : ''}
                </div>

                <div className={`${styles.cell} ${styles.colTotal}`}>
                  {(o.amounts?.grandTotal || o.total || 0).toLocaleString('vi-VN')} đ
                </div>

                <div className={`${styles.cell} ${styles.colCreated}`}>
                  {o.createdAt ? new Date(o.createdAt).toLocaleString('vi-VN') : ''}
                </div>

                <div className={`${styles.cell} ${styles.hideSm} ${styles.center}`}>
                  <span className={`${styles.statusPill} ${styles[`st_${skey}`] || ''}`}>
                    {STATUS_LABEL[skey] || o.status}
                  </span>
                </div>

                <div
                  className={`${styles.cell} ${styles.actions}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {to && (
                    <button
                      className={`btn ${styles.btnClaim}`}
                      onClick={() => onUpdate(id, to)}
                      disabled={!!saving[id]}
                      title={`Chuyển → ${nextLabel(to)}`}
                    >
                      Chuyển → {nextLabel(to)}
                    </button>
                  )}
                  {['pending', 'processing', 'confirmed', 'shipping'].includes(
                    String(o.status || '').toLowerCase(),
                  ) && (
                    <button
                      className={`btn ${styles.btnDanger}`}
                      onClick={() => askCancel(id)}
                      disabled={!!saving[id]}
                    >
                      Hủy đơn
                    </button>
                  )}
                </div>
              </div>
            );
          })}

        {!loading && items.length === 0 && (
          <div className={styles.empty}>
            {status ? 'Không có đơn phù hợp với bộ lọc.' : 'Không có đơn.'}
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
        disabled={!!(confirm.id && saving[confirm.id])}
      />
    </div>
  );
}
