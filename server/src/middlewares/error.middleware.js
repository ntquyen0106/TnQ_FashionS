export const errorHandler = (err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ message: err.message || 'Server error' });
};

export const notFoundHandler = (req, res) => {
  res.status(404).json({ message: 'Not found' }); // ✅ 404, không phải 200
};
