// 404 handler: forward to central error handler
export const notFoundHandler = (req, res, next) => {
  const err = new Error('Not found');
  err.status = 404;
  next(err);
};

// Centralized error handler
export const errorHandler = (err, req, res, next) => {
  // Log once for diagnostics
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ message: err.message || 'Server error' });
};
