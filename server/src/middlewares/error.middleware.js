// Central error handler
export const errorHandler = (err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ message: err.message || 'Server error' });
};

// 404 handler: forward to errorHandler with a 404 Error object
export const notFoundHandler = (req, res, next) => {
  const error = new Error('Not found');
  error.status = 404;
  next(error);
};
