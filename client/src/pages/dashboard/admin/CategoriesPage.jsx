import { useEffect, useMemo, useState } from 'react';
import ConfirmModal from '@/components/ConfirmModal';
import styles from './CategoriesPage.module.css';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory as apiDeleteCategory,
} from '../../../api/category';

const getId = (x) => (x ? x.id || x._id : undefined);
const toSlug = (s = '') =>
  String(s)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

function buildTree(flat = []) {
  const byId = new Map();
  flat.forEach((n) => byId.set(getId(n), { ...n, children: [] }));
  const roots = [];
  byId.forEach((node) => {
    const pid = node.parentId ? String(node.parentId) : '';
    if (pid && byId.has(pid)) byId.get(pid).children.push(node);
    else roots.push(node);
  });
  // sort children by sort ascending
  const sortRec = (arr) => {
    arr.sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0));
    arr.forEach((n) => sortRec(n.children || []));
  };
  sortRec(roots);
  return roots;
}

export default function CategoriesPage() {
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(new Set()); // ids đang mở
  const [selectedId, setSelectedId] = useState(null);
  const [q, setQ] = useState('');

  // form state (pane phải)
  const sel = useMemo(
    () => all.find((x) => String(getId(x)) === String(selectedId)) || null,
    [all, selectedId],
  );
  const [form, setForm] = useState({
    name: '',
    slug: '',
    parentId: '',
    status: 'active',
    sort: 0,
  });
  const [saving, setSaving] = useState(false);
  const [confirmState, setConfirmState] = useState({
    open: false,
    type: 'create',
    title: '',
    message: '',
  });

  const reload = async () => {
    setLoading(true);
    try {
      // Admin cần thấy tất cả (active + hidden)
      const data = await getCategories({ status: '' });
      const list = (Array.isArray(data) ? data : null) ?? data?.items ?? data?.content ?? [];
      setAll(list);
      // auto-expand root level
      const rootIds = list.filter((x) => !x.parentId).map(getId);
      setExpanded(new Set(rootIds.map(String)));
      // auto-select first
      if (!selectedId && list.length) setSelectedId(getId(list[0]));
    } catch (e) {
      console.error(e);
      setAll([]);
      alert('Không tải được danh mục');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cập nhật form khi đổi selection
  useEffect(() => {
    if (!sel) {
      setForm({ name: '', slug: '', parentId: '', status: 'active', sort: 0 });
      return;
    }
    setForm({
      name: sel.name || '',
      slug: sel.slug || '',
      parentId: sel.parentId || '',
      status: sel.status || 'active',
      sort: Number(sel.sort || 0),
    });
  }, [sel]);

  const tree = useMemo(() => {
    // nếu có q: lọc theo tên/slug (vẫn giữ cấu trúc, nhưng chỉ hiện nhánh khớp)
    const list = all;
    if (!q.trim()) return buildTree(list);
    const term = q.trim().toLowerCase();
    const idSet = new Set();
    const byId = new Map(list.map((n) => [String(getId(n)), n]));
    // đánh dấu node khớp + ancestor
    list.forEach((n) => {
      if (
        String(n.name || '')
          .toLowerCase()
          .includes(term) ||
        String(n.slug || '')
          .toLowerCase()
          .includes(term)
      ) {
        let cur = n;
        while (cur) {
          const id = String(getId(cur));
          if (idSet.has(id)) break;
          idSet.add(id);
          cur = cur.parentId ? byId.get(String(cur.parentId)) : null;
        }
      }
    });
    const filtered = list.filter((n) => idSet.has(String(getId(n))));
    // auto expand khi search
    const exp = new Set(expanded);
    filtered.forEach((n) => exp.add(String(getId(n))));
    setExpanded(exp);
    return buildTree(filtered);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, q]);

  const toggleExpand = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      const sid = String(id);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  };

  const onChangeField = (key, val) => {
    setForm((f) => ({ ...f, [key]: val }));
    if (key === 'name' && !sel) {
      // khi thêm mới, auto slug theo tên; khi edit thì cho sửa tay
      setForm((f) => ({ ...f, slug: toSlug(val) }));
    }
  };

  // Tạo danh sách option dạng cây với thụt lề rõ ràng
  const parentsOptions = useMemo(() => {
    // Không cho chọn chính nó làm cha
    const list = all.filter((x) => String(getId(x)) !== String(selectedId));
    // Xây dựng cây
    const byId = new Map(list.map((n) => [String(getId(n)), { ...n, children: [] }]));
    byId.forEach((node) => {
      const pid = node.parentId ? String(node.parentId) : '';
      if (pid && byId.has(pid)) byId.get(pid).children.push(node);
    });
    // Đệ quy flatten cây thành mảng option với depth
    const result = [];
    function walk(nodes, depth = 0) {
      nodes.forEach((n) => {
        result.push({ id: getId(n), label: n.name, depth });
        if (n.children?.length) walk(n.children, depth + 1);
      });
    }
    // Lấy root nodes
    const roots = Array.from(byId.values()).filter(
      (n) => !n.parentId || !byId.has(String(n.parentId)),
    );
    walk(roots, 0);
    return result;
  }, [all, selectedId]);

  const handleSave = async (e) => {
    e?.preventDefault?.();
    if (!sel) {
      setConfirmState({
        open: true,
        type: 'create',
        title: 'Xác nhận tạo danh mục',
        message: 'Bạn có chắc chắn muốn tạo danh mục mới?',
      });
      return;
    }
    setConfirmState({
      open: true,
      type: 'update',
      title: 'Xác nhận cập nhật',
      message: 'Bạn có chắc chắn muốn lưu thay đổi cho danh mục này?',
    });
  };

  const handleConfirmSave = async () => {
    setConfirmState({ ...confirmState, open: false });
    setSaving(true);
    try {
      if (sel) {
        const payload = {
          name: form.name,
          slug: form.slug || toSlug(form.name),
          parentId: form.parentId || null,
          status: form.status,
          sort: Number(form.sort || 0),
        };
        const updated = await updateCategory(getId(sel), payload);
        setAll((prev) =>
          prev.map((x) => (String(getId(x)) === String(getId(updated)) ? updated : x)),
        );
      } else {
        const payload = {
          name: form.name,
          slug: form.slug || toSlug(form.name),
          parentId: form.parentId || null,
          status: form.status,
          sort: Number(form.sort || 0),
        };
        const created = await createCategory(payload);
        setAll((prev) => [created, ...prev]);
        setSelectedId(getId(created));
      }
    } catch (e2) {
      console.error(e2);
      alert('Lưu danh mục thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!sel) return;
    // không cho xóa nếu còn con
    const hasChild = all.some((x) => String(x.parentId || '') === String(selectedId));
    if (hasChild) {
      setConfirmState({
        open: true,
        type: 'error',
        title: 'Không thể xóa',
        message: 'Vui lòng xóa các danh mục con trước khi xóa danh mục này.',
      });
      return;
    }
    setConfirmState({
      open: true,
      type: 'delete',
      title: 'Xác nhận xóa',
      message: `Bạn có chắc chắn muốn xóa danh mục "${sel.name}"? Thao tác này không thể hoàn tác.`,
    });
  };

  const handleConfirmDelete = async () => {
    setConfirmState({ ...confirmState, open: false });
    try {
      await apiDeleteCategory(getId(sel));
      setAll((prev) => prev.filter((x) => String(getId(x)) !== String(selectedId)));
      setSelectedId(null);
    } catch (e) {
      console.error(e);
      setConfirmState({
        open: true,
        type: 'error',
        title: 'Lỗi',
        message: 'Xóa danh mục thất bại. Vui lòng thử lại.',
      });
    }
  };

  const addChild = () => {
    // chuyển form sang chế độ thêm mới, preset parentId = selectedId
    setSelectedId(null);
    setForm({
      name: '',
      slug: '',
      parentId: selectedId || '',
      status: 'active',
      sort: 0,
    });
  };

  // sắp xếp trong cùng cấp: đổi sort rồi lưu
  const reorderSibling = async (node, dir = -1) => {
    const pid = node.parentId || '';
    const siblings = all
      .filter((x) => String(x.parentId || '') === String(pid))
      .sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0));
    const idx = siblings.findIndex((x) => String(getId(x)) === String(getId(node)));
    const targetIdx = idx + dir;
    if (idx < 0 || targetIdx < 0 || targetIdx >= siblings.length) return;

    // hoán đổi sort 2 phần tử
    const a = siblings[idx];
    const b = siblings[targetIdx];
    const aSort = Number(a.sort || 0);
    const bSort = Number(b.sort || 0);

    try {
      const [ua, ub] = await Promise.all([
        updateCategory(getId(a), { sort: bSort }),
        updateCategory(getId(b), { sort: aSort }),
      ]);
      // cập nhật local
      setAll((prev) =>
        prev.map((x) => {
          if (String(getId(x)) === String(getId(ua))) return ua;
          if (String(getId(x)) === String(getId(ub))) return ub;
          return x;
        }),
      );
    } catch (e) {
      console.error(e);
      alert('Sắp xếp thất bại');
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h2 className={styles.title}>Quản lý danh mục</h2>
        <div className={styles.headerRight}>
          <div className={styles.searchBox}>
            <input
              placeholder="Tìm theo tên hoặc slug…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <svg viewBox="0 0 24 24" aria-hidden className={styles.searchIcon}>
              <circle cx="11" cy="11" r="8" stroke="currentColor" fill="none" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" />
            </svg>
          </div>
          <button className={styles.btn} onClick={reload}>
            Tải lại
          </button>
        </div>
      </div>

      <div className={styles.grid}>
        {/* LEFT: TREE */}
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}>Cấu trúc danh mục</div>
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => {
                setSelectedId(null);
                setForm({ name: '', slug: '', parentId: '', status: 'active', sort: 0 });
              }}
            >
              + Thêm danh mục gốc
            </button>
          </div>

          <div className={styles.tree}>
            {loading ? (
              <div className={styles.muted}>Đang tải…</div>
            ) : tree.length === 0 ? (
              <div className={styles.empty}>Chưa có danh mục</div>
            ) : (
              <TreeNodes
                nodes={tree}
                expanded={expanded}
                selectedId={selectedId}
                onToggle={toggleExpand}
                onSelect={(id) => setSelectedId(id)}
                onAddChild={addChild}
                onMoveUp={(n) => reorderSibling(n, -1)}
                onMoveDown={(n) => reorderSibling(n, +1)}
              />
            )}
          </div>
        </section>

        {/* RIGHT: FORM */}
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardTitle}>
              {sel ? 'Chi tiết danh mục' : 'Thêm danh mục mới'}
            </div>
            {sel && (
              <div className={styles.actions}>
                <button className={styles.btn} onClick={addChild}>
                  + Thêm danh mục con
                </button>
                <button className={`${styles.btn} ${styles.btnDanger}`} onClick={handleDelete}>
                  Xóa
                </button>
              </div>
            )}
          </div>

          <form className={styles.form} onSubmit={handleSave}>
            <div className={styles.formRow}>
              <label className={styles.label} htmlFor="cat-name">
                Tên danh mục
              </label>
              <input
                id="cat-name"
                className={styles.input}
                required
                value={form.name}
                onChange={(e) => onChangeField('name', e.target.value)}
                placeholder="Ví dụ: Áo thun"
                autoComplete="off"
              />
            </div>

            <div className={styles.formRow}>
              <label className={styles.label} htmlFor="cat-slug">
                Slug
              </label>
              <input
                id="cat-slug"
                className={styles.input}
                value={form.slug}
                onChange={(e) => onChangeField('slug', e.target.value)}
                placeholder="ao-thun"
                autoComplete="off"
              />
            </div>

            <div className={styles.formRow}>
              <label className={styles.label} htmlFor="cat-parent">
                Danh mục cha
              </label>
              <select
                id="cat-parent"
                className={styles.input}
                value={form.parentId || ''}
                onChange={(e) => onChangeField('parentId', e.target.value)}
              >
                <option value="">— Không có (Root)</option>
                {parentsOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {`${'  '.repeat(p.depth)}${p.label}`}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.twoCols}>
              <div className={styles.formRow}>
                <label className={styles.label} htmlFor="cat-status">
                  Trạng thái
                </label>
                <select
                  id="cat-status"
                  className={styles.input}
                  value={form.status}
                  onChange={(e) => onChangeField('status', e.target.value)}
                >
                  <option value="active">Hiển thị</option>
                  <option value="hidden">Ẩn</option>
                </select>
              </div>

              <div className={styles.formRow}>
                <label className={styles.label} htmlFor="cat-sort">
                  Thứ tự (trong cùng cấp)
                </label>
                <input
                  id="cat-sort"
                  className={styles.input}
                  type="number"
                  value={form.sort}
                  onChange={(e) => onChangeField('sort', e.target.value)}
                />
              </div>
            </div>

            {/* Thông tin chỉ xem */}
            <div className={`${styles.formRow} ${styles.readonlyBox}`}>
              <div className={styles.label}>Thông tin</div>
              <div className={styles.infoGrid}>
                <div>
                  <span className={styles.k}>ID</span>
                  <span className={styles.v}>{sel ? getId(sel) : '—'}</span>
                </div>
                <div>
                  <span className={styles.k}>Depth</span>
                  <span className={styles.v}>{sel?.depth ?? '—'}</span>
                </div>
                <div>
                  <span className={styles.k}>Path</span>
                  <span className={styles.v}>{sel?.path ?? '—'}</span>
                </div>
              </div>
            </div>

            <div className={styles.formActions}>
              <button type="button" className={styles.btn} onClick={reload}>
                Hủy thay đổi
              </button>
              <button
                type="submit"
                className={`${styles.btn} ${styles.btnPrimary}`}
                disabled={saving}
              >
                {saving ? 'Đang lưu…' : sel ? 'Lưu thay đổi' : 'Tạo danh mục'}
              </button>
            </div>
          </form>
        </section>
      </div>
      <ConfirmModal
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={
          confirmState.type === 'error'
            ? 'Đóng'
            : saving
            ? 'Đang xử lý…'
            : confirmState.type === 'delete'
            ? 'Xóa'
            : confirmState.type === 'update'
            ? 'Lưu'
            : 'Tạo'
        }
        cancelText="Hủy"
        confirmType={
          confirmState.type === 'delete' || confirmState.type === 'error' ? 'danger' : 'primary'
        }
        disabled={saving}
        hideCancel={confirmState.type === 'error'}
        onConfirm={() => {
          if (confirmState.type === 'error') {
            setConfirmState({ ...confirmState, open: false });
          } else if (confirmState.type === 'delete') {
            handleConfirmDelete();
          } else {
            handleConfirmSave();
          }
        }}
        onCancel={() => setConfirmState({ ...confirmState, open: false })}
      />
    </div>
  );
}

