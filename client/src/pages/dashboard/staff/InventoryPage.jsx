import { useEffect, useMemo, useState } from 'react';
import http from '@/api/http';
import styles from './InventoryPage.module.css';
import { imgUrl } from '@/utils/image';

export default function InventoryPage() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  // Stock filter: all | in | out | low (low uses lowThreshold)
  const [stockFilter, setStockFilter] = useState('all');
  const [lowThreshold, setLowThreshold] = useState(5);
  const [cats, setCats] = useState([]);
  const [catPath, setCatPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [adjustSku, setAdjustSku] = useState('');
  const [adjustOld, setAdjustOld] = useState(0);
  const [adjustNew, setAdjustNew] = useState(0);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustReason, setAdjustReason] = useState('');
  const [sortBy, setSortBy] = useState(''); // '' | 'stock' | 'price'
  const [sortDir, setSortDir] = useState('asc'); // 'asc' | 'desc'

  const load = async () => {
    setLoading(true);
    try {
      const r = await http.get('/inventory', { params: { q, categoryPath: catPath || undefined } });
      setItems(r.data.items || []);
    } catch (e) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catPath]);

  useEffect(() => {
    (async () => {
      try {
        const r = await http.get('/categories', { params: { status: 'active', asTree: true } });
        setCats(r.data || []);
      } catch {
        setCats([]);
      }
    })();
  }, []);

  const flatCats = useMemo(() => {
    const out = [];
    const walk = (nodes, depth = 0) => {
      (nodes || []).forEach((n) => {
        out.push({ id: n._id, name: n.name, path: n.path, depth });
        if (n.children && n.children.length) walk(n.children, depth + 1);
      });
    };
    walk(Array.isArray(cats) ? cats : [], 0);
    return out;
  }, [cats]);

  const filteredProducts = useMemo(() => {
    // Category filter đã thực hiện ở API; ở đây chỉ giữ nguyên danh sách để lọc tiếp ở cấp biến thể
    return Array.isArray(items) ? items : [];
  }, [items]);

  const flatRows = useMemo(() => {
    const text = q.trim().toLowerCase();
    const rows = [];
    (filteredProducts || []).forEach((p) => {
      const variants = Array.isArray(p.variants) ? p.variants : [];
      variants.forEach((v) => {
        const stock = Number(v.stock || 0);
        // Stock filter at variant level
        const matchStock =
          stockFilter === 'all'
            ? true
            : stockFilter === 'in'
            ? stock > 0
            : stockFilter === 'out'
            ? stock <= 0
            : stockFilter === 'low'
            ? stock > 0 && stock <= Number(lowThreshold || 0)
            : true;
        if (!matchStock) return;
        // Text search: match product name/slug or variant sku
        const matchText = !text
          ? true
          : (p.name || '').toLowerCase().includes(text) ||
            (p.slug || '').toLowerCase().includes(text) ||
            String(v.sku || '')
              .toLowerCase()
              .includes(text);
        if (!matchText) return;
        rows.push({ p, v });
      });
    });
    // Sorting
    if (sortBy === 'stock') {
      rows.sort((a, b) => {
        const da = Number(a.v.stock || 0);
        const db = Number(b.v.stock || 0);
        return sortDir === 'asc' ? da - db : db - da;
      });
    } else if (sortBy === 'price') {
      rows.sort((a, b) => {
        const da = Number(a.v.price || 0);
        const db = Number(b.v.price || 0);
        return sortDir === 'asc' ? da - db : db - da;
      });
    }
    return rows;
  }, [filteredProducts, q, stockFilter, lowThreshold, sortBy, sortDir]);

  const openAdjust = (sku, currentStock = 0) => {
    setAdjustSku(sku);
    const cur = Number(currentStock || 0);
    setAdjustOld(cur);
    setAdjustNew(cur);
    setAdjustReason('');
    setAdjustOpen(true);
  };

  const submitAdjust = async () => {
    try {
      const delta = Number(adjustNew) - Number(adjustOld);
      if (!Number.isFinite(delta)) return;
      await http.post('/inventory/adjust', { sku: adjustSku, delta, reason: adjustReason });
      setAdjustOpen(false);
      await load();
    } catch (e) {
      // optionally show toast
    }
  };

  const exportCsv = () => {
    const rows = [];
    rows.push(['Product', 'Slug', 'SKU', 'Color', 'Size', 'Stock', 'Price']);
    flatRows.forEach(({ p, v }) => {
      rows.push([
        p.name,
        p.slug,
        v.sku,
        v.color || '',
        v.size || '',
        String(v.stock ?? ''),
        String(v.price ?? ''),
      ]);
    });
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    a.download = `inventory-${ts}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.wrap}>
      <h2 className={styles.title}>Kho hàng</h2>
      <div className={styles.toolbar}>
        <div className={styles.left}>
          <select
            className={styles.input}
            value={catPath}
            onChange={(e) => setCatPath(e.target.value)}
          >
            <option value="">Tất cả danh mục</option>
            {flatCats.map((c) => (
              <option key={c.path} value={c.path}>{`${'— '.repeat(c.depth)}${c.name}`}</option>
            ))}
          </select>
          <input
            className={styles.input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm sản phẩm hoặc slug"
          />
          <label className={styles.toggle}>
            Lọc tồn:
            <select
              className={styles.input}
              style={{ minWidth: 140 }}
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
            >
              <option value="all">Tất cả</option>
              <option value="in">Còn hàng</option>
              <option value="out">Hết hàng</option>
              <option value="low">Sắp hết</option>
            </select>
            {stockFilter === 'low' && (
              <span className={styles.muted}>
                Ngưỡng:
                <input
                  className={styles.input}
                  type="number"
                  min={1}
                  value={lowThreshold}
                  onChange={(e) => setLowThreshold(Number(e.target.value || 0))}
                  style={{ width: 90, marginLeft: 6 }}
                />
              </span>
            )}
          </label>
          <button className={`btn ${styles.btnSecondary}`} onClick={exportCsv} disabled={loading}>
            Xuất CSV
          </button>
        </div>
        <div className={styles.rightMeta}>Đang hiển thị: {flatRows.length} biến thể</div>
      </div>
      <div className={styles.list}>
        {flatRows.length > 0 ? (
          <div className={styles.varTable}>
            <div className={styles.varHeader}>
              <div>Sản phẩm</div>
              <div>SKU</div>
              <div>Màu</div>
              <div>Size</div>
              <div
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  setSortBy((s) => (s === 'stock' ? s : 'stock'));
                  setSortDir((d) => (sortBy === 'stock' ? (d === 'asc' ? 'desc' : 'asc') : 'asc'));
                }}
              >
                Tồn {sortBy === 'stock' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </div>
              <div
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  setSortBy((s) => (s === 'price' ? s : 'price'));
                  setSortDir((d) => (sortBy === 'price' ? (d === 'asc' ? 'desc' : 'asc') : 'asc'));
                }}
              >
                Giá {sortBy === 'price' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </div>
              <div>Hành động</div>
            </div>
            {flatRows.map(({ p, v }, idx) => {
              const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
              const primary = (p.images || []).find((im) => im.isPrimary) || (p.images || [])[0];
              const publicId = v.imagePublicId || primary?.publicId;
              const photo =
                cloudName && publicId ? imgUrl(publicId, { w: 56, h: 56, crop: 'fill' }) : '';
              return (
                <div className={styles.variant} key={`${p._id}-${v.sku}-${idx}`}>
                  <div className={styles.prodCell}>
                    {photo ? (
                      <img className={styles.thumb} src={photo} alt={p.name} />
                    ) : (
                      <div className={styles.noThumb} aria-label="No image" />
                    )}
                    <div>
                      <div className={styles.prodName}>{p.name}</div>
                      <div className={styles.prodMeta}>Slug: {p.slug}</div>
                    </div>
                  </div>
                  <div>{v.sku}</div>
                  <div>{v.color || '-'}</div>
                  <div>{v.size || '-'}</div>
                  <div>{v.stock}</div>
                  <div>{Number(v.price).toLocaleString('vi-VN')} đ</div>
                  <div className={styles.actionCell}>
                    <button
                      className={`btn ${styles.btnInline}`}
                      onClick={() => openAdjust(v.sku, v.stock)}
                    >
                      Cập nhật tồn
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.empty}>Không có dữ liệu.</div>
        )}
      </div>
      {adjustOpen && (
        <div className={styles.modalBackdrop} onClick={() => setAdjustOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>Cập nhật tồn kho</h3>
            <div className={styles.modalRow}>
              <label>SKU</label>
              <div>{adjustSku}</div>
            </div>
            <div className={styles.modalRow}>
              <label>Tồn hiện tại</label>
              <div>{adjustOld}</div>
            </div>
            <div className={styles.modalRow}>
              <label>Tồn mới</label>
              <input
                type="number"
                value={adjustNew}
                onChange={(e) => setAdjustNew(e.target.value)}
              />
            </div>
            <div className={styles.modalRow}>
              <label>Lý do</label>
              <input
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="Nhập hàng / Điều chỉnh / Trả..."
              />
            </div>
            <div className={styles.modalActions}>
              <button className="btn" onClick={() => setAdjustOpen(false)}>
                Huỷ
              </button>
              <button className={`btn ${styles.btnPrimary}`} onClick={submitAdjust}>
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
