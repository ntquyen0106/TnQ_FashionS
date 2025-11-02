import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ordersApi from '@/api/orders-api';
import { reviewsApi } from '@/api/reviews-api';
import styles from './OrderDetail.module.css';

const useCloudImage = () => {
  const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  return (snap, w = 96) => {
    if (!snap) return '/no-image.png';
    if (typeof snap === 'string' && /^https?:\/\//i.test(snap)) return snap;
    const pid = encodeURIComponent(snap).replace(/%2F/g, '/');
    return `https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto,dpr_auto,w_${w}/${pid}`;
  };
};

const Stars = ({ value, onChange, readOnly = false }) => {
  const Star = ({ idx }) => {
    const filled = idx <= value;
    return (
      <span
        onClick={readOnly ? undefined : () => onChange(idx)}
        onKeyDown={
          readOnly
            ? undefined
            : (e) => {
                if (e.key === 'Enter' || e.key === ' ') onChange(idx);
              }
        }
        role={readOnly ? undefined : 'button'}
        tabIndex={readOnly ? -1 : 0}
        aria-label={readOnly ? undefined : `Đánh giá ${idx} sao`}
        style={{
          cursor: readOnly ? 'default' : 'pointer',
          color: filled ? '#f59e0b' : '#d1d5db',
          fontSize: 28,
          lineHeight: 1,
        }}
      >
        ★
      </span>
    );
  };
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} idx={i} />
      ))}
    </div>
  );
};

export default function ReviewOrder() {
  const { id } = useParams();
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const buildImageUrl = useCloudImage();
  const [readOnly, setReadOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const o = await ordersApi.get(id);
        if (cancelled) return;
        // Only allow review for DONE or RETURNED
        const st = String(o.status || '').toUpperCase();
        if (!['DONE', 'RETURNED'].includes(st)) {
          setErr('Chỉ có thể đánh giá đơn hàng đã hoàn tất.');
        }
        setOrder(o);
      } catch (e) {
        if (!cancelled) setErr('Không tải được đơn hàng');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Detect if already reviewed, and preload rating/comment
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await reviewsApi.mine();
        const list = Array.isArray(res?.reviews) ? res.reviews : res || [];
        const found = list.find((rv) => String(rv.orderId) === String(id));
        if (found && !cancelled) {
          setReadOnly(true);
          setRating(Number(found.rating) || 0);
          setComment(found.comment || '');
          setErr('Bạn đã đánh giá đơn hàng này.');
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const submit = async () => {
    if (!rating) {
      alert('Vui lòng chọn số sao đánh giá');
      return;
    }
    setSubmitting(true);
    try {
      await reviewsApi.create({ orderId: id, rating, comment });
      nav(`/orders/${id}`);
    } catch (e) {
      // Errors are toasted by interceptor
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className={styles.wrap}>Đang tải…</div>;
  if (!order) return <div className={styles.wrap}>Không tìm thấy đơn hàng.</div>;

  const items = order.items || [];

  return (
    <div className={styles.wrap}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <button className={styles.back} onClick={() => nav(-1)} aria-label="Quay lại">
            <span className={styles.arrow}>←</span>
          </button>
          <div>
            <h2>{readOnly ? 'Xem đánh giá' : 'Đánh giá đơn hàng'}</h2>
            <div className={styles.subLine}>Mã đơn: {order.code || order._id}</div>
          </div>
          <div />
        </div>

        {err && (
          <div
            className={styles.infoBanner}
            style={{ background: '#fff1f2', borderColor: '#fecdd3', color: '#9f1239' }}
          >
            {err}
          </div>
        )}

        <section className={styles.card}>
          <h3>Sản phẩm trong đơn</h3>
          <div className={styles.items}>
            {items.map((it, idx) => (
              <div key={idx} className={styles.item}>
                <img src={buildImageUrl(it.imageSnapshot)} alt={it.nameSnapshot} />
                <div className={styles.meta}>
                  <div className={styles.name}>{it.nameSnapshot}</div>
                  {it.variantSku && <div className={styles.sku}>{it.variantSku}</div>}
                </div>
                <div className={styles.unit}></div>
                <div className={styles.qty}></div>
                <div className={styles.line}></div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.card}>
          <h3>Đánh giá của bạn</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <label>Chọn số sao</label>
              <Stars value={rating} onChange={setRating} readOnly={readOnly} />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <label>Bình luận (không bắt buộc)</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Chia sẻ cảm nhận về sản phẩm..."
                style={{
                  minHeight: 100,
                  padding: 10,
                  border: '1px solid #e5e7eb',
                  borderRadius: 10,
                }}
                disabled={readOnly}
              />
            </div>
          </div>
        </section>

        {!readOnly && (
          <div className={styles.bottomActions}>
            <button
              className={`btn ${styles.btnPrimary}`}
              onClick={submit}
              disabled={submitting || !!err}
            >
              {submitting ? 'Đang gửi…' : 'Gửi đánh giá'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
