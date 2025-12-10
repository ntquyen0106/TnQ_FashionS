import Review from '../models/Review.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import mongoose from 'mongoose';

const { Types } = mongoose;
const { ObjectId } = Types;

const toObjectId = (value) => {
  if (!value) return null;
  try {
    return new ObjectId(String(value));
  } catch (err) {
    return null;
  }
};

const normalizeRatings = (ratings) => {
  if (!Array.isArray(ratings)) return [];
  const values = ratings
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 5);
  return Array.from(new Set(values));
};

const dayInMs = 24 * 60 * 60 * 1000;
const buildDateFilter = ({ dateRange, from, to }) => {
  if (!dateRange || dateRange === 'all') return null;

  if (dateRange === 'custom') {
    const custom = {};
    if (from) {
      const start = new Date(from);
      if (!Number.isNaN(start.getTime())) custom.$gte = start;
    }
    if (to) {
      const end = new Date(to);
      if (!Number.isNaN(end.getTime())) custom.$lte = end;
    }
    return Object.keys(custom).length ? custom : null;
  }

  const map = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
  };
  const days = map[dateRange];
  if (!days) return null;
  return { $gte: new Date(Date.now() - days * dayInMs) };
};

const buildStaffAggregateStages = ({
  match = {},
  productKeyword,
  hasMediaOnly = false,
  includeOrder = false,
} = {}) => {
  const stages = [{ $match: match }];

  if (includeOrder) {
    stages.push(
      {
        $lookup: {
          from: 'orders',
          localField: 'orderId',
          foreignField: '_id',
          as: 'order',
        },
      },
      { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } },
    );
  }

  stages.push(
    {
      $lookup: {
        from: 'products',
        localField: 'productId',
        foreignField: '_id',
        as: 'product',
      },
    },
    { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'customer',
      },
    },
    { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'users',
        localField: 'replies.userId',
        foreignField: '_id',
        as: 'replyUsers',
      },
    },
    {
      $addFields: {
        replyCount: { $size: { $ifNull: ['$replies', []] } },
        hasImages: { $gt: [{ $size: { $ifNull: ['$images', []] } }, 0] },
        hasVideo: {
          $gt: [
            {
              $strLenCP: {
                $trim: { input: { $ifNull: ['$video', ''] } },
              },
            },
            0,
          ],
        },
        acknowledged: { $ifNull: ['$acknowledged', false] },
      },
    },
    {
      $addFields: {
        needsReply: {
          $and: [
            { $lte: ['$rating', 3] },
            { $eq: ['$replyCount', 0] },
            { $ne: ['$acknowledged', true] },
          ],
        },
        status: {
          $cond: [{ $or: [{ $gt: ['$replyCount', 0] }, '$acknowledged'] }, 'responded', 'pending'],
        },
        hasMedia: { $or: ['$hasImages', '$hasVideo'] },
      },
    },
    {
      $addFields: {
        latestReplyAt: {
          $let: {
            vars: {
              lastReply: { $arrayElemAt: [{ $ifNull: ['$replies', []] }, -1] },
            },
            in: '$$lastReply.createdAt',
          },
        },
      },
    },
  );

  if (productKeyword) {
    stages.push({
      $match: {
        'product.name': { $regex: new RegExp(productKeyword, 'i') },
      },
    });
  }

  if (hasMediaOnly) {
    stages.push({ $match: { hasMedia: true } });
  }

  const projection = {
    _id: 1,
    orderId: 1,
    productId: 1,
    userId: 1,
    rating: 1,
    comment: 1,
    variantSku: 1,
    images: 1,
    video: 1,
    replies: 1,
    replyUsers: 1,
    replyCount: 1,
    hasImages: 1,
    hasVideo: 1,
    hasMedia: 1,
    needsReply: 1,
    status: 1,
    createdAt: 1,
    updatedAt: 1,
    latestReplyAt: 1,
    product: {
      _id: '$product._id',
      name: '$product.name',
      slug: '$product.slug',
      thumbnail: '$product.thumbnail',
      images: { $ifNull: ['$product.images', []] },
      variants: { $ifNull: ['$product.variants', []] },
    },
    customer: {
      _id: '$customer._id',
      fullName: '$customer.fullName',
      name: '$customer.name',
      avatar: '$customer.avatar',
    },
    acknowledged: '$acknowledged',
    acknowledgedAt: '$acknowledgedAt',
    acknowledgedBy: '$acknowledgedBy',
    acknowledgedNote: '$acknowledgedNote',
  };

  if (includeOrder) {
    projection.order = {
      _id: '$order._id',
      code: '$order.code',
      shippingAddress: '$order.shippingAddress',
      createdAt: '$order.createdAt',
    };
  }

  stages.push({ $project: projection });

  return stages;
};

