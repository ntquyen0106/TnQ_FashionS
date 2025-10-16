// src/middlewares/error.middleware.js

/**
 * 404 handler: chuyển tiếp lỗi 404 tới errorHandler trung tâm.
 * Đặt middleware này trước errorHandler trong app:
 *   app.use(notFoundHandler);
 *   app.use(errorHandler);
 */
export const notFoundHandler = (req, res, next) => {
  const error = new Error('Not found');
  error.status = 404;
  next(error);
};

/**
 * Central error handler
 * - Gửi JSON { message, stack? } (stack chỉ hiển thị khi không phải production)
 * - Tránh gửi 2 lần nếu headers đã được gửi
 */
export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err); // tránh gửi hai lần nếu đã bắt đầu response

  // Ghi log một lần cho mục đích chẩn đoán
  console.error(err);

  const status = Number(err.status) || 500;
  const payload = {
    message: err.message || 'Server error',
  };

  // Chỉ trả stack khi không ở production để tránh lộ thông tin
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    payload.stack = err.stack;
  }

  res.status(status).json(payload);
};

export default {
  notFoundHandler,
  errorHandler,
};
