const env = require('../config/env');

const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message || 'Internal Server Error';

  if (err.name === 'ZodError') {
    statusCode = 400;
    message = err.issues
      ? err.issues.map((i) => `${i.path.join('.')} ${i.message}`).join(', ')
      : err.message;
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  res.status(statusCode).json({
    success: false,
    message,
    stack: env.NODE_ENV === 'production' ? undefined : err.stack,
  });
};

module.exports = errorHandler;
