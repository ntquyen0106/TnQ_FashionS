import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { promotionsApi } from '@/api/promotions-api';

const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;

const buildImg = (publicId, t = 'w_500,h_500,c_fill,g_auto,f_auto,q_auto') =>
  CLOUD && publicId ? `https://res.cloudinary.com/${CLOUD}/image/upload/${t}/${publicId}` : '';

const getPrimaryImageId = (p) => {
  const arr = Array.isArray(p?.images) ? p.images : [];
  const primary = arr.find((x) => x.isPrimary) || arr[0];
  return primary?.publicId || '';
};

const formatVND = (n) => new Intl.NumberFormat('vi-VN').format(n);
const toNumber = (val) => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[^\d.-]/g, ''); // remove currency symbols, spaces, separators
    const num = Number(cleaned);
    return num;
  }
  return NaN;
};

const getPriceRange = (p) => {
  const variants = Array.isArray(p?.variants) ? p.variants : [];
  if (!variants.length) return null;
  const prices = variants.map((v) => toNumber(v?.price)).filter((x) => Number.isFinite(x) && x > 0);
  if (!prices.length) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return { min, max };
};

export default function ProductCard({ product }) {
  const [promos, setPromos] = useState([]);
  const imgId = getPrimaryImageId(product);
  const img = buildImg(imgId);
  const price = getPriceRange(product);
  const to = `/product/${product.slug}`;

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        if (!product?._id) return;
        const data = await promotionsApi.available(0, {
          all: true,
          productIds: [product._id],
        });
        // Store full promo objects for discount calculation
        const applicablePromos = (data || []).filter((p) => p.applicable).slice(0, 2);
        if (isMounted) setPromos(applicablePromos);
      } catch (e) {
        // ignore
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [product?._id]);

  // Calculate maximum discount if multiple promotions apply
  let discountPercent = 0;
  let discountAmount = 0;
  let finalPrice = price?.min;
  let hasDiscount = false;
  let isPercentPromo = false;

  if (price?.min && promos.length > 0) {
    let maxDiscount = 0;
    let maxDiscountPercent = 0;

    for (const promo of promos) {
      let discount = 0;
      let percentValue = 0;

      if (promo.type === 'percent') {
        discount = Math.round(price.min * (promo.value / 100));
        percentValue = promo.value;

        if (discount > maxDiscount) {
          maxDiscount = discount;
          maxDiscountPercent = percentValue;
          isPercentPromo = true;
        }
      } else if (promo.type === 'amount') {
        discount = promo.value;

        if (discount > maxDiscount) {
          maxDiscount = discount;
          maxDiscountPercent = 0; // Don't show % for amount type
          isPercentPromo = false;
        }
      }
    }

    if (maxDiscount > 0) {
      hasDiscount = true;
      discountAmount = maxDiscount;
      discountPercent = isPercentPromo ? maxDiscountPercent : 0;
      finalPrice = Math.max(0, price.min - maxDiscount);
    }
  }

  return (
    <Link to={to} className="product-card" style={styles.card} aria-label={product.name}>
      <div style={styles.media}>
        {img ? (
          <img src={img} alt={product.name} style={styles.img} />
        ) : (
          <div style={styles.fallback} />
        )}
        {hasDiscount && (
          <div style={styles.discountBadge}>
            {isPercentPromo
              ? `-${Math.round(discountPercent)}%`
              : `Giảm ${formatVND(discountAmount)}đ`}
          </div>
        )}
      </div>
      <div style={styles.body}>
        <h3 style={styles.title} title={product.name}>
          {product.name}
        </h3>
        {price ? (
          hasDiscount ? (
            <div style={styles.priceBox}>
              <div style={styles.priceNow}>{`${formatVND(finalPrice)} đ`}</div>
              <div style={styles.priceOld}>{`${formatVND(price.min)} đ`}</div>
            </div>
          ) : (
            <div style={styles.price}>{`${formatVND(price.min)} đ`}</div>
          )
        ) : (
          <div style={styles.priceMuted}>Liên hệ</div>
        )}
        {!!promos.length && (
          <div style={styles.promoRow}>
            {promos.map((p) => (
              <span key={p.code} style={styles.promoTag} title={`Khuyến mãi: ${p.code}`}>
                {p.code}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

const styles = {
  card: {
    display: 'grid',
    gridTemplateRows: '1fr auto',
    border: '1px solid #eee',
    borderRadius: 12,
    background: '#fff',
    textDecoration: 'none',
    overflow: 'hidden',
    transition: 'transform .15s ease, box-shadow .15s ease',
  },
  media: { width: '100%', aspectRatio: '1 / 1', background: '#f7f7f7', position: 'relative' },
  img: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  fallback: {
    width: '100%',
    height: '100%',
    background: 'linear-gradient(135deg,#f3f4f6,#e5e7eb)',
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    background: '#dc2626',
    color: '#fff',
    fontSize: 12,
    fontWeight: 700,
    padding: '4px 8px',
    borderRadius: 6,
    boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)',
  },
  body: { padding: '12px 12px 14px' },
  title: {
    margin: 0,
    color: '#111827',
    fontSize: 15,
    fontWeight: 700,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  priceBox: { marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 },
  priceNow: { color: '#dc2626', fontWeight: 800, fontSize: 15 },
  priceOld: { color: '#9ca3af', fontSize: 13, textDecoration: 'line-through', fontWeight: 500 },
  price: { marginTop: 6, color: '#e11d48', fontWeight: 800 },
  priceMuted: { marginTop: 6, color: '#6b7280', fontWeight: 600 },
  promoRow: { marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' },
  promoTag: {
    display: 'inline-block',
    fontSize: 12,
    fontWeight: 700,
    color: '#b91c1c',
    background: '#fff1f2',
    border: '1px solid #fecdd3',
    padding: '2px 6px',
    borderRadius: 6,
    lineHeight: 1.4,
  },
};
