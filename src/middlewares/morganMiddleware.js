// src/middlewares/morganMiddleware.js - Morgan HTTP Logger Middleware
const morgan = require('morgan');
const { accessLogger } = require('../config/logger');

// Custom token để lấy user ID từ request
morgan.token('user-id', (req) => {
  return req.user ? req.user.id : 'anonymous';
});

// Custom token để lấy user email từ request
morgan.token('user-email', (req) => {
  return req.user ? req.user.email : 'anonymous';
});

// Custom token để lấy response time với màu
morgan.token('response-time-colored', (req, res) => {
  const responseTime = parseFloat(morgan['response-time'](req, res));
  if (responseTime > 1000) return `${responseTime}ms (SLOW)`;
  if (responseTime > 500) return `${responseTime}ms (MEDIUM)`;
  return `${responseTime}ms`;
});

// Format cho development (console)
const devFormat = ':method :url :status :response-time ms - :res[content-length]';

// Format cho production (file)
const productionFormat = JSON.stringify({
  method: ':method',
  url: ':url',
  status: ':status',
  responseTime: ':response-time',
  contentLength: ':res[content-length]',
  userAgent: ':user-agent',
  ip: ':remote-addr',
  userId: ':user-id',
  userEmail: ':user-email',
  timestamp: ':date[iso]',
});

// Stream để ghi log vào Winston
const stream = {
  write: (message) => {
    try {
      const logData = JSON.parse(message);
      accessLogger.http('HTTP Request', logData);
    } catch (error) {
      accessLogger.http(message.trim());
    }
  },
};

// Middleware cho development
const morganDev = morgan(devFormat, {
  skip: (req, res) => process.env.NODE_ENV === 'production',
});

// Middleware cho production
const morganProd = morgan(productionFormat, {
  stream,
  skip: (req, res) => process.env.NODE_ENV !== 'production',
});

// Combined middleware
const morganMiddleware = (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return morganProd(req, res, next);
  }
  return morganDev(req, res, next);
};

module.exports = morganMiddleware;