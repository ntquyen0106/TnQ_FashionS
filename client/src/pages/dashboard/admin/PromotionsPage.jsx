import { useEffect, useMemo, useState } from 'react';
import promotionsApi from '@/api/promotions-api'; // file này của bạn có export default
import { getCategories } from '@/api/category.js'; // đúng theo API bạn đang dùng
import { productsApi } from '@/api/products-api'; // named export
import { imgUrl } from '@/utils/image';
import ConfirmModal from '@/components/ConfirmModal';
import styles from './PromotionsPage.module.css';

/* ===================== helpers ===================== */

const toLocalDT = (v) => {
  if (!v) return '';
  const d = new Date(v);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
};
const toISO = (localDT) => (localDT ? new Date(localDT).toISOString() : null);

/* ================= i18n helpers ================ */
const typeLabel = (t) => {
  if (t === 'percent') return 'Phần trăm';
  if (t === 'amount') return 'Số tiền';
  return t || '';
};
const appliesLabel = (a) => {
  if (a === 'all') return 'Tất cả';
  if (a === 'category') return 'Danh mục';
  if (a === 'product') return 'Sản phẩm';
  return a || '';
};
const statusLabel = (s) => {
  if (s === 'active') return 'Đang hiệu lực';
  if (s === 'inactive') return 'Không hiệu lực';
  if (s === 'expired') return 'Hết hạn';
  if (s === 'upcoming') return 'Sắp diễn ra';
  return s || '';
};

// Chuẩn hoá danh mục (có thể trả về mảng trực tiếp hoặc {items:[...]})
const normCategories = (res) => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.items)) return res.items;
  return [];
};
// Chuẩn hoá sản phẩm (mảng, {items:[...]}, {data:[...]})
const normProducts = (res) => {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.items)) return res.items;
  if (Array.isArray(res?.data)) return res.data;
  return [];
};

// Xây cây danh mục từ mảng phẳng (cần có parentId, gốc = null/undefined)
const getId = (x) => String(x?._id || x?.id || '');
const buildCatTree = (list = []) => {
  const byId = new Map();
  list.forEach((c) => byId.set(getId(c), { ...c, children: [] }));
  const roots = [];
  list.forEach((c) => {
    const id = getId(c);
    const pid = c.parentId ? String(c.parentId) : null;
    if (pid && byId.has(pid)) byId.get(pid).children.push(byId.get(id));
    else roots.push(byId.get(id));
  });
  const sortNodes = (arr) => {
    arr.sort(
      (a, b) =>
        Number(a.sort ?? 0) - Number(b.sort ?? 0) ||
        String(a.name || a.title || '').localeCompare(String(b.name || b.title || '')),
    );
    arr.forEach((n) => n.children && sortNodes(n.children));
  };
  sortNodes(roots);
  return roots;
};