const formatStaffReviewDoc = (doc, { includeOrder = false } = {}) => {
  if (!doc) return null;

  const replyUsers = Array.isArray(doc.replyUsers) ? doc.replyUsers : [];
  const replyLookup = new Map(replyUsers.map((u) => [String(u._id), u]));
  const replies = (doc.replies || []).map((reply) => {
    const key = reply?.userId ? String(reply.userId) : null;
    const user = key ? replyLookup.get(key) : null;
    return {
      _id: reply._id,
      comment: reply.comment,
      createdAt: reply.createdAt,
      updatedAt: reply.updatedAt,
      user: user
        ? {
            _id: user._id,
            fullName: user.fullName || user.name || 'TNQ Staff',
            avatar: user.avatar || null,
            role: user.role || null,
          }
        : null,
      userId: reply.userId,
    };
  });

  const productVariants = Array.isArray(doc.product?.variants) ? doc.product.variants : [];
  const variant = doc.variantSku ? productVariants.find((v) => v?.sku === doc.variantSku) : null;
  const variantLabel = [variant?.color, variant?.size].filter(Boolean).join(' / ');

  const productImages = Array.isArray(doc.product?.images) ? doc.product.images : [];
  const primaryImage = productImages.find((img) => img?.isPrimary && img?.publicId);
  const fallbackImage = productImages[0];
  const productThumbnail =
    doc.product?.thumbnail ||
    variant?.imagePublicId ||
    primaryImage?.publicId ||
    fallbackImage?.publicId ||
    null;

  const customerName = doc.customer?.fullName || doc.customer?.name || 'Khách hàng';

  const formatted = {
    _id: doc._id,
    productId: doc.productId,
    orderId: doc.orderId,
    rating: doc.rating,
    comment: doc.comment || '',
    variantSku: doc.variantSku || '',
    variantLabel,
    productVariant: variant
      ? {
          color: variant.color || null,
          size: variant.size || null,
        }
      : null,
    product: doc.product
      ? {
          _id: doc.product._id,
          name: doc.product.name,
          slug: doc.product.slug,
          thumbnail: productThumbnail,
        }
      : null,
    customer: doc.customer
      ? {
          _id: doc.customer._id,
          name: customerName,
          avatar: doc.customer.avatar || null,
        }
      : null,
    customerName,
    images: doc.images || [],
    video: doc.video || '',
    replies,
    replyCount: doc.replyCount || replies.length,
    hasImages: doc.hasImages ?? (doc.images || []).length > 0,
    hasVideo: doc.hasVideo ?? Boolean(doc.video),
    hasMedia: doc.hasMedia ?? ((doc.images || []).length > 0 || Boolean(doc.video)),
    needsReply: Boolean(doc.needsReply),
    status: doc.status || (replies.length ? 'responded' : 'pending'),
    acknowledged: Boolean(doc.acknowledged),
    acknowledgedAt: doc.acknowledgedAt || null,
    acknowledgedBy: doc.acknowledgedBy || null,
    acknowledgedNote: doc.acknowledgedNote || '',
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    latestReplyAt:
      doc.latestReplyAt || (replies.length ? replies[replies.length - 1].createdAt : null),
  };

  if (includeOrder && doc.order) {
    formatted.order = {
      _id: doc.order._id,
      code: doc.order.code || doc.order._id,
      createdAt: doc.order.createdAt,
      shippingAddress: doc.order.shippingAddress || null,
    };
  }

  return formatted;
};

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

export const listReviewsForStaff = async ({
  page = 1,
  limit = 20,
  ratings = [],
  productId,
  productKeyword,
  dateRange,
  from,
  to,
  hasMedia,
  tab = 'need_reply',
  status,
} = {}) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(Math.max(1, Number(limit) || 20), 50);
  const skip = (safePage - 1) * safeLimit;

  const match = {};
  const ratingFilters = normalizeRatings(ratings);
  if (ratingFilters.length) {
    match.rating = { $in: ratingFilters };
  }

  const productObjectId = toObjectId(productId);
  if (productObjectId) {
    match.productId = productObjectId;
  }

  const createdFilter = buildDateFilter({ dateRange, from, to });
  if (createdFilter) {
    match.createdAt = createdFilter;
  }

  const sharedStages = buildStaffAggregateStages({
    match,
    productKeyword,
    hasMediaOnly: Boolean(hasMedia),
  });

  const tabMatches = [];
  if (tab === 'need_reply') {
    tabMatches.push({ $match: { status: 'pending' } });
  } else if (tab === 'responded') {
    tabMatches.push({ $match: { status: 'responded' } });
  }

  if (status === 'pending' || status === 'responded') {
    tabMatches.push({ $match: { status } });
  }

  const pipeline = [
    ...sharedStages,
    {
      $facet: {
        stats: [
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              needsReply: { $sum: { $cond: ['$needsReply', 1, 0] } },
              pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
              responded: { $sum: { $cond: [{ $eq: ['$status', 'responded'] }, 1, 0] } },
            },
          },
        ],
        items: [
          ...tabMatches,
          { $sort: { needsReply: -1, createdAt: -1 } },
          { $skip: skip },
          { $limit: safeLimit },
        ],
        count: [...tabMatches, { $count: 'total' }],
      },
    },
  ];

  const result = await Review.aggregate(pipeline);
  const payload = result[0] || { stats: [], items: [], count: [] };
  const stats = payload.stats[0] || { total: 0, needsReply: 0, pending: 0, responded: 0 };
  const total = payload.count[0]?.total || 0;
  const items = (payload.items || []).map((doc) => formatStaffReviewDoc(doc));

  return {
    items,
    pagination: {
      total,
      page: safePage,
      limit: safeLimit,
      pages: Math.max(1, Math.ceil(total / safeLimit)),
    },
    stats,
  };
};

