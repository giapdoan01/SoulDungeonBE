// src/controllers/authController.js - Auth Controller
const { validationResult } = require('express-validator');
const AuthService = require('../services/authService');
const { successResponse, errorResponse } = require('../utils/response');
const { logInfo, logError } = require('../config/logger');

// Register Controller
const register = async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logInfo('Register validation failed', { errors: errors.array() });
      return errorResponse(res, 'Dữ liệu không hợp lệ', 400, errors.array());
    }

    const { username, email, password } = req.body;

    // Gọi AuthService
    const result = await AuthService.register(username, email, password);

    const duration = Date.now() - startTime;

    if (!result.success) {
      logInfo('Register failed', { email, reason: result.message, duration: `${duration}ms` });
      return errorResponse(res, result.message, 400);
    }

    logInfo('Register successful', { 
      userId: result.data.user.id, 
      email, 
      duration: `${duration}ms` 
    });

    return successResponse(res, result.message, result.data, 201);

  } catch (error) {
    const duration = Date.now() - startTime;
    logError('Register controller error', error, { 
      email: req.body.email,
      duration: `${duration}ms`
    });
    return errorResponse(res, 'Lỗi server', 500);
  }
};

// Login Controller
const login = async (req, res) => {
  const startTime = Date.now();
  const ipAddress = req.ip || req.connection.remoteAddress;
  
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logInfo('Login validation failed', { errors: errors.array() });
      return errorResponse(res, 'Dữ liệu không hợp lệ', 400, errors.array());
    }

    const { email, password } = req.body;

    // Gọi AuthService
    const result = await AuthService.login(email, password);

    const duration = Date.now() - startTime;

    if (!result.success) {
      logInfo('Login failed', { 
        email, 
        ip: ipAddress,
        reason: result.message, 
        duration: `${duration}ms` 
      });
      return errorResponse(res, result.message, 401);
    }

    logInfo('Login successful', { 
      userId: result.data.user.id, 
      email,
      ip: ipAddress,
      duration: `${duration}ms` 
    });

    return successResponse(res, result.message, result.data);

  } catch (error) {
    const duration = Date.now() - startTime;
    logError('Login controller error', error, { 
      email: req.body.email,
      ip: ipAddress,
      duration: `${duration}ms`
    });
    return errorResponse(res, 'Lỗi server', 500);
  }
};

// Get User Info Controller
const getUserInfo = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await AuthService.getUserInfo(userId);

    if (!result.success) {
      return errorResponse(res, result.message, 404);
    }

    return successResponse(res, 'Lấy thông tin user thành công', result.data);

  } catch (error) {
    logError('Get user info controller error', error, { userId: req.user?.id });
    return errorResponse(res, 'Lỗi server', 500);
  }
};

// Change Password Controller
const changePassword = async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, 'Dữ liệu không hợp lệ', 400, errors.array());
    }

    const userId = req.user.id;
    const { oldPassword, newPassword } = req.body;

    const result = await AuthService.changePassword(userId, oldPassword, newPassword);

    if (!result.success) {
      return errorResponse(res, result.message, 400);
    }

    logInfo('Password changed successfully', { userId });
    return successResponse(res, result.message);

  } catch (error) {
    logError('Change password controller error', error, { userId: req.user?.id });
    return errorResponse(res, 'Lỗi server', 500);
  }
};

module.exports = {
  register,
  login,
  getUserInfo,
  changePassword
};