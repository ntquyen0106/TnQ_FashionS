import { useEffect, useState } from 'react';
import { productsApi } from '@/api/products-api';
import ProductCard from './ProductCard';

export default function FeaturedProducts({
  title = 'Sản phẩm nổi bật',
  query = {},
  limit = 4,
  moreLink,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await productsApi.list({ limit, ...query });
        const list = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
        if (alive) setItems(list);
      } catch (e) {
        console.error('load featured products failed:', e);
        if (alive) setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [JSON.stringify(query), limit]);

  return (
    <section style={{ display: 'grid', gap: 12, marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>{title}</h2>
        {moreLink && (
          <a
            href={moreLink}
            style={{ marginLeft: 'auto', color: '#2563eb', textDecoration: 'none' }}
          >
            Xem tất cả →
          </a>
        )}
      </div>
      {loading ? (
        <div style={{ color: '#6b7280' }}>Đang tải…</div>
      ) : items.length ? (
        <div
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(4, 1fr)',
          }}
        >
          {items.map((p) => (
            <ProductCard product={p} key={p._id || p.slug} />
          ))}
        </div>
      ) : (
        <div style={{ color: '#6b7280' }}>Chưa có sản phẩm.</div>
      )}
    </section>
  );
}
