import * as reviewService from '../services/review.service.js';

const parseRatingsFilter = (value) => {
  if (!value && value !== 0) return [];
  const raw = Array.isArray(value) ? value : String(value).split(',');
  const parsed = raw
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item >= 1 && item <= 5);
  return Array.from(new Set(parsed));
};

const parseBooleanQuery = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes'].includes(normalized)) return true;
    if (['false', '0', 'no'].includes(normalized)) return false;
  }
  return undefined;
};

const normalizeTab = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (['all', 'responded', 'need_reply'].includes(normalized)) return normalized;
  return 'need_reply';
};

const normalizeStatusFilter = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (['pending', 'responded'].includes(normalized)) return normalized;
  return undefined;
};

export const postCreateReview = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { orderId, reviews } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: 'orderId là bắt buộc' });
    }
    if (!Array.isArray(reviews) || reviews.length === 0) {
      return res.status(400).json({ message: 'Phải gửi ít nhất một đánh giá sản phẩm' });
    }

    const createdReviews = await reviewService.createReview({ userId, orderId, reviews });
    return res.status(201).json({
      message: `Đã tạo ${createdReviews.length} đánh giá cho ${createdReviews.length} sản phẩm`,
      reviews: createdReviews,
    });
  } catch (error) {
    console.error('Create review error:', error);
    const mapStatus = (err) => {
      if (!err) return 500;
      // If service intentionally sets numeric HTTP status (e.g., 400, 403, 409)
      if (Number.isInteger(err.code) && err.code >= 100 && err.code < 1000) return err.code;
      // Mongo duplicate key
      if (err.code === 11000) return 409;
      // Mongoose validation
      if (err.name === 'ValidationError') return 400;
      return 500;
    };
    const statusCode = mapStatus(error);
    const message = error?.message || 'Lỗi khi tạo đánh giá';
    return res.status(statusCode).json({ message });
  }
};

export const getReviewsByProduct = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const data = await reviewService.listReviewsByProduct(productId, { page, limit });
    return res.json(data);
  } catch (error) {
    console.error('List reviews error:', error);
    const mapStatus = (err) => {
      if (!err) return 500;
      if (Number.isInteger(err.code) && err.code >= 100 && err.code < 1000) return err.code;
      if (err.code === 11000) return 409;
      if (err.name === 'ValidationError') return 400;
      return 500;
    };
    const statusCode = mapStatus(error);
    const message = error?.message || 'Lỗi khi lấy danh sách đánh giá';
    return res.status(statusCode).json({ message });
  }
};

export const getMyReviews = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const reviews = await reviewService.listUserReviews(userId);
    return res.json({ reviews });
  } catch (error) {
    console.error('Get my reviews error:', error);
    const mapStatus = (err) => {
      if (!err) return 500;
      if (Number.isInteger(err.code) && err.code >= 100 && err.code < 1000) return err.code;
      if (err.code === 11000) return 409;
      if (err.name === 'ValidationError') return 400;
      return 500;
    };
    const statusCode = mapStatus(error);
    const message = error?.message || 'Lỗi khi lấy đánh giá của bạn';
    return res.status(statusCode).json({ message });
  }
};

export const getManageReviews = async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const ratings = parseRatingsFilter(req.query.ratings ?? req.query.rating);
    const productKeyword = req.query.productKeyword?.trim() || undefined;
    const productId = req.query.productId || undefined;
    const dateRange = req.query.dateRange || undefined;
    const from = req.query.from || undefined;
    const to = req.query.to || undefined;
    const hasMedia = parseBooleanQuery(req.query.hasMedia);
    const tab = normalizeTab(req.query.tab);
    const status = normalizeStatusFilter(req.query.status);

    const data = await reviewService.listReviewsForStaff({
      page,
      limit,
      ratings,
      productId,
      productKeyword,
      dateRange,
      from,
      to,
      hasMedia,
      tab,
      status,
    });

    return res.json(data);
  } catch (error) {
    console.error('Manage reviews error:', error);
    const mapStatus = (err) => {
      if (!err) return 500;
      if (Number.isInteger(err.code) && err.code >= 100 && err.code < 1000) return err.code;
      if (err.code === 11000) return 409;
      if (err.name === 'ValidationError') return 400;
      return 500;
    };
    const statusCode = mapStatus(error);
    const message = error?.message || 'Lỗi khi lấy danh sách đánh giá';
    return res.status(statusCode).json({ message });
  }
};

export const getManageReviewDetail = async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const review = await reviewService.getReviewDetailForStaff(reviewId);
    return res.json(review);
  } catch (error) {
    console.error('Manage review detail error:', error);
    const mapStatus = (err) => {
      if (!err) return 500;
      if (Number.isInteger(err.code) && err.code >= 100 && err.code < 1000) return err.code;
      if (err.code === 11000) return 409;
      if (err.name === 'ValidationError') return 400;
      return 500;
    };
    const statusCode = mapStatus(error);
    const message = error?.message || 'Lỗi khi lấy chi tiết đánh giá';
    return res.status(statusCode).json({ message });
  }
};

