// src/middlewares/authMiddleware.js - JWT Authentication Middleware
const jwt = require('jsonwebtoken');
const { errorResponse } = require('../utils/response');
const { logInfo, logError } = require('../config/logger');

const authMiddleware = (req, res, next) => {
  try {
    // Lấy token từ header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logInfo('Auth failed: No token provided', { 
        ip: req.ip,
        url: req.originalUrl 
      });
      return errorResponse(res, 'Token không hợp lệ', 401);
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Gắn user info vào request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      username: decoded.username
    };

    logInfo('Auth successful', { 
      userId: decoded.id,
      email: decoded.email 
    });

    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      logInfo('Auth failed: Invalid token', { 
        ip: req.ip,
        error: error.message 
      });
      return errorResponse(res, 'Token không hợp lệ', 401);
    }

    if (error.name === 'TokenExpiredError') {
      logInfo('Auth failed: Token expired', { 
        ip: req.ip,
        expiredAt: error.expiredAt 
      });
      return errorResponse(res, 'Token đã hết hạn', 401);
    }

    logError('Auth middleware error', error, { ip: req.ip });
    return errorResponse(res, 'Lỗi xác thực', 500);
  }
};

module.exports = authMiddleware;