import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { productsApi } from '@/api/products-api';
import { promotionsApi } from '@/api/promotions-api';
import s from './Products.module.css';

// Cloudinary helper
const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const img = (publicId, w = 700) =>
  publicId && CLOUD
    ? `https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto,dpr_auto,w_${w}/${encodeURIComponent(
        publicId,
      )}`
    : '/no-image.png';

const formatVND = (n) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(n) + ' VND';

export default function Products() {
  const [sp, setSp] = useSearchParams();

  // === Query params ===
  const path = sp.get('path') || ''; // từ Navbar
  const q = sp.get('q') || '';
  const sort = sp.get('sort') || 'price:asc'; // price:asc | price:desc | newest
  const page = parseInt(sp.get('page') || '1', 10);
  const limit = parseInt(sp.get('limit') || '24', 10);

  // === State ===
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [promosByProduct, setPromosByProduct] = useState({}); // id -> [codes]

  // === Title theo path ===
  const title = useMemo(() => {
    const last = (path ? path.split('/') : []).pop() || 'Sản phẩm';
    return last.replace(/-/g, ' ').toUpperCase();
  }, [path]);

  // === Fetch ===
  useEffect(() => {
    let alive = true;
    setLoading(true);

    productsApi
      .list({ path, q, sort, page, limit })
      .then((res) => {
        const items = res.items ?? res.data ?? [];
        if (!alive) return;
        setRows(items);
        setTotal(res.total ?? items.length ?? 0);
        setPages(res.pages ?? 1);
      })
      .catch(() => {
        if (!alive) return;
        setRows([]);
        setTotal(0);
        setPages(1);
      })
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [path, q, sort, page, limit]);

  // Fetch applicable promo codes for products in the current page (show tags)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const next = {};
        for (const p of rows || []) {
          const id = p?._id;
          if (!id) continue;
          // cache: if already have, reuse
          if (promosByProduct[id]) {
            next[id] = promosByProduct[id];
            continue;
          }
          try {
            const data = await promotionsApi.available(0, { all: true, productIds: [id] });
            next[id] = (data || [])
              .filter((x) => x.applicable)
              .map((x) => x.code)
              .slice(0, 2);
          } catch {
            next[id] = [];
          }
        }
        if (alive) setPromosByProduct((prev) => ({ ...prev, ...next }));
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [rows]);

  // === Helpers ===
  const setParam = (kv) => {
    const next = new URLSearchParams(sp);
    Object.entries(kv).forEach(([k, v]) =>
      v == null || v === '' ? next.delete(k) : next.set(k, String(v)),
    );
    // reset page về 1 khi đổi filter chính
    if ('q' in kv || 'sort' in kv || 'path' in kv) next.set('page', '1');
    setSp(next, { replace: true });
  };

  return (
    <div className={`container ${s.wrap}`}>
      {/* Header + controls */}
      <div className={s.header}>
        <h1 style={{ margin: '12px 0' }}>{title}</h1>

        <div className={s.controls}>
          {/* Search nhanh */}
          <input
            defaultValue={q}
            placeholder="Tìm kiếm nhanh…"
            onKeyDown={(e) => {
              if (e.key === 'Enter') setParam({ q: e.currentTarget.value });
            }}
            className={s.search}
            aria-label="Tìm kiếm sản phẩm"
          />

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => setParam({ sort: e.target.value })}
            aria-label="Sắp xếp"
            className={s.select}
          >
            <option value="price:asc">Giá thấp → cao</option>
            <option value="price:desc">Giá cao → thấp</option>
            <option value="newest">Mới nhất</option>
          </select>
        </div>
      </div>

      <p className={s.count}>{Intl.NumberFormat('vi-VN').format(total)} sản phẩm</p>

      {/* List */}
      {loading ? (
        <p>Đang tải…</p>
      ) : rows.length === 0 ? (
        <div className={s.empty}>Không có sản phẩm phù hợp.</div>
      ) : (
        <div className={s.grid}>
          {rows.map((p) => {
            // Ảnh trước / sau
            const primaryImg =
              p.coverPublicId ||
              p.images?.find?.((im) => im?.isPrimary)?.publicId ||
              p.images?.[0]?.publicId;

            const secondaryImg =
              p.images?.find?.((im) => !im?.isPrimary)?.publicId ||
              (p.images?.length > 1 ? p.images?.[1]?.publicId : null);

            // console.log(p.name, p.images, primaryImg, secondaryImg);
            const rawPrice =
              p.minPrice ??
              (Array.isArray(p.variants) && p.variants.length
                ? Math.min(...p.variants.map((v) => Number(v?.price ?? NaN)))
                : undefined);

            const hasPrice = Number.isFinite(rawPrice);

            return (
              <Link
                key={p._id}
                to={`/product/${p.slug || p._id}`}
                style={{ textDecoration: 'none', color: '#111' }}
              >
                <div className={s.card}>
                  <div className={s.imgBox}>
                    <img src={img(primaryImg)} alt={p.name} className={s.imgFront} loading="lazy" />
                    {secondaryImg && (
                      <img
                        src={img(secondaryImg)}
                        alt={`${p.name} back`}
                        className={s.imgBack}
                        loading="lazy"
                      />
                    )}
                  </div>

                  <div className={s.info}>
                    <div className={s.name}>{p.name}</div>
                    <div className={s.price}>{hasPrice ? formatVND(rawPrice) : 'Liên hệ'}</div>
                    {!!promosByProduct[p._id]?.length && (
                      <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {promosByProduct[p._id].map((code) => (
                          <span
                            key={code}
                            style={{
                              display: 'inline-block',
                              fontSize: 12,
                              fontWeight: 700,
                              color: '#b91c1c',
                              background: '#fff1f2',
                              border: '1px solid #fecdd3',
                              padding: '2px 6px',
                              borderRadius: 6,
                              lineHeight: 1.3,
                            }}
                            title={`Khuyến mãi: ${code}`}
                          >
                            {code}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className={s.pagination}>
          {Array.from({ length: pages }).map((_, i) => {
            const active = page === i + 1;
            const cls = active ? s.pageBtnActive : s.pageBtn;
            return (
              <button
                key={i}
                onClick={() => !active && setParam({ page: i + 1 })}
                aria-label={`Trang ${i + 1}`}
                className={cls}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