// Ảnh sản phẩm (Cloudinary, cùng style với Checkout của bạn)
const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const buildImageUrl = (snap, w = 56) => {
  if (!snap) return '/no-image.png';
  if (typeof snap === 'string' && /^https?:\/\//i.test(snap)) return snap;
  const pid = encodeURIComponent(snap).replace(/%2F/g, '/');
  return `https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto,dpr_auto,w_${w}/${pid}`;
};

/* ============== component cây danh mục (đệ quy) ============== */
function CategoryTree({ nodes = [], selected = new Set(), onToggle }) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {nodes.map((n) => {
        const id = getId(n);
        const checked = selected.has(id);
        return (
          <div key={id} style={{ display: 'grid', gap: 6 }}>
            <label
              style={{
                display: 'grid',
                gridTemplateColumns: '24px 1fr auto',
                alignItems: 'center',
              }}
            >
              <input type="checkbox" checked={checked} onChange={() => onToggle(id)} />
              <span style={{ fontWeight: 500 }}>{n.name || n.title || id}</span>
              <span style={{ color: '#6b7280', fontSize: 12 }}>{id}</span>
            </label>
            {n.children?.length > 0 && (
              <div style={{ paddingLeft: 20, borderLeft: '1px dashed #e5e7eb', marginLeft: 10 }}>
                <CategoryTree nodes={n.children} selected={selected} onToggle={onToggle} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ===================== main page ===================== */

export default function PromotionsPage() {
  const [nowTick, setNowTick] = useState(Date.now());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState({
    // BE-supported
    statusReq: '', // '' | 'active' | 'inactive'   (giữ nguyên tham số gửi BE)
    activeReq: '', // '' | 'true'                  (giữ nguyên tham số gửi BE)

    // UI-only (lọc ở FE)
    statusUI: '', // '' | 'effective' | 'inactive' | 'expired' | 'upcoming'
    // expiringMins removed — no longer showing "Gần hết hạn (phút)" filter
    sortEndAt: '', // '' | 'asc' | 'desc'
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState({
    code: '',
    type: 'percent',
    value: '',
    minOrder: 0,
    appliesTo: 'all', // all | category | product
    targetIds: [],
    startAt: '',
    endAt: '',
    status: 'inactive', // active | inactive
  });

  // Confirmation modal state
  const [confirmState, setConfirmState] = useState({
    open: false,
    title: '',
    message: '',
    confirmText: 'Xác nhận',
    confirmType: 'danger',
    onConfirm: null,
    cancelText: 'Hủy',
    hideCancel: false,
  });

  const openConfirm = (opts) => setConfirmState((s) => ({ ...s, ...opts, open: true }));
  const closeConfirm = () => setConfirmState((s) => ({ ...s, open: false, onConfirm: null }));

  // Picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState('category'); // 'category' | 'product'
  const [catList, setCatList] = useState([]);
  const [prodList, setProdList] = useState([]);
  const [query, setQuery] = useState('');
  // Temporary selection inside the picker. Changes here are committed only when user clicks "Xong".
  const [pickerTempTargets, setPickerTempTargets] = useState([]);

  useEffect(() => {
    if (!rows?.length) return;

    const now = Date.now();
    let next = Infinity;

    for (const r of rows) {
      const s = r.startAt && new Date(r.startAt).getTime();
      const e = r.endAt && new Date(r.endAt).getTime();

      if (s && s > now) next = Math.min(next, s);
      if (e && e > now) next = Math.min(next, e);
    }

    if (!isFinite(next)) return;

    const gap = next - Date.now();

    // Nếu còn <30s thì sau đúng giờ chuyển đổi UI xong → refetch API để sync BE
    const timeoutMs = gap < 30_000 ? gap + 500 : gap;

    const t = setTimeout(async () => {
      setNowTick(Date.now()); // UI chuyển ngay
      await fetchList(false); // sync nhẹ, không loading
    }, timeoutMs);

    return () => clearTimeout(t);
  }, [rows]);

  // dùng hàm renderStatus() khi in badge
  const renderStatus = (r) => {
    const now = nowTick; // dùng tick thay vì Date.now() trực tiếp
    const be = r.effectiveStatus;
    if (be) return be;

    if (r.status !== 'active') return 'inactive';
    const s = r.startAt ? new Date(r.startAt).getTime() : -Infinity;
    const e = r.endAt ? new Date(r.endAt).getTime() : Infinity;
    if (s > now) return 'upcoming';
    if (e < now) return 'expired';
    return 'active';
  };

  // thay thế fetchList hiện tại
  const shallowEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  const fetchList = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const params = {};
      if (filter.statusReq) params.status = filter.statusReq; // 'active' | 'inactive'
      if (filter.activeReq) params.active = filter.activeReq; // 'true'

      const data = await promotionsApi.list(params);
      if (!shallowEqual(rows, data)) setRows(data || []);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // lần đầu và khi đổi filter: có loading
  useEffect(() => {
    fetchList(true);
  }, [filter.status, filter.active]);

  // refetch nền khi quay lại tab (không chớp)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchList(false);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [filter.status, filter.active, rows]);

  // (tuỳ chọn) 5 phút refetch nền 1 lần
  useEffect(() => {
    const id = setInterval(() => fetchList(false), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [filter.status, filter.active, rows]);

  /* --------- open create / edit --------- */
  const openCreate = () => {
    setEditing(null);
    setForm({
      code: '',
      type: 'percent',
      value: '',
      minOrder: 0,
      appliesTo: 'all',
      targetIds: [],
      startAt: '',
      endAt: '',
      status: 'inactive',
    });
    setOpen(true);
  };

  const openEdit = (r) => {
    setEditing(r);
    setForm({
      code: r.code || '',
      type: r.type || 'percent',
      value: r.value ?? '',
      minOrder: r.minOrder ?? 0,
      appliesTo: r.appliesTo || 'all',
      targetIds: (r.targetIds || []).map(String),
      startAt: toLocalDT(r.startAt),
      endAt: toLocalDT(r.endAt),
      status: r.status || 'inactive',
    });
    setOpen(true);
  };

  // Initialize picker temp targets when opening picker
  const openPicker = () => {
    setPickerTempTargets(Array.isArray(form.targetIds) ? form.targetIds.map(String) : []);
    setPickerOpen(true);
    setPickerTab(form.appliesTo);
  };

  // Close picker and reset transient picker state (clear search & temp selections)
  const closePicker = () => {
    setPickerOpen(false);
    setQuery('');
    setPickerTempTargets([]);
  };

  /* --------- save / delete --------- */
  const save = async () => {
    const payload = {
      code: String(form.code || '')
        .trim()
        .toUpperCase(),
      type: form.type,
      value: Number(form.value) || 0,
      minOrder: Number(form.minOrder) || 0,
      appliesTo: form.appliesTo,
      targetIds: Array.isArray(form.targetIds) ? form.targetIds : [],
      startAt: toISO(form.startAt),
      endAt: toISO(form.endAt),
      status: form.status,
    };
    if (editing?._id) await promotionsApi.update(editing._id, payload);
    else await promotionsApi.create(payload);
    setOpen(false);
    fetchList();
  };

  const remove = async (id) => {
    openConfirm({
      title: 'Xoá khuyến mãi',
      message: 'Bạn có chắc muốn xoá khuyến mãi này? Thao tác không thể hoàn tác.',
      confirmText: 'Xoá',
      cancelText: 'Hủy',
      confirmType: 'danger',
      onConfirm: async () => {
        try {
          await promotionsApi.remove(id);
          fetchList();
        } finally {
          closeConfirm();
        }
      },
    });
  };

  const rowsFiltered = useMemo(() => {
    let out = Array.isArray(rows) ? rows.slice() : [];
    const now = nowTick;

    if (filter.statusUI) {
      out = out.filter((r) => {
        const st = renderStatus(r);
        if (filter.statusUI === 'effective') return st === 'active';
        if (filter.statusUI === 'inactive') return st === 'inactive';
        if (filter.statusUI === 'expired') return st === 'expired';
        if (filter.statusUI === 'upcoming') return st === 'upcoming';
        return true;
      });
    }

    // Note: expiring filter removed — no filtering by "expiring minutes"

    if (filter.sortEndAt) {
      out.sort((a, b) => {
        const ea = a.endAt ? new Date(a.endAt).getTime() : Infinity;
        const eb = b.endAt ? new Date(b.endAt).getTime() : Infinity;
        return filter.sortEndAt === 'asc' ? ea - eb : eb - ea;
      });
    }

    return out;
  }, [rows, filter.statusUI, filter.sortEndAt, nowTick]);

  /* --------- load picker data (categories/products) --------- */
  useEffect(() => {
    const boot = async () => {
      if (!pickerOpen) return;

      if (form.appliesTo === 'category') {
        try {
          const res = await getCategories({});
          setCatList(normCategories(res));
          setPickerTab('category');
        } catch {
          setCatList([]);
        }
      } else if (form.appliesTo === 'product') {
        try {
          const res = await productsApi.list({ q: query, limit: 20, page: 1 });
          setProdList(normProducts(res));
          setPickerTab('product');
          console.log('PRODUCTS:', res);
        } catch {
          setProdList([]);
        }
      }
    };
    boot();
  }, [pickerOpen, form.appliesTo, query]);

  /* --------- target selection helpers --------- */
  const toggleTarget = (id) => {
    const s = new Set(form.targetIds.map(String));
    const k = String(id);
    if (s.has(k)) s.delete(k);
    else s.add(k);
    setForm((f) => ({ ...f, targetIds: Array.from(s) }));
  };
  // Toggle inside picker only (temp state)
  const togglePickerTemp = (id) => {
    const k = String(id);
    const arr = Array.isArray(pickerTempTargets) ? pickerTempTargets.slice() : [];
    const idx = arr.indexOf(k);
    if (idx >= 0) arr.splice(idx, 1);
    else arr.push(k);
    setPickerTempTargets(arr);
  };
  const clearTargets = () => setForm((f) => ({ ...f, targetIds: [] }));

  // Tick mỗi giây để UI chuyển trạng thái đúng thời điểm
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  /* ===================== render ===================== */

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Quản lý khuyến mãi</h2>
        </div>
        <div className={styles.actions}>
          {/* Lọc trạng thái UI */}
          <select
            className={styles.select}
            value={filter.statusUI}
            onChange={(e) => setFilter((f) => ({ ...f, statusUI: e.target.value }))}
            title="Trạng thái hiển thị"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="effective">Đang hiệu lực</option>
            <option value="inactive">Không hiệu lực</option>
            <option value="expired">Hết hạn</option>
            <option value="upcoming">Sắp diễn ra</option>
          </select>

          {/* (removed) Gần hết hạn filter */}

          {/* Sắp xếp theo thời điểm kết thúc */}
          <select
            className={styles.select}
            value={filter.sortEndAt}
            onChange={(e) => setFilter((f) => ({ ...f, sortEndAt: e.target.value }))}
            title="Sắp xếp theo hạn kết thúc"
          >
            <option value="">Thứ tự thời gian</option>
            <option value="asc">Ít thời gian</option>
            <option value="desc">Nhiều thời gian</option>
          </select>

          <button className={styles.btnPrimary} onClick={openCreate}>
            + Thêm
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Mã</th>
                <th>Loại</th>
                <th>Giá trị</th>
                <th>Giá trị tối thiểu</th>
                <th>Áp dụng</th>
                <th>Bắt đầu</th>
                <th>Kết thúc</th>
                <th className={styles.center}>Trạng thái</th>
                <th className={styles.right}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className={styles.empty}>
                    Đang tải…
                  </td>
                </tr>
              ) : rowsFiltered.length ? (
                rowsFiltered.map((r) => (
                  <tr key={r._id}>
                    <td className={styles.bold}>{r.code}</td>
                    <td className={styles.muted}>{typeLabel(r.type)}</td>
                    <td>
                      {r.type === 'percent'
                        ? `${r.value}%`
                        : `${Number(r.value).toLocaleString()}₫`}
                    </td>
                    <td>{Number(r.minOrder || 0).toLocaleString()}₫</td>
                    <td className={styles.muted}>{appliesLabel(r.appliesTo)}</td>
                    <td>{r.startAt ? new Date(r.startAt).toLocaleString() : ''}</td>
                    <td>{r.endAt ? new Date(r.endAt).toLocaleString() : ''}</td>
                    <td className={styles.center}>
                      {(() => {
                        const st = renderStatus(r); // ✅ dùng helper đã tạo
                        let cls = styles.badgeGray;
                        if (st === 'active') cls = styles.badgeGreen;
                        if (st === 'expired') cls = styles.badgeRed;
                        if (st === 'upcoming') cls = styles.badgeYellow;
                        return <span className={cls}>{statusLabel(st)}</span>;
                      })()}
                    </td>

                    <td className={styles.right}>
                      <div className={styles.rowActions}>
                        <button className={styles.btnGhost} onClick={() => openEdit(r)}>
                          Sửa
                        </button>
                        <button className={styles.btnDanger} onClick={() => remove(r._id)}>
                          Xoá
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className={styles.empty}>
                    Chưa có khuyến mãi.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===================== modal create/edit ===================== */}
      {open && (
        <div className={styles.modalBackdrop} onClick={() => setOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {editing ? 'Sửa khuyến mãi' : 'Thêm khuyến mãi'}
              </h3>
            </div>

            {/* phần thân modal cuộn để tránh tràn lên header */}
            <div className={styles.modalBody}>
              <div className={styles.formGrid}>
                <div className={styles.formItem}>
                  <label>Mã</label>
                  <input
                    className={styles.input}
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                  />
                </div>

                <div className={styles.formItem}>
                  <label>Loại</label>
                  <select
                    className={styles.select}
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                  >
                    <option value="percent">{typeLabel('percent')}</option>
                    <option value="amount">{typeLabel('amount')}</option>
                  </select>
                </div>

                <div className={styles.formItem}>
                  <label>Giá trị</label>
                  <div className={styles.inputWithSuffixInline}>
                    <input
                      className={styles.input}
                      type="number"
                      placeholder={form.type === 'percent' ? 'Nhập %' : 'Nhập số tiền'}
                      value={form.value}
                      onChange={(e) => setForm({ ...form, value: e.target.value })}
                      inputMode={form.type === 'percent' ? 'decimal' : 'numeric'}
                    />
                    <span className={styles.inputSuffixInline}>
                      {form.type === 'percent' ? '%' : '₫'}
                    </span>
                  </div>
                </div>

                <div className={styles.formItem}>
                  <label>Đơn tối thiểu</label>
                  <input
                    className={styles.input}
                    type="number"
                    value={form.minOrder}
                    onChange={(e) => setForm({ ...form, minOrder: e.target.value })}
                  />
                </div>

                <div className={styles.formItem}>
                  <label>Áp dụng</label>
                  <select
                    className={styles.select}
                    value={form.appliesTo}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((f) => ({
                        ...f,
                        appliesTo: v,
                        targetIds: v === 'all' ? [] : f.targetIds,
                      }));
                    }}
                  >
                    <option value="all">{appliesLabel('all')}</option>
                    <option value="category">{appliesLabel('category')}</option>
                    <option value="product">{appliesLabel('product')}</option>
                  </select>
                </div>

                <div className={styles.formItemFull}>
                  <label>Đối tượng áp dụng</label>
                  {form.appliesTo === 'all' ? (
                    <div className={styles.muted}>Áp dụng toàn bộ sản phẩm</div>
                  ) : (
                    <>
                      <div className={styles.chips}>
                        {form.targetIds.length === 0 && (
                          <span className={styles.muted}>Chưa chọn</span>
                        )}
                        {form.targetIds.map((id) => (
                          <span key={id} className={styles.chip}>
                            {id}
                            <button className={styles.chipX} onClick={() => toggleTarget(id)}>
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className={styles.pickRow}>
                        <button className={styles.btnPrimary} onClick={() => openPicker()}>
                          {form.appliesTo === 'category' ? 'Chọn danh mục' : 'Chọn sản phẩm'}
                        </button>
                        {form.targetIds.length > 0 && (
                          <button className={styles.btnGhost} onClick={clearTargets}>
                            Xoá hết
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <div className={styles.formItem}>
                  <label>Bắt đầu</label>
                  <input
                    className={styles.input}
                    type="datetime-local"
                    value={form.startAt}
                    onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                  />
                </div>

                <div className={styles.formItem}>
                  <label>Kết thúc</label>
                  <input
                    className={styles.input}
                    type="datetime-local"
                    value={form.endAt}
                    onChange={(e) => setForm({ ...form, endAt: e.target.value })}
                  />
                </div>

                <div className={styles.formItem}>
                  <label>Trạng thái</label>
                  <select
                    className={styles.select}
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    <option value="inactive">{statusLabel('inactive')}</option>
                    <option value="active">{statusLabel('active')}</option>
                  </select>
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                className={styles.btnGhost}
                onClick={() =>
                  openConfirm({
                    title: 'Huỷ thay đổi',
                    message: 'Bạn có chắc muốn huỷ? Mọi thay đổi chưa lưu sẽ bị mất.',
                    confirmText: 'Xác nhận',
                    cancelText: 'Hủy',
                    confirmType: 'danger',
                    onConfirm: () => {
                      setOpen(false);
                      closeConfirm();
                    },
                  })
                }
              >
                Huỷ
              </button>
              <button
                className={styles.btnPrimary}
                onClick={() =>
                  openConfirm({
                    title: editing ? 'Lưu khuyến mãi' : 'Tạo khuyến mãi',
                    message: editing
                      ? 'Bạn có muốn lưu các thay đổi cho khuyến mãi này?'
                      : 'Bạn có muốn tạo khuyến mãi mới với thông tin hiện tại?',
                    confirmText: editing ? 'Lưu' : 'Tạo',
                    confirmType: 'primary',
                    onConfirm: async () => {
                      try {
                        await save();
                      } finally {
                        closeConfirm();
                      }
                    },
                  })
                }
              >
                {editing ? 'Lưu' : 'Tạo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== picker (category tree / product table) ===================== */}
      {pickerOpen && (
        <div className={styles.pickerBackdrop} onClick={() => closePicker()}>
          <div className={styles.picker} onClick={(e) => e.stopPropagation()}>
            <div className={styles.pickerHeader}>
              <div className={styles.tabs}>
                {form.appliesTo === 'category' ? (
                  <button className={`${styles.tab} ${styles.active}`}>Danh mục</button>
                ) : (
                  <>
                    <button
                      className={`${styles.tab} ${pickerTab === 'product' ? styles.active : ''}`}
                      onClick={() => setPickerTab('product')}
                    >
                      Sản phẩm
                    </button>
                  </>
                )}
              </div>
              {pickerTab === 'product' && (
                <input
                  className={styles.search}
                  placeholder="Tìm sản phẩm..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              )}
            </div>

            <div className={styles.pickerBody}>
              {form.appliesTo === 'category' ? (
                (() => {
                  const tree = buildCatTree(catList);
                  const selectedSet = new Set(pickerTempTargets.map(String));
                  return (
                    <div style={{ padding: '12px 16px' }}>
                      <CategoryTree
                        nodes={tree}
                        selected={selectedSet}
                        onToggle={(id) => togglePickerTemp(id)}
                      />
                    </div>
                  );
                })()
              ) : (
                <div className={styles.pickerTableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th style={{ width: 36 }} />
                        <th>Ảnh</th>
                        <th>Tên sản phẩm</th>
                        <th>ID</th>
                        <th className={styles.right}>Giá</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prodList.map((p) => {
                        const id = String(p._id || p.id);
                        const checked = pickerTempTargets.includes(id);
                        // Robust image selection: prefer explicit full URL, then Cloudinary public ids
                        let img = '/no-image.png';
                        if (p.imageUrl && /^https?:\/\//i.test(p.imageUrl)) img = p.imageUrl;
                        else if (p.imageUrl) img = p.imageUrl; // sometimes already a built URL
                        else if (p.imageSnapshot && /^https?:\/\//i.test(p.imageSnapshot))
                          img = p.imageSnapshot;
                        else if (p.imageSnapshot) img = buildImageUrl(p.imageSnapshot, 56);
                        else if (p.coverPublicId)
                          img = imgUrl(p.coverPublicId, { w: 56, h: 56, crop: 'fill' });
                        else if (p.thumbnail) img = buildImageUrl(p.thumbnail, 56);
                        else if (p.mainImage) img = buildImageUrl(p.mainImage, 56);

                        const price =
                          Number(
                            p.price ?? p.priceSnapshot ?? p.minPrice ?? p.variants?.[0]?.price ?? 0,
                          ) || 0;
                        return (
                          <tr key={id}>
                            <td>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => togglePickerTemp(id)}
                              />
                            </td>
                            <td>
                              <img
                                src={buildImageUrl(img, 56)}
                                alt={p.name || id}
                                width="56"
                                height="56"
                                style={{ borderRadius: 8, objectFit: 'cover' }}
                                onError={(e) => {
                                  e.currentTarget.src = '/no-image.png';
                                }}
                              />
                            </td>
                            <td className={styles.bold}>{p.name || p.title || 'Sản phẩm'}</td>
                            <td className={styles.muted} style={{ fontSize: 12 }}>
                              {id}
                            </td>
                            <td className={styles.right}>{price.toLocaleString()}₫</td>
                          </tr>
                        );
                      })}
                      {!prodList.length && (
                        <tr>
                          <td colSpan={5} className={styles.empty}>
                            Không có sản phẩm
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className={styles.pickerFooter}>
              <button className={styles.btnGhost} onClick={() => closePicker()}>
                Đóng
              </button>
              <button
                className={styles.btnPrimary}
                onClick={() => {
                  // Commit temp selection to the form and close picker
                  setForm((f) => ({
                    ...f,
                    targetIds: Array.isArray(pickerTempTargets) ? pickerTempTargets : [],
                  }));
                  closePicker();
                }}
              >
                Xong
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmModal
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        confirmType={confirmState.confirmType}
        onConfirm={confirmState.onConfirm}
        onCancel={closeConfirm}
        hideCancel={confirmState.hideCancel}
      />
    </div>
  );
}
