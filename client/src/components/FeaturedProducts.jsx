import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { productsApi } from '@/api/products-api';
import ProductCard from './ProductCard';
import styles from './FeaturedProducts.module.css';

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
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.title}>{title}</h2>
        {moreLink && (
          <Link to={moreLink} className={styles.linkMore}>
            Khám phá
          </Link>
        )}
      </div>
      {loading ? (
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <span>Đang tải sản phẩm...</span>
        </div>
      ) : items.length ? (
        <div className={styles.grid}>
          {items.map((p) => (
            <ProductCard product={p} key={p._id || p.slug} />
          ))}
        </div>
      ) : (
        <div className={styles.empty}>Chưa có sản phẩm.</div>
      )}
    </section>
  );
}
