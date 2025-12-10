import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { reviewsApi } from '@/api/reviews-api';
import { useAuth } from '@/auth/AuthProvider';
import styles from './StaffReviewsPage.module.css';
import ConfirmModal from '@/components/ConfirmModal';

const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const buildImageUrl = (publicId, w = 120) => {
  if (!publicId) return '/no-image.png';
  if (/^https?:/i.test(publicId)) return publicId;
  const encoded = encodeURIComponent(publicId).replace(/%2F/g, '/');
  return `https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto,dpr_auto,w_${w}/${encoded}`;
};

const buildVideoUrl = (publicId) => {
  if (!publicId) return '';
  if (/^https?:/i.test(publicId)) return publicId;
  const encoded = encodeURIComponent(publicId).replace(/%2F/g, '/');
  return `https://res.cloudinary.com/${CLOUD}/video/upload/${encoded}`;
};

const formatDate = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('vi-VN', { hour12: false });
  } catch (err) {
    return value;
  }
};

const defaultStats = { total: 0, pending: 0, responded: 0 };

export default function StaffReviewsPage({ onStatsChange }) {
  const { user } = useAuth();

  const [tab, setTab] = useState('need_reply');
  const [ratings, setRatings] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [hasMedia, setHasMedia] = useState(false);
  const [query, setQuery] = useState('');
  const [productKeyword, setProductKeyword] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState(defaultStats);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [error, setError] = useState('');

  const [detailId, setDetailId] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [updateConfirm, setUpdateConfirm] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkNote, setBulkNote] = useState('');
  const [ackLoading, setAckLoading] = useState(false);

  const canUseBulkActions = tab === 'need_reply';

  const ratingsKey = useMemo(
    () =>
      ratings
        .slice()
        .sort((a, b) => a - b)
        .join(','),
    [ratings],
  );
  const canSelectRow = useCallback(
    (row) => canUseBulkActions && row?.status === 'pending' && (row?.rating || 0) >= 4,
    [canUseBulkActions],
  );
  const selectableIds = useMemo(
    () => rows.filter((row) => canSelectRow(row)).map((row) => row._id),
    [rows, canSelectRow],
  );
  const selectedCount = selectedIds.length;
  const hasSelection = selectedCount > 0;
  const allOnPageSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id));

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setError('');

    const params = {
      page,
      limit: pageSize,
      tab,
      dateRange,
    };

    if (ratings.length) params.ratings = ratings.join(',');
    if (tab === 'all' && statusFilter !== 'all') params.status = statusFilter;
    if (productKeyword) params.productKeyword = productKeyword;
    if (hasMedia) params.hasMedia = true;

    try {
      const data = await reviewsApi.staffList(params);
      setRows(data.items || []);
      setPagination(data.pagination || { total: 0, pages: 1 });

      const viewStats = data.stats || defaultStats;
      setStats(viewStats);

      if (onStatsChange) {
        try {
          const globalStats = await reviewsApi.staffStats();
          onStatsChange(globalStats || viewStats);
        } catch (statsErr) {
          console.warn('[StaffReviews] Không thể tải thống kê chung', statsErr);
          onStatsChange(viewStats);
        }
      }
    } catch (err) {
      const message = err?.response?.data?.message || 'Không tải được danh sách đánh giá';
      setRows([]);
      setStats(defaultStats);
      if (onStatsChange) onStatsChange(defaultStats);
      setPagination({ total: 0, pages: 1 });
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    pageSize,
    tab,
    ratingsKey,
    ratings,
    statusFilter,
    dateRange,
    productKeyword,
    hasMedia,
    onStatsChange,
  ]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  useEffect(() => {
    if (!canUseBulkActions) {
      setSelectedIds([]);
      setBulkNote('');
      return;
    }
    setSelectedIds((prev) => prev.filter((id) => selectableIds.includes(id)));
  }, [canUseBulkActions, selectableIds]);

  const resetPageAnd = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  const toggleRating = (value) => {
    setPage(1);
    setRatings((prev) =>
      prev.includes(value) ? prev.filter((star) => star !== value) : [...prev, value],
    );
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    setProductKeyword(query.trim());
    setPage(1);
  };

  const toggleSelect = (review) => {
    if (!review || !canSelectRow(review)) return;
    setSelectedIds((prev) =>
      prev.includes(review._id) ? prev.filter((id) => id !== review._id) : [...prev, review._id],
    );
  };

  const toggleSelectAll = () => {
    if (!canUseBulkActions || selectableIds.length === 0) return;
    setSelectedIds((prev) => {
      const everySelected = selectableIds.every((id) => prev.includes(id));
      if (everySelected) {
        return prev.filter((id) => !selectableIds.includes(id));
      }
      const merged = new Set([...prev, ...selectableIds]);
      return Array.from(merged);
    });
  };

  const clearSelection = () => {
    setSelectedIds([]);
    setBulkNote('');
  };

  const handleAcknowledgeSelected = async () => {
    if (!hasSelection) return;
    setAckLoading(true);
    try {
      const payload = { reviewIds: selectedIds };
      const trimmedNote = bulkNote.trim();
      if (trimmedNote) payload.note = trimmedNote;
      const result = await reviewsApi.acknowledgeMany(payload);
      const updatedCount = result?.modifiedCount ?? selectedIds.length;
      toast.success(`Đã đánh dấu ${updatedCount} đánh giá là đã xử lý`);
      clearSelection();
      await loadReviews();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Không thể cập nhật đánh giá');
    } finally {
      setAckLoading(false);
    }
  };

  const openDetail = async (reviewId) => {
    setDetailId(reviewId);
    setDetail(null);
    setReplyDraft('');
    setDetailLoading(true);
    try {
      const data = await reviewsApi.staffDetail(reviewId);
      setDetail(data);
      const latestReply = data?.replies?.[data.replies.length - 1];
      setReplyDraft(latestReply?.comment || '');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Không tải được đánh giá');
      setDetailId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailId(null);
    setDetail(null);
    setReplyDraft('');
    setDetailLoading(false);
    setSendingReply(false);
    setDeleteConfirm(false);
    setUpdateConfirm(false);
  };

  const latestReply = detail?.replies?.[detail.replies.length - 1];
  const canEditReply = useMemo(() => {
    if (!latestReply) return true;
    if (user?.role === 'admin') return true;
    return latestReply?.user?._id === user?._id;
  }, [latestReply, user]);

  const refreshAfterMutation = async () => {
    try {
      const [, freshDetail] = await Promise.all([
        loadReviews(),
        detailId ? reviewsApi.staffDetail(detailId) : Promise.resolve(null),
      ]);
      if (freshDetail) {
        setDetail(freshDetail);
        const newest = freshDetail.replies?.[freshDetail.replies.length - 1];
        setReplyDraft(newest?.comment || '');
      }
    } catch (err) {
      console.warn('[StaffReviews] Refresh failed', err);
    }
  };

  const handleReplySubmit = async () => {
    if (!detail) return;
    const trimmed = replyDraft.trim();
    if (!trimmed) {
      toast.error('Vui lòng nhập nội dung phản hồi');
      return;
    }
    setSendingReply(true);
    setUpdateConfirm(false);
    try {
      if (latestReply) {
        await reviewsApi.updateReply(detail._id, latestReply._id, { comment: trimmed });
        toast.success('Đã cập nhật phản hồi');
      } else {
        await reviewsApi.reply(detail._id, { comment: trimmed });
        toast.success('Đã gửi phản hồi tới khách hàng');
      }
      await refreshAfterMutation();
      closeDetail();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Không thể lưu phản hồi.');
    } finally {
      setSendingReply(false);
    }
  };

  const handleDeleteReply = async () => {
    if (!detail || !latestReply) return;
    setSendingReply(true);
    try {
      await reviewsApi.deleteReply(detail._id, latestReply._id);
      toast.success('Đã xóa phản hồi');
      await refreshAfterMutation();
      closeDetail();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Không thể xóa phản hồi');
    } finally {
      setSendingReply(false);
      setDeleteConfirm(false);
    }
  };

  const handlePrimaryActionClick = () => {
    if (sendingReply) return;
    if (latestReply) {
      if (!canEditReply) return;
      setUpdateConfirm(true);
      return;
    }
    handleReplySubmit();
  };

  const totalPages = Math.max(1, pagination.pages || Math.ceil((pagination.total || 0) / pageSize));

  return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <div>
          <p className={styles.kicker}>Staff panel · Chăm sóc khách</p>
          <h2 className={styles.title}>Đánh giá khách hàng</h2>
        </div>
        <button className={styles.refreshBtn} onClick={loadReviews} disabled={loading}>
          {loading ? 'Đang tải...' : 'Tải lại'}
        </button>
      </div>

      <div className={styles.tabBar}>
        {[
          { key: 'need_reply', label: 'Chưa phản hồi', count: stats.pending },
          { key: 'all', label: 'Tất cả đánh giá', count: stats.total },
          { key: 'responded', label: 'Đã phản hồi', count: stats.responded },
        ].map((tabItem) => (
          <button
            key={tabItem.key}
            className={`${styles.tabBtn} ${tab === tabItem.key ? styles.tabBtnActive : ''}`}
            onClick={() => {
              setPage(1);
              setTab(tabItem.key);
            }}
          >
            <span>{tabItem.label}</span>
            <span className={styles.tabCount}>{tabItem.count}</span>
          </button>
        ))}
      </div>

      <div className={styles.filterCard}>
        <div className={styles.chipGroup}>
          <p className={styles.filterLabel}>Số sao</p>
          <div className={styles.chipList}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className={`${styles.chip} ${ratings.includes(star) ? styles.chipActive : ''}`}
                onClick={() => toggleRating(star)}
              >
                {star} ★
              </button>
            ))}
          </div>
        </div>

        <div className={styles.filterRow}>
          {tab === 'all' && (
            <label>
              Trạng thái
              <select
                value={statusFilter}
                onChange={(e) => resetPageAnd(setStatusFilter)(e.target.value)}
              >
                <option value="all">Tất cả</option>
                <option value="pending">Chưa phản hồi</option>
                <option value="responded">Đã phản hồi</option>
              </select>
            </label>
          )}
          <label>
            Thời gian
            <select value={dateRange} onChange={(e) => resetPageAnd(setDateRange)(e.target.value)}>
              <option value="7d">7 ngày gần đây</option>
              <option value="30d">30 ngày</option>
              <option value="90d">90 ngày</option>
              <option value="all">Tất cả</option>
            </select>
          </label>

          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={hasMedia}
              onChange={(e) => {
                setHasMedia(e.target.checked);
                setPage(1);
              }}
            />
            Chỉ có ảnh/video
          </label>
        </div>

        <form className={styles.searchRow} onSubmit={handleSearchSubmit}>
          <input
            type="text"
            placeholder="Tìm theo sản phẩm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit">Lọc</button>
        </form>
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableHead}>
          <span>Tổng {pagination.total || 0} đánh giá</span>
          {error && <span className={styles.errorText}>{error}</span>}
        </div>

        {canUseBulkActions && (
          <p className={styles.bulkHelper}>
            Chọn các đánh giá 4-5★ chưa phản hồi để đánh dấu là đã xử lý mà không cần gửi phản hồi.
          </p>
        )}

        {canUseBulkActions && hasSelection && (
          <div className={styles.bulkBar}>
            <p className={styles.bulkCount}>Đã chọn {selectedCount} đánh giá</p>
            <input
              type="text"
              className={styles.bulkNoteInput}
              placeholder="Ghi chú nội bộ (tùy chọn)"
              value={bulkNote}
              onChange={(e) => setBulkNote(e.target.value)}
            />
            <div className={styles.bulkActions}>
              <button
                type="button"
                className={styles.bulkPrimaryBtn}
                onClick={handleAcknowledgeSelected}
                disabled={ackLoading}
              >
                {ackLoading ? 'Đang cập nhật...' : 'Đánh dấu đã xử lý'}
              </button>
              <button type="button" className={styles.bulkSecondaryBtn} onClick={clearSelection}>
                Bỏ chọn
              </button>
            </div>
          </div>
        )}

        <div className={styles.tableWrap}>
          <div className={styles.tableGrid}>
            <div className={`${styles.row} ${styles.headerRow}`}>
              <div className={styles.selectCell}>
                {canUseBulkActions && selectableIds.length > 0 && (
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleSelectAll}
                    aria-label="Chọn tất cả trong trang"
                  />
                )}
              </div>
              <div>Sản phẩm</div>
              <div>Khách hàng</div>
              <div>Đánh giá</div>
              <div>Nội dung</div>
              <div>Có media</div>
              <div>Ngày tạo</div>
              <div>Trạng thái</div>
              <div>Hành động</div>
            </div>
            {loading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <div key={idx} className={`${styles.row} ${styles.skeletonRow}`}>
                  {Array.from({ length: 9 }).map((__, cellIdx) => (
                    <div key={cellIdx} />
                  ))}
                </div>
              ))
            ) : rows.length === 0 ? (
              <div className={styles.emptyState}>Không có đánh giá nào phù hợp bộ lọc.</div>
            ) : (
              rows.map((review) => (
                <div key={review._id} className={styles.row}>
                  <div className={styles.selectCell}>
                    {canUseBulkActions && (
                      <input
                        type="checkbox"
                        disabled={!canSelectRow(review)}
                        checked={selectedIds.includes(review._id)}
                        onChange={() => toggleSelect(review)}
                        aria-label="Chọn đánh giá"
                      />
                    )}
                  </div>
                  <div>
                    <div className={styles.productCell}>
                      <img
                        src={buildImageUrl(review.product?.thumbnail, 58)}
                        alt={review.product?.name}
                      />
                      <div>
                        <p className={styles.productName}>{review.product?.name || '—'}</p>
                        {review.variantLabel && (
                          <p className={styles.variantText}>{review.variantLabel}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className={styles.customerName}>{review.customerName}</p>
                  </div>
                  <div>
                    <div className={styles.stars}>{'★'.repeat(review.rating || 0)}</div>
                  </div>
                  <div>
                    <p className={styles.comment} title={review.comment}>
                      {review.comment || '—'}
                    </p>
                  </div>
                  <div>
                    {review.hasMedia ? <span className={styles.mediaTag}>Có</span> : 'Không'}
                  </div>
                  <div>{formatDate(review.createdAt)}</div>
                  <div>
                    <span
                      className={`${styles.statusBadge} ${
                        review.status === 'responded' ? styles.statusResolved : styles.statusPending
                      }`}
                    >
                      {review.status === 'responded' ? 'Đã phản hồi' : 'Chưa phản hồi'}
                    </span>
                  </div>
                  <div>
                    <button
                      type="button"
                      className={styles.linkBtn}
                      onClick={() => openDetail(review._id)}
                    >
                      Xem / Trả lời
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={styles.pagination}>
          <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            ← Trước
          </button>
          <span>
            Trang {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Tiếp →
          </button>
        </div>
      </div>

      {detailId && (
        <div className={styles.drawerOverlay}>
          <div className={styles.drawerScrim} onClick={closeDetail} />
          <div className={styles.drawer}>
            <div className={styles.drawerHead}>
              <div>
                <p className={styles.drawerKicker}>Đánh giá #{detail?._id?.slice(-5)}</p>
                <h3>Xem & phản hồi</h3>
              </div>
              <button className={styles.closeBtn} onClick={closeDetail}>
                ✕
              </button>
            </div>

            {detailLoading ? (
              <div className={styles.detailLoading}>Đang tải chi tiết...</div>
            ) : detail ? (
              <div className={styles.drawerBody}>
                <section className={styles.section}>
                  <div className={styles.sectionHead}>
                    <h4>Sản phẩm</h4>
                  </div>
                  <div className={styles.productDetail}>
                    <img
                      src={buildImageUrl(detail.product?.thumbnail, 72)}
                      alt={detail.product?.name}
                    />
                    <div>
                      <p className={styles.productName}>{detail.product?.name || '—'}</p>
                      {detail.variantLabel && (
                        <p className={styles.variantText}>Phân loại: {detail.variantLabel}</p>
                      )}
                    </div>
                  </div>
                </section>

                <section className={styles.section}>
                  <h4>Thông tin đánh giá</h4>
                  <div className={styles.reviewMeta}>
                    <div>
                      <span className={styles.metaLabel}>Khách hàng</span>
                      <p>{detail.customerName}</p>
                    </div>
                    <div>
                      <span className={styles.metaLabel}>Số sao</span>
                      <p>{'★'.repeat(detail.rating || 0)}</p>
                    </div>
                    <div>
                      <span className={styles.metaLabel}>Ngày tạo</span>
                      <p>{formatDate(detail.createdAt)}</p>
                    </div>
                  </div>
                  {detail.comment && <p className={styles.detailComment}>{detail.comment}</p>}
                  {(detail.images || []).length > 0 && (
                    <div className={styles.mediaGrid}>
                      {detail.images.map((img) => (
                        <img key={img} src={buildImageUrl(img, 140)} alt="review" />
                      ))}
                    </div>
                  )}
                  {detail.video && (
                    <video
                      src={buildVideoUrl(detail.video)}
                      controls
                      className={styles.detailVideo}
                    />
                  )}
                </section>

                <section className={styles.section}>
                  <div className={styles.sectionHead}>
                    <h4>Phản hồi của cửa hàng</h4>
                  </div>
                  {latestReply ? (
                    <div className={styles.replyBubble}>
                      <div className={styles.replyMeta}>
                        <p>{latestReply.user?.fullName || 'TNQ Fashion'}</p>
                        <span>{formatDate(latestReply.createdAt)}</span>
                      </div>
                      <p>{latestReply.comment}</p>
                      <div className={styles.replyActions}>
                        <button
                          type="button"
                          className={styles.linkBtn}
                          disabled={!canEditReply || sendingReply}
                          onClick={() => setReplyDraft(latestReply.comment || '')}
                        >
                          Chỉnh sửa
                        </button>
                        <button
                          type="button"
                          className={styles.linkBtnDanger}
                          disabled={!canEditReply || sendingReply}
                          onClick={() => setDeleteConfirm(true)}
                        >
                          Xóa phản hồi
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className={styles.emptyReplyHint}>Chưa có phản hồi nào cho đánh giá này.</p>
                  )}

                  <textarea
                    value={replyDraft}
                    onChange={(e) => setReplyDraft(e.target.value)}
                    placeholder="Nhập nội dung phản hồi..."
                    rows={5}
                  />
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={notifyCustomer}
                      onChange={(e) => setNotifyCustomer(e.target.checked)}
                    />
                    Gửi thông báo cho khách hàng (sắp ra mắt)
                  </label>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={handlePrimaryActionClick}
                    disabled={sendingReply || (!canEditReply && latestReply)}
                  >
                    {sendingReply
                      ? 'Đang gửi...'
                      : latestReply
                      ? 'Cập nhật phản hồi'
                      : 'Gửi phản hồi'}
                  </button>
                </section>
              </div>
            ) : (
              <div className={styles.detailLoading}>Không tìm thấy đánh giá.</div>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        open={updateConfirm}
        title="Cập nhật phản hồi"
        message="Bạn có chắc muốn cập nhật phản hồi này?"
        confirmText="Cập nhật"
        cancelText="Hủy"
        onCancel={() => setUpdateConfirm(false)}
        onConfirm={handleReplySubmit}
        disabled={sendingReply}
      />

      <ConfirmModal
        open={deleteConfirm}
        title="Xóa phản hồi"
        message="Xóa phản hồi này? Khách hàng sẽ không còn thấy nội dung này nữa."
        confirmText="Xóa"
        cancelText="Hủy"
        destructive
        onCancel={() => setDeleteConfirm(false)}
        onConfirm={handleDeleteReply}
        disabled={sendingReply}
      />
    </div>
  );
}
