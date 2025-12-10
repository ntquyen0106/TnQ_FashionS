import * as reviewService from '../services/review.service.js';

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

    const review = await reviewService.updateReply({ reviewId, replyId, userId, comment, userRole });
    
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

    const review = await reviewService.deleteReply({ reviewId, replyId, userId, userRole });
    
    return res.status(200).json({
      message: 'Xóa reply thành công',
      review,
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
