import Review from '../models/Review.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import mongoose from 'mongoose';

/**
 * Validate that order exists, belongs to user, is DONE or RETURNED
 */
export const validateOrderForReview = async (orderId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return { valid: false, code: 400, message: 'ID đơn hàng không hợp lệ' };
  }

  const order = await Order.findById(orderId).select('userId status items').lean();
  if (!order) {
    return { valid: false, code: 404, message: 'Không tìm thấy đơn hàng' };
  }
  if (order.userId.toString() !== userId.toString()) {
    return { valid: false, code: 403, message: 'Đơn hàng không thuộc về bạn' };
  }
  if (order.status !== 'DONE' && order.status !== 'RETURNED') {
    return {
      valid: false,
      code: 400,
      message: 'Chỉ được đánh giá đơn hàng đã hoàn thành hoặc đã trả hàng',
    };
  }

  // Check if already reviewed
  const existingReview = await Review.findOne({ orderId }).lean();
  if (existingReview) {
    return { valid: false, code: 409, message: 'Đơn hàng này đã được đánh giá rồi' };
  }

  return { valid: true, order };
};

export const createReview = async ({ userId, orderId, rating, comment }) => {
  // Validate rating
  if (!rating || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    throw { code: 400, message: 'Điểm đánh giá phải là số nguyên từ 1 đến 5' };
  }

  // Validate order
  const validation = await validateOrderForReview(orderId, userId);
  if (!validation.valid) {
    throw { code: validation.code, message: validation.message };
  }

  const order = validation.order;

  // Create a review document for each product in the order.
  // We allow the same user to review the same product again in a new order.
  // Uniqueness is enforced per (orderId, productId) via the schema index,
  // and validateOrderForReview prevents re-reviewing the same order twice.
  const reviewPromises = order.items.map((item) =>
    Review.create({
      orderId,
      userId,
      productId: item.productId,
      rating,
      comment: comment || '',
    }),
  );

  const reviews = await Promise.all(reviewPromises);

  // Update rating for each product in order
  for (const item of order.items) {
    const agg = await Review.aggregate([
      { $match: { productId: item.productId } },
      {
        $group: {
          _id: '$productId',
          avg: { $avg: '$rating' },
          count: { $sum: 1 },
        },
      },
    ]);

    if (agg.length > 0) {
      const stats = agg[0];
      await Product.findByIdAndUpdate(item.productId, {
        ratingAvg: Math.round(stats.avg * 10) / 10,
        ratingCount: stats.count,
      });
    }
  }

  return reviews;
};

export const listReviewsByProduct = async (productId, { page = 1, limit = 10 } = {}) => {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw { code: 400, message: 'ID sản phẩm không hợp lệ' };
  }

  const skip = (page - 1) * limit;
  const reviews = await Review.find({ productId })
    .populate('userId', 'name avatar')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
  const total = await Review.countDocuments({ productId });
  return { reviews, total, page, limit };
};

export const listUserReviews = async (userId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw { code: 400, message: 'ID người dùng không hợp lệ' };
  }

  const reviews = await Review.find({ userId })
    .populate({
      path: 'orderId',
      select: 'createdAt items amounts.grandTotal status',
      populate: {
        path: 'items.productId',
        select: 'name thumbnail',
      },
    })
    .sort({ createdAt: -1 })
    .lean();

  return reviews.map((review) => ({
    _id: review._id,
    orderId: review.orderId?._id || null,
    orderDate: review.orderId?.createdAt || null,
    orderStatus: review.orderId?.status || null,
    totalAmount: review.orderId?.amounts?.grandTotal || null,
    products: Array.isArray(review.orderId?.items)
      ? review.orderId.items.map((item) => {
          const p = item.productId || {};
          return {
            productId: p._id || p || null,
            productName: p.name || null,
            productImage: p.thumbnail || p.imagePublicId || null,
            variantSku: item.variantSku || null,
            qty: item.qty || 0,
          };
        })
      : [],
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
  }));
};
