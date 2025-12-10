import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ordersApi from '@/api/orders-api';
import { reviewsApi } from '@/api/reviews-api';
import { mediaApi } from '@/api/media-api';
import styles from './OrderDetail.module.css';

const REVIEW_NOTICE_SEEN_KEY = 'tnq_review_notice_seen_at';
const REVIEW_NOTICE_DATA_KEY = 'tnq_review_notice_data';
const REVIEW_FOCUS_PRODUCT_KEY = 'tnq_review_focus_product';
const REVIEW_NOTICE_STORAGE_KEY = 'tnq_review_notice_state';

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

const formatDateTime = (value) => {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('vi-VN', { hour12: false });
  } catch (err) {
    return String(value);
  }
};

const normalizeId = (value, fallback = '') => {
  if (!value) return fallback;
  if (typeof value === 'object') {
    if (value._id) return String(value._id);
    if (value.id) return String(value.id);
  }
  return String(value);
};

const toTimestamp = (value) => {
  if (!value) return 0;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : 0;
};

export default function ReviewOrder() {
  const { id } = useParams();
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const buildImageUrl = useCloudImage();
  const [readOnly, setReadOnly] = useState(false);

  // Per-product reviews: [{ productId, rating, comment, variantSku, images: [], video: '', uploading: false, uploadProgress: 0 }]
  const [productReviews, setProductReviews] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [highlightedProduct, setHighlightedProduct] = useState('');
  const productRefs = useRef({});
  const highlightTimer = useRef(null);
  const pendingFocusRef = useRef('');
  const orderItems = useMemo(() => (Array.isArray(order?.items) ? order.items : []), [order]);
  const [lastSeenReplyAt, setLastSeenReplyAt] = useState(() => {
    if (typeof window === 'undefined') return 0;
    try {
      const raw = Number(window.localStorage?.getItem(REVIEW_NOTICE_SEEN_KEY) || 0);
      return Number.isFinite(raw) ? raw : 0;
    } catch (err) {
      return 0;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = Number(window.localStorage?.getItem(REVIEW_NOTICE_SEEN_KEY) || 0);
      if (Number.isFinite(raw)) setLastSeenReplyAt(raw);
    } catch (err) {}
  }, []);

  useEffect(() => {
    return () => {
      if (highlightTimer.current) {
        clearTimeout(highlightTimer.current);
      }
    };
  }, []);

  const notifications = useMemo(() => {
    const list = [];
    productReviews.forEach((pr, idx) => {
      const replies = Array.isArray(pr.replies) ? pr.replies : [];
      if (!replies.length) return;
      const item = orderItems[idx] || {};
      const productKey = pr.productId || normalizeId(item.productId, String(idx));
      const productName = item.nameSnapshot || item.name || 'Sản phẩm';
      const variantSku = item.variantSku || pr.variantSku || '';
      replies.forEach((reply) => {
        list.push({
          id: `${productKey}-${reply._id}`,
          productKey,
          productName,
          variantSku,
          reply,
        });
      });
    });
    return list.sort((a, b) => {
      const aTime = new Date(a.reply?.createdAt || 0).getTime();
      const bTime = new Date(b.reply?.createdAt || 0).getTime();
      return bTime - aTime;
    });
  }, [productReviews, orderItems]);

  const latestReplyAt = useMemo(() => {
    if (!notifications.length) return 0;
    return notifications.reduce((max, n) => {
      const ts = toTimestamp(n.reply?.createdAt);
      return ts > max ? ts : max;
    }, 0);
  }, [notifications]);

  const unreadNotifications = useMemo(() => {
    if (!notifications.length) return [];
    return notifications.filter((n) => toTimestamp(n.reply?.createdAt) > lastSeenReplyAt);
  }, [notifications, lastSeenReplyAt]);

  const unreadCount = unreadNotifications.length;
  const hasUnreadNotifications = unreadCount > 0;
  const totalNotifications = notifications.length;
  const hasNotifications = totalNotifications > 0;

  const persistLastSeen = useCallback(
    (value) => {
      if (!value) return;
      setLastSeenReplyAt(value);
      if (typeof window !== 'undefined') {
        try {
          window.localStorage?.setItem(REVIEW_NOTICE_SEEN_KEY, String(value));
        } catch (err) {}
      }
    },
    [setLastSeenReplyAt],
  );

  useEffect(() => {
    if (!hasNotifications) {
      setNotifOpen(false);
    }
  }, [hasNotifications]);

  useEffect(() => {
    if (!notifOpen) return;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setNotifOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [notifOpen]);

  useEffect(() => {
    if (!notifOpen) return;
    if (!hasNotifications || !latestReplyAt) return;
    persistLastSeen(latestReplyAt);
  }, [notifOpen, hasNotifications, latestReplyAt, persistLastSeen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage?.getItem(REVIEW_FOCUS_PRODUCT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.productKey) pendingFocusRef.current = parsed.productKey;
      }
      window.localStorage?.removeItem(REVIEW_FOCUS_PRODUCT_KEY);
    } catch (err) {}
  }, []);

  useEffect(() => {
    if (!pendingFocusRef.current) return undefined;
    const key = pendingFocusRef.current;
    const tryFocus = () => {
      const node = productRefs.current[key];
      if (!node) return false;
      focusReview(key);
      pendingFocusRef.current = '';
      return true;
    };
    if (tryFocus()) return undefined;
    const timer = setTimeout(() => {
      if (pendingFocusRef.current) tryFocus();
    }, 120);
    return () => clearTimeout(timer);
  }, [productReviews]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const detail = {
      count: readOnly && hasUnreadNotifications ? unreadCount : 0,
      available: Boolean(readOnly && hasUnreadNotifications),
    };
    const orderId = order?._id || order?.id || id;
    const orderCode = order?.code || '';
    const notificationData =
      readOnly && notifications.length
        ? {
            notifications: notifications.map((n) => ({
              id: n.id,
              productKey: n.productKey,
              productName: n.productName,
              variantSku: n.variantSku,
              reply: n.reply,
              orderId,
              orderCode,
            })),
            latestReplyAt,
            total: notifications.length,
            orderId,
            orderCode,
          }
        : null;
    if (notificationData) detail.data = notificationData;
    window.__tnqReviewNotifications = detail;
    if (notificationData) {
      window.__tnqReviewNotificationData = notificationData;
    } else {
      delete window.__tnqReviewNotificationData;
    }
    try {
      window.localStorage?.setItem(REVIEW_NOTICE_STORAGE_KEY, JSON.stringify(detail));
      if (notificationData) {
        window.localStorage?.setItem(REVIEW_NOTICE_DATA_KEY, JSON.stringify(notificationData));
      } else {
        window.localStorage?.removeItem(REVIEW_NOTICE_DATA_KEY);
      }
    } catch (err) {}
    window.dispatchEvent(new CustomEvent('tnq-review-notifications', { detail }));
  }, [hasUnreadNotifications, unreadCount, readOnly, notifications, order, latestReplyAt, id]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleOpen = () => {
      if (readOnly && hasNotifications) {
        setNotifOpen(true);
      }
    };
    window.addEventListener('tnq-open-review-notifications', handleOpen);
    return () => window.removeEventListener('tnq-open-review-notifications', handleOpen);
  }, [readOnly, hasNotifications]);

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

        // Initialize productReviews from order items
        const items = o.items || [];
        const initReviews = items.map((item, index) => ({
          productId: normalizeId(item.productId, String(index)),
          rating: 0,
          comment: '',
          variantSku: item.variantSku || '',
          images: [],
          video: '',
          uploading: false,
          replies: [],
        }));
        setProductReviews(initReviews);
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

  // Detect if already reviewed, and preload reviews
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await reviewsApi.mine();
        console.log('[ReviewOrder] API response:', res);
        const list = Array.isArray(res?.reviews) ? res.reviews : res || [];
        console.log('[ReviewOrder] Reviews list:', list);
        // Handle orderId as either string or object { _id: ... }
        const orderReviews = list.filter((rv) => {
          const oid = typeof rv.orderId === 'object' ? rv.orderId?._id : rv.orderId;
          return String(oid) === String(id);
        });
        console.log('[ReviewOrder] Filtered for order', id, ':', orderReviews);

        if (orderReviews.length > 0 && !cancelled) {
          setReadOnly(true);
          // Don't show error, just message that they're viewing existing review
          setErr('');

          // Update productReviews with existing data
          setProductReviews((prev) =>
            prev.map((pr) => {
              const existing = orderReviews.find((r) => {
                const pid = typeof r.productId === 'object' ? r.productId?._id : r.productId;
                return String(pid) === String(pr.productId);
              });
              if (existing) {
                console.log(
                  '[ReviewOrder] Found existing review for product',
                  pr.productId,
                  ':',
                  existing,
                );
                return {
                  ...pr,
                  rating: existing.rating || 0,
                  comment: existing.comment || '',
                  images: existing.images || [],
                  video: existing.video || '',
                  replies: existing.replies || [],
                };
              }
              return pr;
            }),
          );
        }
      } catch (e) {
        console.error('[ReviewOrder] Error loading reviews:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const updateProductReview = (index, field, value) => {
    setProductReviews((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const uploadWithProgress = (file, index, onProgress) => {
    return new Promise((resolve, reject) => {
      const API_BASE = import.meta.env.VITE_API_URL || '';
      const fd = new FormData();
      fd.append('file', file);

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result = JSON.parse(xhr.responseText);
            resolve(result);
          } catch (e) {
            reject(new Error('Invalid response'));
          }
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Network error'));
      });

      xhr.open('POST', `${API_BASE}/api/media/upload`);
      xhr.withCredentials = true;
      xhr.send(fd);
    });
  };

  const handleImageUpload = async (index, file) => {
    const pr = productReviews[index];
    if (pr.images.length >= 3) {
      alert('Tối đa 3 ảnh cho mỗi sản phẩm');
      return;
    }

    updateProductReview(index, 'uploading', true);
    updateProductReview(index, 'uploadProgress', 0);

    try {
      const result = await uploadWithProgress(file, index, (percent) => {
        updateProductReview(index, 'uploadProgress', percent);
      });
      updateProductReview(index, 'images', [...pr.images, result.publicId]);
    } catch (e) {
      alert('Lỗi tải ảnh: ' + (e.message || 'Unknown'));
    } finally {
      updateProductReview(index, 'uploading', false);
      updateProductReview(index, 'uploadProgress', 0);
    }
  };

  const handleVideoUpload = async (index, file) => {
    // Validate video duration (max 60s) - basic file size check
    if (file.size > 50 * 1024 * 1024) {
      // 50MB limit
      alert('Video quá lớn. Vui lòng chọn video dưới 50MB (khoảng 60 giây)');
      return;
    }

    updateProductReview(index, 'uploading', true);
    updateProductReview(index, 'uploadProgress', 0);

    try {
      const result = await uploadWithProgress(file, index, (percent) => {
        updateProductReview(index, 'uploadProgress', percent);
      });
      updateProductReview(index, 'video', result.publicId);
    } catch (e) {
      alert('Lỗi tải video: ' + (e.message || 'Unknown'));
    } finally {
      updateProductReview(index, 'uploading', false);
      updateProductReview(index, 'uploadProgress', 0);
    }
  };

  const removeImage = (index, imgIndex) => {
    const pr = productReviews[index];
    const newImages = pr.images.filter((_, i) => i !== imgIndex);
    updateProductReview(index, 'images', newImages);
  };

  const removeVideo = (index) => {
    updateProductReview(index, 'video', '');
  };

  const focusReview = (productKey) => {
    if (!productKey) return;
    const node = productRefs.current[productKey];
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setNotifOpen(false);
    setHighlightedProduct(productKey);
    if (highlightTimer.current) {
      clearTimeout(highlightTimer.current);
    }
    highlightTimer.current = setTimeout(() => {
      setHighlightedProduct('');
    }, 2800);
  };

  const handleNotificationClick = (notification) => {
    if (!notification) return;
    focusReview(notification.productKey);
  };

  const submit = async () => {
    // Validate at least one product has rating
    const hasRating = productReviews.some((pr) => pr.rating > 0);
    if (!hasRating) {
      alert('Vui lòng đánh giá ít nhất một sản phẩm');
      return;
    }

    // Filter only products with rating
    const reviewsToSubmit = productReviews
      .filter((pr) => pr.rating > 0)
      .map((pr) => ({
        productId: pr.productId,
        rating: pr.rating,
        comment: pr.comment,
        variantSku: pr.variantSku,
        images: pr.images,
        video: pr.video,
      }));

    setSubmitting(true);
    try {
      await reviewsApi.create({ orderId: id, reviews: reviewsToSubmit });
      nav(`/orders/${id}`);
    } catch (e) {
      // Errors are toasted by interceptor
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className={styles.wrap}>Đang tải…</div>;
  if (!order) return <div className={styles.wrap}>Không tìm thấy đơn hàng.</div>;

  const items = orderItems;

  return (
    <div className={styles.wrap}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <button className={styles.back} onClick={() => nav(-1)} aria-label="Quay lại trang trước">
            <span className={styles.backIcon}>←</span>
          </button>
          <div className={styles.headerTitles}>
            <h2>{readOnly ? 'Xem đánh giá' : 'Đánh giá đơn hàng'}</h2>
            <div className={styles.subLine}>Mã đơn: {order.code || order._id}</div>
          </div>
        </div>

        {readOnly && (
          <div
            className={styles.infoBanner}
            style={{ background: '#dbeafe', borderColor: '#93c5fd', color: '#1e40af' }}
          >
            Bạn đã đánh giá đơn hàng này. Đang xem lại đánh giá của bạn.
          </div>
        )}

        {err && (
          <div
            className={styles.infoBanner}
            style={{ background: '#fff1f2', borderColor: '#fecdd3', color: '#9f1239' }}
          >
            {err}
          </div>
        )}

        {items.map((item, idx) => {
          const pr = productReviews[idx] || {};
          const productKey = pr.productId || normalizeId(item.productId, String(idx));
          const replies = Array.isArray(pr.replies) ? pr.replies : [];
          return (
            <section
              key={productKey || idx}
              ref={(node) => {
                if (!productKey) return;
                if (node) {
                  productRefs.current[productKey] = node;
                } else {
                  delete productRefs.current[productKey];
                }
              }}
              className={`${styles.card} ${
                highlightedProduct === productKey ? styles.cardHighlight : ''
              }`}
              style={{ marginBottom: 16 }}
            >
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
                <img
                  src={buildImageUrl(item.imageSnapshot, 80)}
                  alt={item.nameSnapshot}
                  style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8 }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>{item.nameSnapshot}</div>
                  {item.variantSku && (
                    <div style={{ fontSize: 13, opacity: 0.7 }}>Phân loại: {item.variantSku}</div>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'grid', gap: 6 }}>
                  <label style={{ fontWeight: 500 }}>Đánh giá chất lượng</label>
                  <Stars
                    value={pr.rating || 0}
                    onChange={(val) => updateProductReview(idx, 'rating', val)}
                    readOnly={readOnly}
                  />
                </div>

                <div style={{ display: 'grid', gap: 6 }}>
                  <label style={{ fontWeight: 500 }}>Nhận xét (không bắt buộc)</label>
                  <textarea
                    value={pr.comment || ''}
                    onChange={(e) => updateProductReview(idx, 'comment', e.target.value)}
                    placeholder="Chia sẻ cảm nhận về sản phẩm này..."
                    style={{
                      minHeight: 80,
                      padding: 10,
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      fontSize: 14,
                    }}
                    disabled={readOnly}
                  />
                </div>

                {!readOnly && (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <label style={{ fontWeight: 500 }}>Hình ảnh (tối đa 3 ảnh)</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {(pr.images || []).map((img, imgIdx) => (
                        <div
                          key={imgIdx}
                          style={{
                            position: 'relative',
                            width: 80,
                            height: 80,
                            borderRadius: 8,
                            overflow: 'hidden',
                          }}
                        >
                          <img
                            src={buildImageUrl(img, 80)}
                            alt={`Review ${imgIdx + 1}`}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          <button
                            onClick={() => removeImage(idx, imgIdx)}
                            style={{
                              position: 'absolute',
                              top: 4,
                              right: 4,
                              background: 'rgba(0,0,0,0.6)',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '50%',
                              width: 20,
                              height: 20,
                              cursor: 'pointer',
                              fontSize: 12,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {(pr.images || []).length < 3 && (
                        <label
                          style={{
                            width: 80,
                            height: 80,
                            border: '2px dashed #d1d5db',
                            borderRadius: 8,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: 24,
                            color: '#9ca3af',
                          }}
                        >
                          +
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleImageUpload(idx, file);
                              e.target.value = '';
                            }}
                            disabled={pr.uploading}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                )}

                {readOnly && (pr.images || []).length > 0 && (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <label style={{ fontWeight: 500 }}>Hình ảnh</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {pr.images.map((img, imgIdx) => (
                        <img
                          key={imgIdx}
                          src={buildImageUrl(img, 80)}
                          alt={`Review ${imgIdx + 1}`}
                          style={{
                            width: 80,
                            height: 80,
                            objectFit: 'cover',
                            borderRadius: 8,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {!readOnly && (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <label style={{ fontWeight: 500 }}>Video (tối đa 60 giây)</label>
                    {pr.video ? (
                      <div style={{ position: 'relative', maxWidth: 240 }}>
                        <video
                          src={`https://res.cloudinary.com/${
                            import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
                          }/video/upload/${pr.video}`}
                          controls
                          style={{ width: '100%', borderRadius: 8 }}
                        />
                        <button
                          onClick={() => removeVideo(idx)}
                          style={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            background: 'rgba(0,0,0,0.6)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '50%',
                            width: 24,
                            height: 24,
                            cursor: 'pointer',
                            fontSize: 16,
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <label
                        style={{
                          padding: '12px 16px',
                          border: '2px dashed #d1d5db',
                          borderRadius: 8,
                          cursor: 'pointer',
                          textAlign: 'center',
                          fontSize: 14,
                          color: '#6b7280',
                        }}
                      >
                        📹 Chọn video
                        <input
                          type="file"
                          accept="video/*"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleVideoUpload(idx, file);
                            e.target.value = '';
                          }}
                          disabled={pr.uploading}
                        />
                      </label>
                    )}
                  </div>
                )}

                {readOnly && pr.video && (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <label style={{ fontWeight: 500 }}>Video</label>
                    <video
                      src={`https://res.cloudinary.com/${
                        import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
                      }/video/upload/${pr.video}`}
                      controls
                      style={{ maxWidth: 240, borderRadius: 8 }}
                    />
                  </div>
                )}

                {pr.uploading && (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ fontSize: 14, color: '#6b7280' }}>
                      Đang tải lên... {pr.uploadProgress || 0}%
                    </div>
                    <div
                      style={{
                        width: '100%',
                        height: 6,
                        background: '#e5e7eb',
                        borderRadius: 3,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${pr.uploadProgress || 0}%`,
                          height: '100%',
                          background: '#2563eb',
                          transition: 'width 0.3s',
                        }}
                      />
                    </div>
                  </div>
                )}

                {replies.length > 0 && (
                  <div className={styles.replyBox}>
                    <p className={styles.replyHeading}>Phản hồi từ cửa hàng</p>
                    {replies.map((reply) => (
                      <div key={reply._id || reply.createdAt} className={styles.replyBubble}>
                        <div className={styles.replyMeta}>
                          <strong>{reply.staffName || 'TNQ Fashion'}</strong>
                          <span>{formatDateTime(reply.createdAt) || 'Vừa xong'}</span>
                        </div>
                        <p style={{ margin: 0 }}>{reply.comment}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          );
        })}

        {!readOnly && (
          <div className={styles.bottomActions}>
            <button
              className={`btn ${styles.btnPrimary}`}
              onClick={submit}
              disabled={submitting || !!err || productReviews.some((pr) => pr.uploading)}
            >
              {submitting ? 'Đang gửi…' : 'Gửi đánh giá'}
            </button>
          </div>
        )}
      </div>
      {notifOpen && hasNotifications && readOnly && (
        <div
          className={styles.noticeOverlay}
          aria-modal="true"
          role="dialog"
          onClick={() => setNotifOpen(false)}
        >
          <div className={styles.noticeModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.noticeHead}>
              <div>
                <p className={styles.noticeTitle}>Phản hồi từ TNQ Fashion</p>
                <span className={styles.noticeSubtitle}>
                  {totalNotifications === 1
                    ? '1 phản hồi mới'
                    : `${totalNotifications} phản hồi từ cửa hàng`}
                </span>
              </div>
              <button
                type="button"
                className={styles.noticeClose}
                onClick={() => setNotifOpen(false)}
                aria-label="Đóng thông báo"
              >
                ✕
              </button>
            </div>
            <div className={styles.noticeList}>
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  className={styles.noticeItem}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className={styles.noticeMeta}>
                    <p>{notification.productName}</p>
                    {notification.variantSku && <span>{notification.variantSku}</span>}
                  </div>
                  <p className={styles.noticePreview}>{notification.reply.comment}</p>
                  <span className={styles.noticeTime}>
                    {formatDateTime(notification.reply.createdAt) || 'Vừa xong'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
