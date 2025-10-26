import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ordersApi, usersApi } from '@/api';
import styles from './OrdersPage.module.css';

export default function OrdersPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('');
  const [staffFilter, setStaffFilter] = useState(''); // '', 'unassigned', or staffId
  const [onlyPreShipping, setOnlyPreShipping] = useState(false); // trước SHIPPING
  const [onlyUnassigned, setOnlyUnassigned] = useState(false); // chỉ đơn chưa gán
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [staffs, setStaffs] = useState([]);
  const [selected, setSelected] = useState([]);
  const [assigning, setAssigning] = useState(false);
  const [staffId, setStaffId] = useState('');
  const [viewingOrder, setViewingOrder] = useState(null);

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
      awaiting_payment: 'AWAITING_PAYMENT',
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
    setLoading(true);
    try {
      const params = {
        status: status || undefined,
        q: q || undefined,
        limit: 1000,
      };
      // staff filter -> params
      if (staffFilter === 'unassigned') params.unassigned = true;
      else if (staffFilter) params.assignee = staffFilter;

      const [o, s] = await Promise.all([ordersApi.list(params), usersApi.list({ role: 'staff' })]);

      setItems(o.items || o || []);
      setStaffs(s.content || s.items || s || []);
    } catch (e) {
      setErr(e?.response?.data?.message || 'Không tải được danh sách');
      setItems([]);
      setStaffs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, q, staffFilter]);

  const toggleSelect = (id) => {
    setSelected((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));
  };

  // Lọc phía FE
  const filteredItems = useMemo(() => {
    const term = q.trim().toLowerCase();
    let arr = items;

    if (term) {
      arr = arr.filter((o) => {
        const code = String(o.code || o._id || '').toLowerCase();
        const name = String(o.shippingAddress?.fullName || o.customerName || '').toLowerCase();
        const phone = String(o.shippingAddress?.phone || o.customerPhone || '').toLowerCase();
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
      });
    }

    if (onlyPreShipping) {
      const notYetShipped = ['PENDING', 'AWAITING_PAYMENT', 'CONFIRMED', 'PACKING'];
      arr = arr.filter((o) => notYetShipped.includes(statusKey(o.status)));
    }

    if (onlyUnassigned) {
      arr = arr.filter((o) => !o.assignedStaffId);
    }

    return arr;
  }, [items, q, onlyPreShipping, onlyUnassigned]);

  // Đơn có thể chọn: PENDING + chưa gán
  const selectableOrders = useMemo(
    () => filteredItems.filter((o) => !o.assignedStaffId && statusKey(o.status) === 'PENDING'),
    [filteredItems],
  );

  // Làm sạch selected khi selectableOrders thay đổi
  useEffect(() => {
    const ids = new Set(selectableOrders.map((o) => String(o.id || o._id)));
    setSelected((prev) => prev.filter((id) => ids.has(String(id))));
  }, [selectableOrders]);

  const allSelected = selected.length > 0 && selected.length === selectableOrders.length;

  const selectAll = () => {
    if (allSelected) setSelected([]);
    else setSelected(selectableOrders.map((o) => o.id || o._id));
  };

  const assignSelected = async () => {
    if (!staffId || selected.length === 0) return;
    setAssigning(true);
    try {
      await Promise.all(selected.map((oid) => ordersApi.assign(oid, staffId)));
      setSelected([]);
      await load();
    } finally {
      setAssigning(false);
    }
  };

  // Lấy chi tiết đơn khi click mã đơn
  // const openDetail = async (o) => {
  //   try {
  //     const full = await ordersApi.getAny(o.id || o._id);
  //     setViewingOrder(full);
  //   } catch (e) {
  //     alert(
  //       `Không tải được chi tiết đơn: ${e?.response?.status || ''} ${
  //         e?.response?.data?.message || e?.message
  //       }`,
  //     );
  //     setViewingOrder(o); // fallback
  //   }
  // };

  return (
    <>
      <div className={styles.wrap}>
        <div className={styles.head}>
          <h2 className={styles.title}>Quản lý đơn hàng</h2>
        </div>
        {/* Toolbar */}
        <div className={styles.toolbar}>
          <div className={styles.left}>
            <div className={styles.filters}>
              {/* Đơn chưa được gán checkbox */}
              <div
                className={styles.formGroup}
                style={{ marginBottom: 8, display: 'flex', alignItems: 'center' }}
              >
                <input
                  id="unassigned-checkbox"
                  type="checkbox"
                  checked={onlyUnassigned}
                  onChange={(e) => setOnlyUnassigned(e.target.checked)}
                  style={{ marginRight: 8, width: 18, height: 18 }}
                />
                <label
                  htmlFor="unassigned-checkbox"
                  className={styles.label}
                  style={{ margin: 0, fontWeight: 500, fontSize: 15, cursor: 'pointer' }}
                >
                  Đơn chưa được gán
                </label>
              </div>
              {/* Trạng thái filter */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Trạng thái</label>
                <select
                  className={styles.select}
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">Tất cả</option>
                  <option value="awaiting_payment">Chờ thanh toán</option>
                  <option value="pending">Chờ xác nhận</option>
                  <option value="processing">Đã xác nhận</option>
                  <option value="shipping">Vận chuyển</option>
                  <option value="delivering">Đang giao</option>
                  <option value="completed">Hoàn tất</option>
                  <option value="canceled">Hủy</option>
                  <option value="returned">Trả/Hoàn tiền</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Người phụ trách</label>
                <select
                  className={styles.select}
                  value={staffFilter}
                  onChange={(e) => setStaffFilter(e.target.value)}
                >
                  <option value="">Tất cả</option>
                  {staffs.map((s) => {
                    const count =
                      items.filter(
                        (o) =>
                          o.assignedStaffId &&
                          o.assignedStaffId.toString() === (s.id || s._id).toString(),
                      ).length || 0;
                    return (
                      <option key={s.id || s._id} value={s.id || s._id}>
                        {s.name || s.email} ({count} đơn)
                      </option>
                    );
                  })}
                </select>
              </div>
              {status && (
                <button className="btn" onClick={() => setStatus('')}>
                  Bỏ lọc
                </button>
              )}
            </div>

            <span className={styles.hint}>Tổng: {filteredItems.length}</span>
          </div>

          <div className={styles.right}>
            <div className={styles.searchBox}>
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

        {/* Bulk assign */}
        <div className={styles.bulkAssignBar}>
          {selectableOrders.length > 0 ? (
            <>
              <input type="checkbox" checked={allSelected} onChange={selectAll} />
              <label className={styles.selectAllLabel}>
                Chọn tất cả ({selectableOrders.length} đơn PENDING chưa gán)
              </label>
            </>
          ) : (
            <span className={styles.hint}>Không có đơn PENDING chưa gán</span>
          )}

          <select
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            className={styles.staffSelect}
          >
            <option value="">Chọn nhân viên để giao</option>
            {staffs.map((s) => (
              <option key={s.id || s._id} value={s.id || s._id}>
                {s.name || s.email}
              </option>
            ))}
          </select>

          <button
            className={'btn ' + styles.assignBtn}
            onClick={assignSelected}
            disabled={assigning || !staffId || selected.length === 0}
          >
            {assigning ? 'Đang giao...' : `Giao ${selected.length} đơn`}
          </button>
        </div>

        {/* List */}
        <div className={styles.list}>
          <div className={`${styles.row} ${styles.headerRow}`}>
            <div className={styles.cell} style={{ width: 40, textAlign: 'center' }}>
              <input type="checkbox" disabled />
            </div>
            <div className={`${styles.cell} ${styles.th}`}>Mã đơn</div>
            <div className={`${styles.cell} ${styles.th}`}>Khách hàng</div>
            <div className={`${styles.cell} ${styles.th}`}>Tổng tiền</div>
            <div className={`${styles.cell} ${styles.th}`}>Ngày tạo</div>
            <div className={`${styles.cell} ${styles.th}`}>Nhân viên phụ trách</div>
            <div className={`${styles.cell} ${styles.th} ${styles.center}`}>Trạng thái</div>
          </div>

          {!loading &&
            filteredItems.map((o) => {
              const id = o.id || o._id;
              const skey = statusKey(o.status);
              const isSelectable = !o.assignedStaffId && skey === 'PENDING';

              const staffName =
                staffs.find(
                  (s) =>
                    (s.id || s._id)?.toString() ===
                    (o.assignedStaffId ? o.assignedStaffId.toString() : ''),
                )?.name || (o.assignedStaffId ? 'Đã gán' : 'Chưa gán');

              return (
                <div
                  key={id}
                  className={[styles.row, styles.clickable, styles['hl_' + skey] || ''].join(' ')}
                >
                  <div className={styles.cell} style={{ width: 40, textAlign: 'center' }}>
                    {isSelectable ? (
                      <input
                        type="checkbox"
                        checked={selected.includes(id)}
                        onChange={() => toggleSelect(id)}
                        style={{ margin: 0 }}
                      />
                    ) : null}
                  </div>

                  <div
                    className={styles.cell}
                    onClick={() =>
                      navigate(`/orders/${o.id || o._id}`, {
                        state: { from: 'staff', backTo: '/dashboard/admin/orders' },
                      })
                    }
                    style={{ cursor: 'pointer', color: '#1976d2', fontWeight: 500 }}
                  >
                    {o.code || o._id}
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

                  <div className={styles.cell}>{staffName}</div>

                  <div className={`${styles.cell} ${styles.center}`}>
                    <span className={`${styles.statusPill} ${styles[`st_${skey}`] || ''}`}>
                      {STATUS_LABEL[skey] || o.status}
                    </span>
                  </div>
                </div>
              );
            })}

          {!loading && filteredItems.length === 0 && (
            <div className={styles.emptyBox}>
              <div style={{ fontSize: 38, color: '#bdbdbd', marginBottom: 8 }}>📭</div>
              <div style={{ fontWeight: 500, color: '#888', fontSize: 18, marginBottom: 2 }}>
                {q
                  ? 'Không tìm thấy đơn phù hợp.'
                  : status
                  ? 'Không có đơn hàng đợi xử lý.'
                  : 'Không có đơn.'}
              </div>
              <div style={{ color: '#bbb', fontSize: 14 }}>
                {q
                  ? 'Hãy thử từ khoá khác hoặc kiểm tra lại.'
                  : 'Khi có đơn mới, bạn sẽ thấy tại đây.'}
              </div>
            </div>
          )}
        </div>

        {/* Order detail modal */}
      </div>
    </>
  );
}
