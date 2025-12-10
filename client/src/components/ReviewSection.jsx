import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { reviewsApi } from '@/api/reviews-api';
import styles from './ReviewSection.module.css';

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

const formatReplyDate = (value) => {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('vi-VN');
  } catch (err) {
    return value;
  }
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
  const userName =
    review.customerName ||
    review.userId?.name ||
    review.orderId?.shippingAddress?.fullName ||
    review.userName ||
    'Khách hàng';
  const comment = review.comment || '';
  const shouldTruncate = comment.length > 200;
  const displayComment = !expanded && shouldTruncate ? comment.substring(0, 200) + '...' : comment;
  const avatarSrc = review.customerAvatar || review.userId?.avatar;
  const latestReply = Array.isArray(review.replies)
    ? review.replies[review.replies.length - 1]
    : null;

  return (
    <div className={styles.reviewItem}>
      <div className={styles.reviewHeader}>
        <div className={styles.reviewUser}>
          {avatarSrc && (
            <img src={buildImageUrl(avatarSrc, 40)} alt={userName} className={styles.avatar} />
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
              src={buildImageUrl(img, 100)}
              alt={`Review ${idx + 1}`}
              className={styles.reviewImage}
            />
          ))}
        </div>
      )}

      {review.video && (
        <video src={buildVideoUrl(review.video)} controls className={styles.reviewVideo} />
      )}

      {latestReply && (
        <div className={styles.storeReply}>
          <div className={styles.storeReplyHeader}>
            <span className={styles.storeReplyIcon}>TNQ</span>
            <div>
              <p className={styles.storeReplyTitle}>Phản hồi từ TNQ Fashion</p>
              <span className={styles.storeReplyMeta}>
                {latestReply.userName || latestReply.user?.fullName || 'TNQ Staff'} ·{' '}
                {formatReplyDate(latestReply.updatedAt || latestReply.createdAt)}
              </span>
            </div>
          </div>
          <p className={styles.storeReplyBody}>{latestReply.comment}</p>
        </div>
      )}
    </div>
  );
};

export default function ReviewSection({ productId }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedReviews, setExpandedReviews] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    if (!productId) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await reviewsApi.byProduct(productId, { page: 1, limit: 3 });
        if (!cancelled) {
          setReviews(data.reviews || []);
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
  }, [productId]);

  const toggleExpand = (reviewId) => {
    setExpandedReviews((prev) => ({
      ...prev,
      [reviewId]: !prev[reviewId],
    }));
  };

  if (loading) {
    return (
      <div className={styles.reviewSection}>
        <h3>Đánh giá sản phẩm</h3>
        <div style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>
          Đang tải đánh giá...
        </div>
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className={styles.reviewSection}>
        <h3>Đánh giá sản phẩm</h3>
        <div style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>
          Chưa có đánh giá nào cho sản phẩm này
        </div>
      </div>
    );
  }

  return (
    <div className={styles.reviewSection}>
      <div className={styles.reviewHeader}>
        <h3>Đánh giá sản phẩm ({reviews.length > 0 ? `${reviews.length}+` : '0'})</h3>
      </div>

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

      {reviews.length >= 3 && (
        <div className={styles.viewAllContainer}>
          <button
            onClick={() => navigate(`/products/${productId}/reviews`)}
            className={styles.viewAllBtn}
          >
            Xem tất cả đánh giá
          </button>
        </div>
      )}
    </div>
  );
}