export const getReviewDetailForStaff = async (reviewId) => {
  const reviewObjectId = toObjectId(reviewId);
  if (!reviewObjectId) {
    throw { code: 400, message: 'ID đánh giá không hợp lệ' };
  }

  const pipeline = buildStaffAggregateStages({
    match: { _id: reviewObjectId },
    includeOrder: true,
  });

  pipeline.push({ $limit: 1 });

  const result = await Review.aggregate(pipeline);
  if (!result.length) {
    throw { code: 404, message: 'Không tìm thấy đánh giá' };
  }

  return formatStaffReviewDoc(result[0], { includeOrder: true });
};

export const getReviewStatsSnapshot = async ({
  ratings = [],
  productId,
  productKeyword,
  dateRange,
  from,
  to,
  hasMedia,
} = {}) => {
  const match = {};
  const ratingFilters = normalizeRatings(ratings);
  if (ratingFilters.length) {
    match.rating = { $in: ratingFilters };
  }

  const productObjectId = toObjectId(productId);
  if (productObjectId) {
    match.productId = productObjectId;
  }

  const createdFilter = buildDateFilter({ dateRange, from, to });
  if (createdFilter) {
    match.createdAt = createdFilter;
  }

  const pipeline = buildStaffAggregateStages({
    match,
    productKeyword,
    hasMediaOnly: Boolean(hasMedia),
  });

  pipeline.push({
    $group: {
      _id: null,
      total: { $sum: 1 },
      needsReply: { $sum: { $cond: ['$needsReply', 1, 0] } },
      pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
      responded: { $sum: { $cond: [{ $eq: ['$status', 'responded'] }, 1, 0] } },
    },
  });

  const stats = await Review.aggregate(pipeline);
  return stats[0] || { total: 0, needsReply: 0, pending: 0, responded: 0 };
};

export const acknowledgeReviews = async ({ reviewIds, acknowledgedBy, note }) => {
  if (!Array.isArray(reviewIds) || reviewIds.length === 0) {
    throw { code: 400, message: 'Cần chọn ít nhất một đánh giá' };
  }

  const ids = Array.from(
    new Set(reviewIds.map((value) => toObjectId(value)).filter((value) => Boolean(value))),
  );

  if (!ids.length) {
    throw { code: 400, message: 'Danh sách đánh giá không hợp lệ' };
  }

  const actorId = toObjectId(acknowledgedBy);
  if (!actorId) {
    throw { code: 400, message: 'Không xác định được người xác nhận' };
  }

  const updatePayload = {
    acknowledged: true,
    acknowledgedBy: actorId,
    acknowledgedAt: new Date(),
  };

  if (typeof note === 'string') {
    updatePayload.acknowledgedNote = note.trim();
  }

  const updateResult = await Review.updateMany({ _id: { $in: ids } }, { $set: updatePayload });

  const pipeline = buildStaffAggregateStages({
    match: { _id: { $in: ids } },
  });

  const docs = await Review.aggregate(pipeline);
  const items = docs.map((doc) => formatStaffReviewDoc(doc));

  return {
    matchedCount: updateResult?.matchedCount ?? ids.length,
    modifiedCount: updateResult?.modifiedCount ?? 0,
    items,
  };
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
  const replyIndex = review.replies.findIndex((r) => r._id.toString() === replyId.toString());

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
  const replyIndex = review.replies.findIndex((r) => r._id.toString() === replyId.toString());

  if (replyIndex === -1) {
    throw { code: 404, message: 'Không tìm thấy reply' };
  }

  const reply = review.replies[replyIndex];

  // Chỉ người tạo reply hoặc admin mới được xóa
  if (reply.userId.toString() !== userId.toString() && userRole !== 'admin') {
    throw { code: 403, message: 'Bạn không có quyền xóa reply này' };
  }

  // Xóa reply khỏi mảng và lưu lại
  review.replies.splice(replyIndex, 1);
  await review.save();

  const needsReply = review.rating <= 3 && review.replies.length === 0;
  return { review, needsReply };
};
