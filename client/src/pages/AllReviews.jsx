import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { reviewsApi } from '@/api/reviews-api';
import { productsApi } from '@/api/products-api';
import styles from './AllReviews.module.css';

const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const buildImageUrl = (publicId, w = 80) => {
  if (!publicId) return '/no-image.png';
  if (typeof publicId === 'string' && /^https?:\/\//i.test(publicId)) return publicId;
  const pid = encodeURIComponent(publicId).replace(/%2F/g, '/');
  return `https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto,dpr_auto,w_${w}/${pid}`;
};

const buildVideoUrl = (publicId) => {
  if (!publicId) return '';
  if (typeof publicId === 'string' && /^https?:\/\//i.test(publicId)) return publicId;
  const pid = encodeURIComponent(publicId).replace(/%2F/g, '/');
  return `https://res.cloudinary.com/${CLOUD}/video/upload/${pid}`;
};

const Stars = ({ value }) => {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          style={{
            color: i <= value ? '#f59e0b' : '#d1d5db',
            fontSize: 16,
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
};

const ReviewItem = ({ review, expanded, onToggle }) => {
  const userName = review.userId?.name || 'Khách hàng';
  const comment = review.comment || '';
  const shouldTruncate = comment.length > 300;
  const displayComment = !expanded && shouldTruncate ? comment.substring(0, 300) + '...' : comment;

  return (
    <div className={styles.reviewItem}>
      <div className={styles.reviewHeader}>
        <div className={styles.reviewUser}>
          {review.userId?.avatar && (
            <img
              src={buildImageUrl(review.userId.avatar, 40)}
              alt={userName}
              className={styles.avatar}
            />
          )}
          <div>
            <div className={styles.userName}>{userName}</div>
            <Stars value={review.rating} />
          </div>
        </div>
        <div className={styles.reviewDate}>
          {new Date(review.createdAt).toLocaleDateString('vi-VN')}
        </div>
      </div>

      {review.variantSku && <div className={styles.variantSku}>Phân loại: {review.variantSku}</div>}

      {comment && (
        <div className={styles.reviewComment}>
          {displayComment}
          {shouldTruncate && (
            <button onClick={onToggle} className={styles.readMore}>
              {expanded ? 'Thu gọn' : 'Xem thêm'}
            </button>
          )}
        </div>
      )}

      {review.images && review.images.length > 0 && (
        <div className={styles.reviewImages}>
          {review.images.map((img, idx) => (
            <img
              key={idx}
              src={buildImageUrl(img, 120)}
              alt={`Review ${idx + 1}`}
              className={styles.reviewImage}
            />
          ))}
        </div>
      )}

      {review.video && (
        <video src={buildVideoUrl(review.video)} controls className={styles.reviewVideo} />
      )}
    </div>
  );
};

export default function AllReviews() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [allReviews, setAllReviews] = useState([]); // Store all reviews for counting
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterRating, setFilterRating] = useState(0); // 0 = all
  const [expandedReviews, setExpandedReviews] = useState({});
  const limit = 10;

  useEffect(() => {
    if (!productId) return;

    let cancelled = false;
    (async () => {
      try {
        const p = await productsApi.detail(productId);
        if (!cancelled) setProduct(p);
      } catch (e) {
        console.error('Failed to load product:', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [productId]);

  // Load all reviews for counting
  useEffect(() => {
    if (!productId) return;

    let cancelled = false;
    (async () => {
      try {
        const data = await reviewsApi.byProduct(productId, { page: 1, limit: 1000 });
        if (!cancelled) {
          setAllReviews(data.reviews || []);
        }
      } catch (e) {
        console.error('Failed to load all reviews:', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [productId]);

  useEffect(() => {
    if (!productId) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await reviewsApi.byProduct(productId, { page, limit });
        if (!cancelled) {
          let filteredReviews = data.reviews || [];
          if (filterRating > 0) {
            filteredReviews = filteredReviews.filter((r) => r.rating === filterRating);
          }
          setReviews(filteredReviews);
          setTotal(data.total || 0);
        }
      } catch (e) {
        console.error('Failed to load reviews:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [productId, page, filterRating]);

  const toggleExpand = (reviewId) => {
    setExpandedReviews((prev) => ({
      ...prev,
      [reviewId]: !prev[reviewId],
    }));
  };

  const totalPages = Math.ceil(total / limit);

  // Count reviews by rating
  const ratingCounts = [5, 4, 3, 2, 1].reduce((acc, rating) => {
    acc[rating] = allReviews.filter((r) => r.rating === rating).length;
    return acc;
  }, {});

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          ← Quay lại
        </button>
        <div>
          <h2>Đánh giá sản phẩm</h2>
          {product && <div className={styles.productName}>{product.name}</div>}
        </div>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.filterLabel}>Lọc theo đánh giá:</div>
        <div className={styles.filterButtons}>
          <button
            className={filterRating === 0 ? styles.active : ''}
            onClick={() => {
              setFilterRating(0);
              setPage(1);
            }}
          >
            Tất cả ({allReviews.length})
          </button>
          {[5, 4, 3, 2, 1].map((rating) => (
            <button
              key={rating}
              className={filterRating === rating ? styles.active : ''}
              onClick={() => {
                setFilterRating(rating);
                setPage(1);
              }}
            >
              {rating} ★ ({ratingCounts[rating] || 0})
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>Đang tải đánh giá...</div>
      ) : reviews.length === 0 ? (
        <div className={styles.empty}>
          {filterRating > 0
            ? `Chưa có đánh giá ${filterRating} sao`
            : 'Chưa có đánh giá nào cho sản phẩm này'}
        </div>
      ) : (
        <>
          <div className={styles.reviewList}>
            {reviews.map((review) => (
              <ReviewItem
                key={review._id}
                review={review}
                expanded={expandedReviews[review._id]}
                onToggle={() => toggleExpand(review._id)}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                ← Trước
              </button>
              <span>
                Trang {page} / {totalPages}
              </span>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Sau →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