export const getManageReviewStats = async (req, res, next) => {
  try {
    const ratings = parseRatingsFilter(req.query.ratings ?? req.query.rating);
    const productKeyword = req.query.productKeyword?.trim() || undefined;
    const productId = req.query.productId || undefined;
    const dateRange = req.query.dateRange || undefined;
    const from = req.query.from || undefined;
    const to = req.query.to || undefined;
    const hasMedia = parseBooleanQuery(req.query.hasMedia);

    const stats = await reviewService.getReviewStatsSnapshot({
      ratings,
      productId,
      productKeyword,
      dateRange,
      from,
      to,
      hasMedia,
    });

    return res.json(stats);
  } catch (error) {
    console.error('Manage review stats error:', error);
    const mapStatus = (err) => {
      if (!err) return 500;
      if (Number.isInteger(err.code) && err.code >= 100 && err.code < 1000) return err.code;
      if (err.code === 11000) return 409;
      if (err.name === 'ValidationError') return 400;
      return 500;
    };
    const statusCode = mapStatus(error);
    const message = error?.message || 'Lỗi khi lấy thống kê đánh giá';
    return res.status(statusCode).json({ message });
  }
};

export const postAcknowledgeReviews = async (req, res, next) => {
  try {
    const { reviewIds, note } = req.body || {};
    const userId = req.user._id;

    const result = await reviewService.acknowledgeReviews({
      reviewIds,
      acknowledgedBy: userId,
      note,
    });

    return res.status(200).json({
      message: 'Đã đánh dấu các đánh giá là đã xử lý',
      ...result,
    });
  } catch (error) {
    console.error('Acknowledge reviews error:', error);
    const mapStatus = (err) => {
      if (!err) return 500;
      if (Number.isInteger(err.code) && err.code >= 100 && err.code < 1000) return err.code;
      if (err.code === 11000) return 409;
      if (err.name === 'ValidationError') return 400;
      return 500;
    };
    const statusCode = mapStatus(error);
    const message = error?.message || 'Không thể cập nhật trạng thái đánh giá';
    return res.status(statusCode).json({ message });
  }
};

/**
 * Admin/Staff reply to a review
 */
export const postReplyToReview = async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const { comment } = req.body;
    const userId = req.user._id;

    const review = await reviewService.replyToReview({ reviewId, userId, comment });

    return res.status(200).json({
      message: 'Reply đánh giá thành công',
      review,
    });
  } catch (error) {
    console.error('Reply review error:', error);
    const mapStatus = (err) => {
      if (!err) return 500;
      if (Number.isInteger(err.code) && err.code >= 100 && err.code < 1000) return err.code;
      if (err.code === 11000) return 409;
      if (err.name === 'ValidationError') return 400;
      return 500;
    };
    const statusCode = mapStatus(error);
    const message = error?.message || 'Lỗi khi reply đánh giá';
    return res.status(statusCode).json({ message });
  }
};

/**
 * Admin/Staff update their reply
 */
export const putUpdateReply = async (req, res, next) => {
  try {
    const { reviewId, replyId } = req.params;
    const { comment } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;

    const review = await reviewService.updateReply({
      reviewId,
      replyId,
      userId,
      comment,
      userRole,
    });

    return res.status(200).json({
      message: 'Cập nhật  thành công',
      review,
    });
  } catch (error) {
    console.error('Update reply error:', error);
    const mapStatus = (err) => {
      if (!err) return 500;
      if (Number.isInteger(err.code) && err.code >= 100 && err.code < 1000) return err.code;
      if (err.code === 11000) return 409;
      if (err.name === 'ValidationError') return 400;
      return 500;
    };
    const statusCode = mapStatus(error);
    const message = error?.message || 'Lỗi khi cập nhật reply';
    return res.status(statusCode).json({ message });
  }
};

/**
 * Admin/Staff delete their reply
 */
export const deleteReply = async (req, res, next) => {
  try {
    const { reviewId, replyId } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    const { review, needsReply } = await reviewService.deleteReply({
      reviewId,
      replyId,
      userId,
      userRole,
    });

    return res.status(200).json({
      message: 'Xóa reply thành công',
      review,
      needsReply,
    });
  } catch (error) {
    console.error('Delete reply error:', error);
    const mapStatus = (err) => {
      if (!err) return 500;
      if (Number.isInteger(err.code) && err.code >= 100 && err.code < 1000) return err.code;
      if (err.code === 11000) return 409;
      if (err.name === 'ValidationError') return 400;
      return 500;
    };
    const statusCode = mapStatus(error);
    const message = error?.message || 'Lỗi khi xóa reply';
    return res.status(statusCode).json({ message });
  }
};
