// src/middlewares/authMiddleware.js - Authentication Middleware
const jwt = require('jsonwebtoken');
const { errorResponse } = require('../utils/response');

const authenticateToken = (req, res, next) => {
  try {
    // Lấy token từ header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return errorResponse(res, 'Token không tồn tại', 401);
    }

    // Verify token
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return errorResponse(res, 'Token không hợp lệ hoặc đã hết hạn', 403);
      }

      // Lưu thông tin user vào request
      req.user = decoded;
      next();
    });
  } catch (error) {
    return errorResponse(res, 'Lỗi xác thực', 500);
  }
};

module.exports = { authenticateToken };