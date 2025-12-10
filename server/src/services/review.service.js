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

export const createReview = async ({ userId, orderId, reviews: reviewsArray }) => {
  // reviewsArray: [{ productId, rating, comment, variantSku, images: [], video: '' }, ...]

  if (!Array.isArray(reviewsArray) || reviewsArray.length === 0) {
    throw { code: 400, message: 'Phải gửi ít nhất một đánh giá sản phẩm' };
  }

  // Validate order
  const validation = await validateOrderForReview(orderId, userId);
  if (!validation.valid) {
    throw { code: validation.code, message: validation.message };
  }

  const order = validation.order;

  // Map productIds in order for quick validation
  const orderProductIds = order.items.map((item) => item.productId.toString());

  // Validate each review
  const createdReviews = [];
  for (const reviewData of reviewsArray) {
    const { productId, rating, comment, variantSku, images, video } = reviewData;

    // Validate productId is in order
    if (!orderProductIds.includes(productId.toString())) {
      throw { code: 400, message: `Sản phẩm ${productId} không có trong đơn hàng` };
    }

    // Validate rating
    if (!rating || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      throw { code: 400, message: 'Điểm đánh giá phải là số nguyên từ 1 đến 5' };
    }

    // Validate images (max 3)
    if (images && images.length > 3) {
      throw { code: 400, message: 'Tối đa 3 ảnh cho mỗi đánh giá sản phẩm' };
    }

    // Create review
    const review = await Review.create({
      orderId,
      userId,
      productId,
      rating,
      comment: comment || '',
      variantSku: variantSku || '',
      images: images || [],
      video: video || '',
    });

    createdReviews.push(review);

    // Update product rating stats
    const agg = await Review.aggregate([
      { $match: { productId: new mongoose.Types.ObjectId(productId) } },
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
      await Product.findByIdAndUpdate(productId, {
        ratingAvg: Math.round(stats.avg * 10) / 10,
        ratingCount: stats.count,
      });
    }
  }

  return createdReviews;
};

export const listReviewsByProduct = async (productId, { page = 1, limit = 10 } = {}) => {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw { code: 400, message: 'ID sản phẩm không hợp lệ' };
  }

  const skip = (page - 1) * limit;
  const reviews = await Review.find({ productId })
    .populate('userId', 'fullName avatar')
    .populate({ path: 'orderId', select: 'shippingAddress.fullName' })
    .populate('replies.userId', 'fullName avatar role')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .select('rating comment variantSku images video userId orderId replies createdAt')
    .lean();
  const total = await Review.countDocuments({ productId });

  const enriched = reviews.map((review) => {
    const customerName =
      review.userId?.fullName || review.orderId?.shippingAddress?.fullName || 'Khách hàng';
    const customerAvatar = review.userId?.avatar || null;
    
    // Format replies nếu có (mảng)
    const repliesData = (review.replies || []).map((reply) => ({
      _id: reply._id,
      comment: reply.comment,
      userId: reply.userId?._id,
      userName: reply.userId?.fullName || 'Staff',
      userAvatar: reply.userId?.avatar || null,
      userRole: reply.userId?.role || null,
      createdAt: reply.createdAt,
      updatedAt: reply.updatedAt,
    }));
    
    return {
      ...review,
      customerName,
      customerAvatar,
      replies: repliesData,
    };
  });

  return { reviews: enriched, total, page, limit };
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
    orderId: review.orderId?._id || review.orderId || null,
    productId: review.productId || null,
    variantSku: review.variantSku || null,
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
    images: review.images || [],
    video: review.video || '',
    createdAt: review.createdAt,
  }));
};

/**
 * Admin/Staff reply to a review (thêm reply mới vào mảng)
 */
export const replyToReview = async ({ reviewId, userId, comment }) => {
  if (!mongoose.Types.ObjectId.isValid(reviewId)) {
    throw { code: 400, message: 'ID đánh giá không hợp lệ' };
  }

  if (!comment || !comment.trim()) {
    throw { code: 400, message: 'Nội dung reply không được để trống' };
  }

  const review = await Review.findById(reviewId);
  if (!review) {
    throw { code: 404, message: 'Không tìm thấy đánh giá' };
  }

  // Thêm reply mới vào mảng replies
  review.replies.push({
    userId,
    comment: comment.trim(),
  });

  await review.save();

  return review;
};

/**
 * Admin/Staff update their reply
 */
export const updateReply = async ({ reviewId, replyId, userId, comment, userRole }) => {
  if (!mongoose.Types.ObjectId.isValid(reviewId)) {
    throw { code: 400, message: 'ID đánh giá không hợp lệ' };
  }

  if (!mongoose.Types.ObjectId.isValid(replyId)) {
    throw { code: 400, message: 'ID reply không hợp lệ' };
  }

  if (!comment || !comment.trim()) {
    throw { code: 400, message: 'Nội dung reply không được để trống' };
  }

  const review = await Review.findById(reviewId);
  if (!review) {
    throw { code: 404, message: 'Không tìm thấy đánh giá' };
  }

  // Tìm reply trong mảng
  const replyIndex = review.replies.findIndex(
    (r) => r._id.toString() === replyId.toString()
  );

  if (replyIndex === -1) {
    throw { code: 404, message: 'Không tìm thấy reply' };
  }

  const reply = review.replies[replyIndex];

  // Chỉ người tạo reply hoặc admin mới được sửa
  if (reply.userId.toString() !== userId.toString() && userRole !== 'admin') {
    throw { code: 403, message: 'Bạn không có quyền sửa reply này' };
  }

  // Cập nhật reply
  review.replies[replyIndex].comment = comment.trim();

  await review.save();

  return review;
};

/**
 * Admin/Staff delete their reply
 */
export const deleteReply = async ({ reviewId, replyId, userId, userRole }) => {
  if (!mongoose.Types.ObjectId.isValid(reviewId)) {
    throw { code: 400, message: 'ID đánh giá không hợp lệ' };
  }

  if (!mongoose.Types.ObjectId.isValid(replyId)) {
    throw { code: 400, message: 'ID reply không hợp lệ' };
  }

  const review = await Review.findById(reviewId);
  if (!review) {
    throw { code: 404, message: 'Không tìm thấy đánh giá' };
  }

  // Tìm reply trong mảng
  const replyIndex = review.replies.findIndex(
    (r) => r._id.toString() === replyId.toString()
  );

  if (replyIndex === -1) {
    throw { code: 404, message: 'Không tìm thấy reply' };
  }

  const reply = review.replies[replyIndex];

  // Chỉ người tạo reply hoặc admin mới được xóa
  if (reply.userId.toString() !== userId.toString() && userRole !== 'admin') {
    throw { code: 403, message: 'Bạn không có quyền xóa reply này' };
  }

  // Xóa reply khỏi mảng
  review.replies.splice(replyIndex, 1);
  await review.save();

  return review;
};
