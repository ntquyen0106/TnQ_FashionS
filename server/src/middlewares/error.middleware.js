export const errorHandler = (err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ message: err.message || "Server error" });
};

export const notFoundHandler= (err, req, res, nesxt) => {
  const status= err.status || 404
  res.json({status: err.status, message: "Not found"});
};