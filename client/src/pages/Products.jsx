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
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(n) + 'đ';

export default function Products() {
  const [sp, setSp] = useSearchParams();

  // === Query params ===
  const path = sp.get('path') || ''; // từ Navbar
  const q = sp.get('q') || '';
  const isPromoPage = (path || '').toLowerCase() === 'khuyen-mai';
  const sort = sp.get('sort') || (isPromoPage ? 'best' : 'price:asc'); // price:asc | price:desc | newest | best
  const selectedPromo = sp.get('promo') || '';
  const page = parseInt(sp.get('page') || '1', 10);
  const limit = parseInt(sp.get('limit') || '24', 10);

  // === State ===
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [promosByProduct, setPromosByProduct] = useState({}); // id -> [promo objects with type, value, code]
  const [salesByProduct, setSalesByProduct] = useState({}); // id -> sold qty
  const [activePromos, setActivePromos] = useState([]); // available promotions for tiles

  // === Title theo path ===
  const title = useMemo(() => {
    const last = (path ? path.split('/') : []).pop() || 'Sản phẩm';
    return last.replace(/-/g, ' ').toUpperCase();
  }, [path]);

  // === Fetch ===
  useEffect(() => {
    let alive = true;
    setLoading(true);

    const params = { q, sort, page, limit };
    if (!isPromoPage && path) params.path = path; // trang khuyến mãi: lấy tất cả sp rồi lọc ở FE

    productsApi
      .list(params)
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

  // If on promotion page, fetch all currently available promotions to show nice tiles
  useEffect(() => {
    if (!isPromoPage) return;
    let alive = true;
    (async () => {
      try {
        const list = await promotionsApi.available(0, { all: true });
        if (!alive) return;
        // Only take active ones; sort by best value: percent desc first, then amount desc
        const sorted = (Array.isArray(list) ? list : [])
          .filter((p) => p && p.status !== 'inactive')
          .sort((a, b) => {
            const aIsPct = a.type === 'percent';
            const bIsPct = b.type === 'percent';
            if (aIsPct && bIsPct) return (b.value || 0) - (a.value || 0);
            if (aIsPct !== bIsPct) return aIsPct ? -1 : 1; // percent trước
            return (b.value || 0) - (a.value || 0);
          });
        setActivePromos(sorted);
      } catch {
        setActivePromos([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [isPromoPage]);

  // Fetch applicable promotions for products in the current page (store full promo objects)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const next = {};
        const tasks = (rows || []).map(async (p) => {
          const id = p?._id;
          if (!id) return;
          try {
            const data = await promotionsApi.available(0, { all: true, productIds: [id] });
            next[id] = (data || []).filter((x) => x.applicable);
          } catch {
            next[id] = [];
          }
        });
        await Promise.all(tasks);
        if (alive) setPromosByProduct(next);
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [rows]);

  // Fetch sold count for products on current page
  useEffect(() => {
    let alive = true;
    (async () => {
      const ids = (rows || []).map((x) => x?._id).filter(Boolean);
      if (!ids.length) return;
      try {
        const res = await productsApi.salesCount(ids);
        const counts = res?.counts || {};
        if (alive) setSalesByProduct((prev) => ({ ...prev, ...counts }));
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
    if ('q' in kv || 'sort' in kv || 'path' in kv || 'promo' in kv) next.set('page', '1');
    setSp(next, { replace: true });
  };

  // Helper: compute the maximum discount amount for a product (for sorting use)
  const getMaxDiscount = (p) => {
    const rawPrice =
      p.minPrice ??
      (Array.isArray(p.variants) && p.variants.length
        ? Math.min(...p.variants.map((v) => Number(v?.price ?? NaN)))
        : undefined);
    if (!Number.isFinite(rawPrice)) return 0;
    const promoList = promosByProduct[p._id] || [];
    let max = 0;
    for (const promo of promoList) {
      if (promo.type === 'percent') max = Math.max(max, Math.round(rawPrice * (promo.value / 100)));
      else if (promo.type === 'amount') max = Math.max(max, promo.value || 0);
    }
    return max;
  };

  // Derived rows for render on khuyen-mai page
  const rowsForRender = useMemo(() => {
    let arr = rows.slice();
    if (isPromoPage) {
      // show only products that have at least 1 applicable promotion
      arr = arr.filter((p) => (promosByProduct[p._id] || []).length > 0);
      if (selectedPromo) {
        arr = arr.filter((p) =>
          (promosByProduct[p._id] || []).some((x) => x.code === selectedPromo),
        );
      }
      if (sort === 'best') {
        arr = arr.sort((a, b) => getMaxDiscount(b) - getMaxDiscount(a));
      }
    }
    return arr;
  }, [rows, isPromoPage, promosByProduct, selectedPromo, sort]);

  return (
    <div className={`container ${s.wrap}`}>
      {/* Header + controls */}
      <div className={s.header}>
        <h1 style={{ margin: '12px 0' }}>{title}</h1>

        <div className={s.controls}>
          {/* Display label (quick search removed - main search exists elsewhere) */}
          <div className={s.displayLabel} aria-hidden="true">
            Hiện thị
          </div>

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => setParam({ sort: e.target.value })}
            aria-label="Sắp xếp"
            className={s.select}
          >
            {isPromoPage && <option value="best">Giảm nhiều nhất</option>}
            <option value="price:asc">Giá thấp → cao</option>
            <option value="price:desc">Giá cao → thấp</option>
            <option value="newest">Mới nhất</option>
          </select>
        </div>
      </div>

      <p className={s.count}>
        {Intl.NumberFormat('vi-VN').format(isPromoPage ? rowsForRender.length : total)} sản phẩm
      </p>

      {/* Promotion tiles (only for /khuyen-mai) */}
      {isPromoPage && (
        <div className={s.dealStrip}>
          <div className={s.dealGrid}>
            {activePromos.map((p, idx) => {
              const isActive = selectedPromo === p.code;
              const isPercent = p.type === 'percent';
              return (
                <button
                  key={p.code}
                  className={`${s.dealCard} ${isActive ? s.dealActive : ''}`}
                  onClick={() => setParam({ promo: isActive ? '' : p.code })}
                  title={`Áp dụng: ${p.code}`}
                  style={{
                    animationDelay: `${idx * 0.08}s`,
                  }}
                >
                  <div className={s.dealBadge}>HOT DEAL</div>
                  <span className={s.dealKicker}>GIẢM ĐẾN</span>
                  <span className={s.dealTitle}>
                    {isPercent ? `${p.value}%` : formatVND(p.value)}
                  </span>
                  <span className={s.dealCode}>{p.code}</span>
                  {isPercent && <div className={s.dealPercentIcon}>%</div>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <p>Đang tải…</p>
      ) : rowsForRender.length === 0 ? (
        <div className={s.empty}>Không có sản phẩm phù hợp.</div>
      ) : (
        <div className={s.grid}>
          {rowsForRender.map((p) => {
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

            // Calculate maximum discount if multiple promotions apply
            const promoList = promosByProduct[p._id] || [];
            let finalPrice = rawPrice;
            let discountPercent = 0;
            let discountAmount = 0;
            let bestPromo = null;
            let isPercentPromo = false;

            if (hasPrice && promoList.length > 0) {
              // Calculate discount for each promotion and pick the one with maximum savings
              let maxDiscount = 0;
              let maxDiscountPercent = 0;

              for (const promo of promoList) {
                let discount = 0;
                let percentValue = 0;

                if (promo.type === 'percent') {
                  discount = Math.round(rawPrice * (promo.value / 100));
                  percentValue = promo.value;

                  if (discount > maxDiscount) {
                    maxDiscount = discount;
                    maxDiscountPercent = percentValue;
                    bestPromo = promo;
                    isPercentPromo = true;
                  }
                } else if (promo.type === 'amount') {
                  discount = promo.value;

                  if (discount > maxDiscount) {
                    maxDiscount = discount;
                    maxDiscountPercent = 0; // Don't show % for amount type
                    bestPromo = promo;
                    isPercentPromo = false;
                  }
                }
              }

              discountAmount = maxDiscount;
              discountPercent = maxDiscountPercent;
              finalPrice = Math.max(0, rawPrice - discountAmount);

              // Debug log
              if (p._id) {
                console.log(
                  `${p.name}: raw=${rawPrice}, final=${finalPrice}, discount=${discountAmount}, %=${discountPercent}, promo=${bestPromo?.code}`,
                );
              }
            }

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
                    {discountAmount > 0 && (
                      <div className={s.discountBadge}>
                        {isPercentPromo && discountPercent > 0
                          ? `-${discountPercent}%`
                          : `Giảm ${formatVND(discountAmount)}`}
                      </div>
                    )}
                  </div>

                  <div className={s.info}>
                    <div className={s.name}>{p.name}</div>
                    {hasPrice ? (
                      <div className={s.priceBox}>
                        {discountAmount > 0 ? (
                          <>
                            <div className={s.priceNow}>{formatVND(finalPrice)}</div>
                            <div className={s.priceOldWrap}>
                              <div className={s.priceOld}>{formatVND(rawPrice)}</div>
                              {!isPercentPromo && (
                                <span className={s.discountNote}>
                                  (Giảm {formatVND(discountAmount)})
                                </span>
                              )}
                            </div>
                          </>
                        ) : (
                          <div className={s.price}>{formatVND(rawPrice)}</div>
                        )}
                      </div>
                    ) : (
                      <div className={s.price}>Liên hệ</div>
                    )}
                    <div className={s.metaRow}>
                      {Number(p.ratingCount || 0) > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: '#f59e0b', fontWeight: 700 }}>★</span>
                          <span>{Number(p.ratingAvg).toFixed(1)}</span>
                        </div>
                      )}
                      <div>
                        {Intl.NumberFormat('vi-VN').format(Number(p.ratingCount || 0))} đánh giá
                      </div>
                      <div>
                        {Intl.NumberFormat('vi-VN').format(Number(salesByProduct[p._id] || 0))} đã
                        bán
                      </div>
                    </div>
                    {!!promosByProduct[p._id]?.length && (
                      <div className={s.promoRow}>
                        {promosByProduct[p._id].map((promo) => (
                          <span
                            key={promo.code}
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
                            title={`Khuyến mãi: ${promo.code}`}
                          >
                            {promo.code}
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
