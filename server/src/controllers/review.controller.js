import * as reviewService from '../services/review.service.js';

export const postCreateReview = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { orderId, rating, comment } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: 'orderId là bắt buộc' });
    }
    if (!rating) {
      return res.status(400).json({ message: 'rating là bắt buộc' });
    }

    const reviews = await reviewService.createReview({ userId, orderId, rating, comment });
    return res.status(201).json({
      message: `Đã tạo ${reviews.length} đánh giá cho ${reviews.length} sản phẩm`,
      reviews,
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
