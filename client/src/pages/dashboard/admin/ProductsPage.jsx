// src/pages/dashboard/admin/ProductsPage.jsx
import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import Table from '@/components/Table';
import ConfirmModal from '@/components/ConfirmModal';
import { productsApi } from '@/api/products-api';
import { imgUrl } from '@/utils/image';
import { getCategories } from '@/api/category';
import styles from './ProductsPage.module.css';

export default function ProductsPage() {
  const nav = useNavigate();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(''); // '' = tất cả, 'active' | 'hidden'
  const [path, setPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState({ open: false, id: null });
  const [selected, setSelected] = useState([]);
  const [catTree, setCatTree] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await productsApi.list({
        q: q || undefined,
        page,
        limit,
        status: status || undefined,
        path: path || undefined,
      });
      setItems(res.items || []);
      setTotal(res.total || 0);
    } catch (e) {
      console.error('Load products failed', e);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, status]);

  // load categories (tree) for path filter
  useEffect(() => {
    let m = true;
    (async () => {
      try {
        const data = await getCategories({ status: 'active', asTree: 1 });
        if (m) setCatTree(data || []);
      } catch (e) {
        console.error('load cats failed', e);
      }
    })();
    return () => (m = false);
  }, []);

  // Auto fetch when q or path changes (debounced)
  useEffect(() => {
    setPage(1);
    const t = setTimeout(() => {
      fetchData();
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, path]);

  const toggleStatus = async (row) => {
    const next = row.status === 'active' ? 'hidden' : 'active';
    try {
      await productsApi.update(row._id, { status: next });
      setItems((arr) => arr.map((it) => (it._id === row._id ? { ...it, status: next } : it)));
    } catch (e) {
      // handled by http interceptor toast
    }
  };

  const removeItem = async (id) => {
    try {
      await productsApi.remove(id);
      setItems((arr) => arr.filter((x) => x._id !== id));
      setTotal((t) => Math.max(0, t - 1));
    } catch (e) {
      // handled by toast
    } finally {
      setConfirm({ open: false, id: null });
    }
  };

  // batch actions
  const batchHideShow = async (to) => {
    if (!selected.length) return;
    try {
      await Promise.all(selected.map((id) => productsApi.update(id, { status: to })));
      setItems((arr) => arr.map((x) => (selected.includes(x._id) ? { ...x, status: to } : x)));
      setSelected([]);
    } catch (e) {}
  };
  const batchDelete = async () => {
    if (!selected.length) return;
    try {
      await Promise.all(selected.map((id) => productsApi.remove(id)));
      setItems((arr) => arr.filter((x) => !selected.includes(x._id)));
      setTotal((t) => Math.max(0, t - selected.length));
      setSelected([]);
    } catch (e) {}
  };

  const pages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  const columns = useMemo(
    () => [
      {
        title: 'Ảnh',
        dataIndex: 'coverPublicId',
        key: 'cover',
        render: (v) =>
          v ? (
            <img
              src={imgUrl(v, { w: 64, h: 64, crop: 'fill' })}
              alt=""
              style={{ borderRadius: 8 }}
            />
          ) : (
            <div style={{ width: 64, height: 64, background: '#f2f2f2', borderRadius: 8 }} />
          ),
      },
      { title: 'Tên', dataIndex: 'name', key: 'name' },
      { title: 'Slug', dataIndex: 'slug', key: 'slug' },
      {
        title: 'Giá',
        dataIndex: 'minPrice',
        key: 'price',
        render: (v, row) =>
          row.minPrice === row.maxPrice
            ? formatVnd(row.minPrice)
            : `${formatVnd(row.minPrice)} - ${formatVnd(row.maxPrice)}`,
      },
      {
        title: 'Trạng thái',
        dataIndex: 'inStock',
        key: 'stock',
        render: (v) => (v ? 'Còn hàng' : 'Hết hàng'),
      },
      {
        title: 'Ẩn/Hiện',
        dataIndex: 'status',
        key: 'status',
        render: (v, row) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label className={styles.switch} title={v === 'active' ? 'Đang bán' : 'Đã ẩn'}>
              <input
                type="checkbox"
                checked={v === 'active'}
                onChange={async (e) => {
                  const next = e.target.checked ? 'active' : 'hidden';
                  // optimistic UI update
                  setItems((arr) =>
                    arr.map((it) => (it._id === row._id ? { ...it, status: next } : it)),
                  );
                  try {
                    await productsApi.update(row._id, { status: next });
                  } catch (err) {
                    // revert on error
                    setItems((arr) =>
                      arr.map((it) => (it._id === row._id ? { ...it, status: v } : it)),
                    );
                  }
                }}
              />
              <span className={styles.slider} />
            </label>
            <span
              className={`${styles.badge} ${
                v === 'active' ? styles.badgeActive : styles.badgeHidden
              }`}
            >
              {v === 'active' ? 'Đang bán' : 'Đã ẩn'}
            </span>
          </div>
        ),
      },
      {
        title: 'Thao tác',
        key: 'actions',
        render: (_, row) => (
          <div className={styles.actions}>
            <button
              className={`${styles.actionBtn} ${styles.iconBtn}`}
              onClick={() => nav(`/dashboard/admin/products/${row._id}`)}
            >
              <svg className={styles.icon} viewBox="0 0 20 20" fill="currentColor">
                <path d="M4 13.5V16h2.5L15 7.5l-2.5-2.5L4 13.5zM17 6l-3-3 1.5-1.5a1 1 0 011.414 0L18.5 3.5a1 1 0 010 1.414L17 6z" />
              </svg>
              Sửa
            </button>
            <button
              className={`${styles.actionBtn} ${styles.actionDanger} ${styles.iconBtn}`}
              onClick={() => setConfirm({ open: true, id: row._id })}
            >
              <svg className={styles.icon} viewBox="0 0 20 20" fill="currentColor">
                <path d="M6 6h8l-1 10H7L6 6zm3-3h2l1 1h4v2H4V4h4l1-1z" />
              </svg>
              Xóa
            </button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nav],
  );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>Quản lý sản phẩm</h2>
        <Link to="/dashboard/admin/products/new">
          <button className={styles.primaryBtn}>Thêm sản phẩm</button>
        </Link>
      </div>

      {/* Filters (auto apply) */}
      <div className={styles.filters}>
        <input
          className={styles.input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm theo tên, mô tả..."
        />
        <CategorySelectFlat tree={catTree} value={path} onChange={setPath} />
        <select
          className={styles.select}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Tất cả</option>
          <option value="active">Đang bán</option>
          <option value="hidden">Đã ẩn</option>
        </select>
      </div>

      {/* Batch actions when have selection */}
      {selected.length > 0 && (
        <div className={styles.batchBar}>
          <strong>Đã chọn {selected.length} sản phẩm</strong>
          <button
            className={`${styles.btn} ${styles.iconBtn}`}
            onClick={() => batchHideShow('active')}
          >
            <svg className={styles.icon} viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 4v12h-2V4h2zm4 0v12h-2V4h2z" />
            </svg>
            Hiện
          </button>
          <button
            className={`${styles.btn} ${styles.iconBtn}`}
            onClick={() => batchHideShow('hidden')}
          >
            <svg className={styles.icon} viewBox="0 0 20 20" fill="currentColor">
              <path d="M4 10h12v2H4z" />
            </svg>
            Ẩn
          </button>
          <button
            className={`${styles.btn} ${styles.btnDanger} ${styles.iconBtn}`}
            onClick={batchDelete}
          >
            <svg className={styles.icon} viewBox="0 0 20 20" fill="currentColor">
              <path d="M6 6h8l-1 10H7L6 6zm3-3h2l1 1h4v2H4V4h4l1-1z" />
            </svg>
            Xóa
          </button>
        </div>
      )}

      <div className={`${styles.card} ${styles.tableWrap}`}>
        {loading ? (
          <div style={{ padding: 16, color: '#666' }}>Đang tải…</div>
        ) : (
          <Table
            columns={columns}
            data={items}
            rowKey="_id"
            rowSelection={{ selectedRowKeys: selected, onChange: setSelected }}
          />
        )}
      </div>

      {/* Pagination */}
      <div className={styles.pagination}>
        <button
          className={styles.pagerBtn}
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          ← Trước
        </button>
        <span>
          Trang {page}/{pages} • Tổng {total}
        </span>
        <button
          className={styles.pagerBtn}
          disabled={page >= pages}
          onClick={() => setPage((p) => Math.min(pages, p + 1))}
        >
          Sau →
        </button>
        <select
          className={styles.select}
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
        >
          {[10, 20, 30, 50].map((n) => (
            <option key={n} value={n}>
              {n}/trang
            </option>
          ))}
        </select>
      </div>

      <ConfirmModal
        open={confirm.open}
        title="Xóa sản phẩm"
        message={<div>Bạn có chắc muốn xóa sản phẩm này? Hành động không thể hoàn tác.</div>}
        confirmText="Xóa"
        confirmType="danger"
        onCancel={() => setConfirm({ open: false, id: null })}
        onConfirm={() => removeItem(confirm.id)}
      />
    </div>
  );
}

function formatVnd(n) {
  const num = Number(n || 0);
  return num.toLocaleString('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  });
}

function CategorySelectFlat({ tree = [], value, onChange }) {
  const options = useMemo(() => flattenTree(tree), [tree]);
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ padding: 8 }}>
      <option value="">Danh mục (tất cả)</option>
      {options.map((c) => (
        <option key={c._id} value={c.path}>
          {'— '.repeat(c.depth)}
          {c.name}
        </option>
      ))}
    </select>
  );
}

function flattenTree(nodes = [], depth = 0) {
  const out = [];
  for (const n of nodes) {
    out.push({ _id: n._id, name: n.name, path: n.path, depth });
    if (n.children?.length) out.push(...flattenTree(n.children, depth + 1));
  }
  return out;
}