/* ---------------- Tree nodes ---------------- */

function TreeNodes({
  nodes,
  expanded,
  selectedId,
  onToggle,
  onSelect,
  onAddChild,
  onMoveUp,
  onMoveDown,
  level = 1,
}) {
  return (
    <ul className={styles.treeList}>
      {nodes.map((n, idx) => {
        const id = getId(n);
        const isOpen = expanded.has(String(id));
        const hasChildren = (n.children || []).length > 0;
        const isSelected = String(selectedId) === String(id);

        return (
          <li key={id} className={styles.treeItem}>
            <div
              className={[styles.treeRow, isSelected ? styles.treeRowActive : ''].join(' ')}
              style={{ paddingLeft: 8 + (level - 1) * 16 }}
            >
              <button
                type="button"
                className={styles.chev}
                onClick={() => onToggle(id)}
                disabled={!hasChildren}
                title={hasChildren ? (isOpen ? 'Thu gọn' : 'Mở rộng') : 'Không có danh mục con'}
              >
                {hasChildren ? (isOpen ? '▾' : '▸') : '•'}
              </button>
              <button
                type="button"
                className={styles.nodeName}
                onClick={() => onSelect(id)}
                title={n.slug || ''}
              >
                {n.name}
                {n.status === 'hidden' && <span className={styles.badge}>Ẩn</span>}
              </button>
              <div className={styles.rowActions}>
                <button className={styles.iconBtn} onClick={() => onMoveUp(n)} title="Lên">
                  ↑
                </button>
                <button className={styles.iconBtn} onClick={() => onMoveDown(n)} title="Xuống">
                  ↓
                </button>
                <button
                  className={styles.iconBtn}
                  onClick={() => {
                    onSelect(id);
                    onAddChild();
                  }}
                  title="Thêm danh mục con"
                >
                  ＋
                </button>
              </div>
            </div>

            {hasChildren && isOpen && (
              <TreeNodes
                nodes={n.children}
                expanded={expanded}
                selectedId={selectedId}
                onToggle={onToggle}
                onSelect={onSelect}
                onAddChild={onAddChild}
                onMoveUp={onMoveUp}
                onMoveDown={onMoveDown}
                level={level + 1}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
