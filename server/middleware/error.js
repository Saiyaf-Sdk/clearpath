// Small helper so async controllers can throw and still reach the error handler
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Throw this to send a specific HTTP status + message
class ApiError extends Error {
  // extra: optional fields sent with the message, e.g. { code: 'WRONG_PORTAL', portal: {...} }
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const notFound = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.originalUrl}`));
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message || 'Server error';

  if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors).map((e) => e.message).join(', ');
  } else if (err.name === 'CastError') {
    status = 400;
    message = 'Invalid ID';
  } else if (err.code === 11000) {
    status = 409;
    message = `${Object.keys(err.keyValue).join(', ')} already exists`;
  } else if (err.name === 'MulterError') {
    status = 400;
    if (err.code === 'LIMIT_FILE_SIZE') message = 'That file is too large. Please choose a smaller one.';
  }

  if (status === 500) console.error(err);
  res.status(status).json({ message, ...(err.extra || {}) });
};

module.exports = { asyncHandler, ApiError, notFound, errorHandler };
