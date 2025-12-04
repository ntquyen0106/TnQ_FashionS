import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ordersApi } from '@/api';
import ConfirmModal from '@/components/ConfirmModal';
import styles from './MyOrdersPage.module.css';

export default function MyOrdersPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('pending'); // <= bộ lọc trạng thái (mặc định: Chờ xác nhận)
  const [q, setQ] = useState(''); // <= tìm theo mã đơn
  const [saving, setSaving] = useState({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [confirm, setConfirm] = useState({ open: false, id: null });
  const [selected, setSelected] = useState({});

  const STATUS_LABEL = {
    PENDING: 'Chờ xác nhận',
    AWAITING_PAYMENT: 'Chờ thanh toán',
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
      awaiting_payment: 'AWAITING_PAYMENT',
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

  // Get next status for progression
  const getNextStatus = (currentStatus) => {
    const cur = String(currentStatus || '').toLowerCase();
    const transitions = {
      confirmed: { status: 'shipping', label: 'Chuyển sang Vận chuyển' },
      processing: { status: 'shipping', label: 'Chuyển sang Vận chuyển' },
      shipping: { status: 'delivering', label: 'Chuyển sang Đang giao' },
      delivering: { status: 'done', label: 'Hoàn tất đơn' },
    };
    return transitions[cur] || null;
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
      let list = data.items || data || [];
      // lọc theo nhiều trường nếu có q: mã đơn/_id, tên KH, SĐT, tên SP, SKU
      const term = q.trim().toLowerCase();
      if (term) {
        list = list.filter((o) => {
          const code = String(o.code || o._id || '').toLowerCase();
          const name = String(
            (o.shippingAddress && o.shippingAddress.fullName) || o.customerName || '',
          ).toLowerCase();
          const phone = String(
            (o.shippingAddress && o.shippingAddress.phone) || o.customerPhone || '',
          ).toLowerCase();
          const itemsArr = o.items || o.lineItems || [];
          const itemText = itemsArr
            .map((it) => `${it?.nameSnapshot || it?.name || ''} ${it?.variantSku || ''}`)
            .join(' ')
            .toLowerCase();
          return (
            code.includes(term) ||
            name.includes(term) ||
            phone.includes(term) ||
            itemText.includes(term)
          );
        });
      }
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
  }, [status, q]); // tự load khi đổi filter/tìm kiếm

  // Updated: allow status updates (used for cancel) but we removed progression UI
  const onUpdate = async (id, to) => {
    if (!id || !to) return;
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

  const handlePrintOrders = async () => {
    const selectedIds = Object.keys(selected || {});
    const toPrint = selectedIds.length > 0 ? items.filter((o) => selected[o.id || o._id]) : items;
    if (!toPrint || toPrint.length === 0) return;
    const win = window.open('', '_blank');
    if (!win) return;
    const fmtCurrency = (n) => Number(n || 0).toLocaleString('vi-VN') + ' đ';
    const shopName = 'TNQ Fashion';
    const clientOrigin = window?.location?.origin || '';
    const html = `<!DOCTYPE html><html><head><title>In đơn hàng</title>
      <meta charset='utf-8' />
      <style>
        body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111;margin:0;padding:16px;}
        h1{font-size:18px;margin:0 0 12px;font-weight:700;text-align:center;}
        .order{margin:0 0 28px;page-break-after:always;border:1px solid #ccc;padding:12px;border-radius:6px;}
        .metaWrap{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;}
        .meta{margin:0 0 8px;display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:12px;}
        .meta div{padding:2px 4px;}
        table{width:100%;border-collapse:collapse;margin-top:8px;font-size:12px;}
        th,td{border:1px solid #999;padding:4px 6px;text-align:left;}
        th{background:#f1f5f9;}
        .totals{margin-top:8px;display:grid;justify-content:end;width:100%;}
        .totals table{width:auto;}
        .right{text-align:right;}
        .qrBox{text-align:center;font-size:10px;color:#374151;}
        .qrBox img{width:120px;height:120px;border:1px solid #d1d5db;padding:6px;border-radius:8px;background:#fff;}
        .qrHint{margin-top:4px;max-width:140px;line-height:1.3;}
        @media print {button{display:none;} .order{box-shadow:none;border-color:#999;} }
      </style></head><body>
      <h1>${shopName}</h1>
      ${toPrint
        .map((o) => {
          const id = o.code || o._id || o.id;
          const created = o.createdAt ? new Date(o.createdAt).toLocaleString('vi-VN') : '';
          const addr = o.shippingAddress || {};
          const addressLine = [addr.line1, addr.ward, addr.district, addr.city]
            .filter(Boolean)
            .join(', ');
          const orderLink = clientOrigin ? `${clientOrigin}/orders/${id}` : '';
          const qrLink = orderLink ? `${orderLink}?qr=1` : '';
          const qrImg = qrLink
            ? `<div class='qrBox'>
                <img src='https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
                  qrLink,
                )}' alt='QR đơn hàng' />
                <div class='qrHint'>Quét để cập nhật trạng thái & xem thông tin giao hàng</div>
              </div>`
            : '';
          const rows = (o.items || [])
            .map(
              (it, idx) => `<tr>
                <td>${idx + 1}</td>
                <td>${it.nameSnapshot || it.name || ''}</td>
                <td>${it.variantSku || ''}</td>
                <td class='right'>${it.qty || it.quantity || 0}</td>
                <td class='right'>${fmtCurrency(it.price)}</td>
                <td class='right'>${fmtCurrency(
                  it.lineTotal || (it.price || 0) * (it.qty || it.quantity || 0),
                )}</td>
              </tr>`,
            )
            .join('');
          const amounts = o.amounts || {};
          return `<div class='order'>
            <div class='metaWrap'>
              <div class='meta'>
                <div><strong>Mã đơn:</strong> ${id}</div>
                <div><strong>Ngày tạo:</strong> ${created}</div>
                <div style='grid-column:1 / -1'><strong>Khách hàng:</strong> ${
                  addr.fullName || o.customerName || ''
                }</div>
                <div style='grid-column:1 / -1'><strong>Địa chỉ:</strong> ${addressLine}</div>
              </div>
              ${qrImg}
            </div>
            <table>
              <thead><tr><th>#</th><th>Sản phẩm</th><th>SKU</th><th>SL</th><th>Giá</th><th>Thành tiền</th></tr></thead>
              <tbody>${rows || '<tr><td colspan="6">Không có sản phẩm</td></tr>'}</tbody>
            </table>
            <div class='totals'>
              <table>
                <tbody>
                  <tr><td>Subtotal</td><td class='right'>${fmtCurrency(amounts.subtotal)}</td></tr>
                  <tr><td>Giảm giá</td><td class='right'>${fmtCurrency(amounts.discount)}</td></tr>
                  <tr><td>Phí vận chuyển</td><td class='right'>${fmtCurrency(
                    amounts.shippingFee,
                  )}</td></tr>
                  <tr><td><strong>Tổng cộng</strong></td><td class='right'><strong>${fmtCurrency(
                    amounts.grandTotal,
                  )}</strong></td></tr>
                </tbody>
              </table>
            </div>
          </div>`;
        })
        .join('')}
      </body></html>`;
    win.document.write(html);
    win.document.close();
    win.focus();
    try {
      // Trigger print dialog (blocking until user closes it)
      win.print();
    } finally {
      try {
        // Mark all printed orders as printed
        const printedIds = toPrint.map((o) => o.id || o._id).filter(Boolean);
        if (printedIds.length) {
          await ordersApi.markPrinted(printedIds);
        }

        // Auto-confirm only orders that are currently pending
        const pendingIds = toPrint
          .filter((o) => String(o.status || '').toLowerCase() === 'pending')
          .map((o) => o.id || o._id)
          .filter(Boolean);
        if (pendingIds.length) {
          await Promise.all(pendingIds.map((id) => ordersApi.updateStatus(id, 'confirmed')));
        }

        await load();
      } catch (e) {
        console.error('Post-print operations failed:', e);
      } finally {
        setSelected({});
      }
    }
  };

  const toggleSelect = (id, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setSelected((prev) => {
      const next = { ...(prev || {}) };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  };

  const toggleSelectAll = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const cur = Object.keys(selected || {}).length;
    if (!items || items.length === 0) return;
    if (cur === items.length) {
      setSelected({});
    } else {
      const all = {};
      items.forEach((o) => {
        const id = o.id || o._id;
        if (id) all[id] = true;
      });
      setSelected(all);
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
          <span className={styles.hint}>
            Tổng: {items.length}
            {Object.keys(selected || {}).length > 0 && (
              <span style={{ color: '#2563eb', fontWeight: 600 }}>
                {' '}
                · Đã chọn: {Object.keys(selected || {}).length}
              </span>
            )}
          </span>
        </div>

        <div className={styles.right}>
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
          <button className={`btn ${styles.btnSecondary}`} onClick={load} disabled={loading}>
            {loading ? 'Đang tải...' : 'Tải lại'}
          </button>
        </div>
      </div>

      <div className={styles.list}>
        <div className={`${styles.row} ${styles.headerRow}`}>
          <div className={`${styles.cell} ${styles.th}`}>
            <input
              type="checkbox"
              aria-label="Chọn tất cả"
              onChange={toggleSelectAll}
              checked={items.length > 0 && Object.keys(selected || {}).length === items.length}
            />
          </div>
          <div className={`${styles.cell} ${styles.th}`}>Mã đơn</div>
          <div className={`${styles.cell} ${styles.th}`}>Khách hàng</div>
          <div className={`${styles.cell} ${styles.th}`}>Tổng</div>
          <div className={`${styles.cell} ${styles.th}`}>Ngày tạo</div>
          <div className={`${styles.cell} ${styles.th} ${styles.hideSm} ${styles.center}`}>
            Trạng thái
          </div>
          <div className={`${styles.cell} ${styles.th} ${styles.actions}`}>
            <button
              className={`btn ${styles.btnPrimary}`}
              type="button"
              onClick={handlePrintOrders}
              disabled={items.length === 0}
              title={
                Object.keys(selected || {}).length > 0
                  ? `In ${Object.keys(selected || {}).length} đơn đã chọn`
                  : 'In tất cả đơn đang hiển thị'
              }
            >
              📄 In đơn
              {Object.keys(selected || {}).length > 0 && (
                <span style={{ marginLeft: 6 }}>({Object.keys(selected || {}).length})</span>
              )}
            </button>
          </div>
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
            // progression removed; no next status token
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
                <div className={`${styles.cell}`} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    aria-label={`Chọn đơn ${o.code || id}`}
                    checked={!!selected[id]}
                    onChange={(e) => toggleSelect(id, e)}
                  />
                </div>
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
                    {!o.printedAt && skey === 'CONFIRMED' && (
                      <span style={{ marginLeft: 6, fontSize: 10 }}>⚠️ Chưa in</span>
                    )}
                  </span>
                </div>

                <div
                  className={`${styles.cell} ${styles.actions}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {(() => {
                    const currentStatus = String(o.status || '').toLowerCase();
                    const nextTransition = getNextStatus(currentStatus);

                    // Show cancel button ONLY for pending orders
                    const canCancel = currentStatus === 'pending';

                    return (
                      <>
                        {nextTransition && (
                          <button
                            className={`btn ${styles.btnSuccess}`}
                            onClick={() => onUpdate(id, nextTransition.status)}
                            disabled={!!saving[id]}
                          >
                            {saving[id] ? 'Đang xử lý...' : nextTransition.label}
                          </button>
                        )}
                        {canCancel && (
                          <button
                            className={`btn ${styles.btnDanger}`}
                            onClick={() => askCancel(id)}
                            disabled={!!saving[id]}
                          >
                            Hủy đơn
                          </button>
                        )}
                      </>
                    );
                  })()}
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
