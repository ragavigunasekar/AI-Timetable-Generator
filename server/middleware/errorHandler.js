import logger from '../utils/logger.js';

export function errorHandler(err, req, res, next) {
  logger.error(`${err.name}: ${err.message}`, { stack: err.stack });

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Authentication failed. Please sign in again.';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired. Please sign in again.';
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    message = err.message;
  } else if (err.message && err.message.includes('SQLITE_CONSTRAINT')) {
    statusCode = 409;
    message = 'Resource already exists';
  } else if (statusCode === 404) {
    message = 'The requested resource was not found.';
  } else if (statusCode === 403) {
    message = 'You do not have permission to access this resource.';
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

export function notFoundHandler(req, res) {
  logger.warn(`404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
}
