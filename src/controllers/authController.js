// src/controllers/authController.js - Auth Controller với Logging
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const { successResponse, errorResponse } = require('../utils/response');
const { logInfo, logError, logAuth } = require('../config/logger');

// Generate JWT Token
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      username: user.username, 
      email: user.email 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

// Register Controller
const register = async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logAuth('REGISTER_FAILED', null, req.body.email, false, {
        reason: 'Validation failed',
        errors: errors.array()
      });
      return errorResponse(res, 'Dữ liệu không hợp lệ', 400, errors.array());
    }

    const { username, email, password } = req.body;

    logInfo('Register attempt', { username, email });

    // Kiểm tra email đã tồn tại
    const existingEmail = await User.findByEmail(email);
    if (existingEmail) {
      logAuth('REGISTER_FAILED', null, email, false, {
        reason: 'Email already exists'
      });
      return errorResponse(res, 'Email đã được sử dụng', 400);
    }

    // Kiểm tra username đã tồn tại
    const existingUsername = await User.findByUsername(username);
    if (existingUsername) {
      logAuth('REGISTER_FAILED', null, email, false, {
        reason: 'Username already exists',
        username
      });
      return errorResponse(res, 'Username đã được sử dụng', 400);
    }

    // Tạo user mới
    const user = await User.create({ username, email, password });

    // Tạo token
    const token = generateToken(user);

    const duration = Date.now() - startTime;
    
    logAuth('REGISTER_SUCCESS', user.id, email, true, {
      username,
      duration: `${duration}ms`
    });

    logInfo('User registered successfully', {
      userId: user.id,
      username,
      email,
      duration: `${duration}ms`
    });

    return successResponse(res, 'Đăng ký thành công', {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.created_at
      }
    }, 201);

  } catch (error) {
    logError('Register Error', error, {
      email: req.body.email,
      username: req.body.username
    });
    
    logAuth('REGISTER_ERROR', null, req.body.email, false, {
      error: error.message
    });

    // Xử lý lỗi unique constraint từ PostgreSQL
    if (error.code === '23505') {
      if (error.constraint === 'users_email_key') {
        return errorResponse(res, 'Email đã được sử dụng', 400);
      }
      if (error.constraint === 'users_username_key') {
        return errorResponse(res, 'Username đã được sử dụng', 400);
      }
    }
    
    return errorResponse(res, 'Lỗi server', 500);
  }
};

// Login Controller
const login = async (req, res) => {
  const startTime = Date.now();
  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('user-agent');
  
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logAuth('LOGIN_FAILED', null, req.body.email, false, {
        reason: 'Validation failed',
        ip: ipAddress,
        errors: errors.array()
      });
      return errorResponse(res, 'Dữ liệu không hợp lệ', 400, errors.array());
    }

    const { email, password } = req.body;

    logInfo('Login attempt', { email, ip: ipAddress });

    // Tìm user
    const user = await User.findByEmail(email);
    
    if (!user) {
      logAuth('LOGIN_FAILED', null, email, false, {
        reason: 'User not found',
        ip: ipAddress,
        userAgent
      });
      return errorResponse(res, 'Email hoặc mật khẩu không đúng', 401);
    }

    // Kiểm tra password
    const isPasswordValid = await User.comparePassword(password, user.password);
    if (!isPasswordValid) {
      logAuth('LOGIN_FAILED', user.id, email, false, {
        reason: 'Invalid password',
        ip: ipAddress,
        userAgent
      });
      return errorResponse(res, 'Email hoặc mật khẩu không đúng', 401);
    }

    // Tạo token
    const token = generateToken(user);

    const duration = Date.now() - startTime;

    logAuth('LOGIN_SUCCESS', user.id, email, true, {
      username: user.username,
      ip: ipAddress,
      userAgent,
      duration: `${duration}ms`
    });

    logInfo('User logged in successfully', {
      userId: user.id,
      username: user.username,
      email,
      ip: ipAddress,
      duration: `${duration}ms`
    });

    return successResponse(res, 'Đăng nhập thành công', {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.created_at
      }
    });

  } catch (error) {
    logError('Login Error', error, {
      email: req.body.email,
      ip: ipAddress
    });
    
    logAuth('LOGIN_ERROR', null, req.body.email, false, {
      error: error.message,
      ip: ipAddress
    });

    return errorResponse(res, 'Lỗi server', 500);
  }
};

// Get Current User Controller
const getMe = async (req, res) => {
  try {
    logInfo('Get user info', { userId: req.user.id });

    const user = await User.findById(req.user.id);

    if (!user) {
      logError('User not found', null, { userId: req.user.id });
      return errorResponse(res, 'User không tồn tại', 404);
    }

    logInfo('User info retrieved', { userId: user.id, email: user.email });

    return successResponse(res, 'Lấy thông tin thành công', {
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    });

  } catch (error) {
    logError('GetMe Error', error, { userId: req.user.id });
    return errorResponse(res, 'Lỗi server', 500);
  }
};

// Change Password Controller
const changePassword = async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logAuth('CHANGE_PASSWORD_FAILED', req.user.id, req.user.email, false, {
        reason: 'Validation failed'
      });
      return errorResponse(res, 'Dữ liệu không hợp lệ', 400, errors.array());
    }

    const { oldPassword, newPassword } = req.body;

    logInfo('Change password attempt', { 
      userId: req.user.id, 
      email: req.user.email 
    });

    // Lấy user với password
    const user = await User.findByIdWithPassword(req.user.id);

    if (!user) {
      logError('User not found', null, { userId: req.user.id });
      return errorResponse(res, 'User không tồn tại', 404);
    }

    // Kiểm tra mật khẩu cũ
    const isPasswordValid = await User.comparePassword(oldPassword, user.password);
    if (!isPasswordValid) {
      logAuth('CHANGE_PASSWORD_FAILED', user.id, user.email, false, {
        reason: 'Invalid old password'
      });
      return errorResponse(res, 'Mật khẩu cũ không đúng', 401);
    }

    // Cập nhật mật khẩu mới
    await User.updatePassword(user.id, newPassword);

    logAuth('CHANGE_PASSWORD_SUCCESS', user.id, user.email, true);

    logInfo('Password changed successfully', {
      userId: user.id,
      email: user.email
    });

    return successResponse(res, 'Đổi mật khẩu thành công');

  } catch (error) {
    logError('ChangePassword Error', error, { 
      userId: req.user.id,
      email: req.user.email 
    });
    
    logAuth('CHANGE_PASSWORD_ERROR', req.user.id, req.user.email, false, {
      error: error.message
    });

    return errorResponse(res, 'Lỗi server', 500);
  }
};

// Update Profile Controller
const updateProfile = async (req, res) => {
  try {
    const { username, email } = req.body;

    if (!username && !email) {
      return errorResponse(res, 'Không có thông tin để cập nhật', 400);
    }

    logInfo('Update profile attempt', {
      userId: req.user.id,
      oldEmail: req.user.email,
      newUsername: username,
      newEmail: email
    });

    // Kiểm tra username đã tồn tại (nếu thay đổi)
    if (username) {
      const existingUsername = await User.findByUsername(username);
      if (existingUsername && existingUsername.id !== req.user.id) {
        logAuth('UPDATE_PROFILE_FAILED', req.user.id, req.user.email, false, {
          reason: 'Username already exists',
          username
        });
        return errorResponse(res, 'Username đã được sử dụng', 400);
      }
    }

    // Kiểm tra email đã tồn tại (nếu thay đổi)
    if (email) {
      const existingEmail = await User.findByEmail(email);
      if (existingEmail && existingEmail.id !== req.user.id) {
        logAuth('UPDATE_PROFILE_FAILED', req.user.id, req.user.email, false, {
          reason: 'Email already exists',
          email
        });
        return errorResponse(res, 'Email đã được sử dụng', 400);
      }
    }

    // Cập nhật thông tin
    const updatedUser = await User.update(req.user.id, { username, email });

    logAuth('UPDATE_PROFILE_SUCCESS', req.user.id, email || req.user.email, true, {
      oldUsername: req.user.username,
      newUsername: username,
      oldEmail: req.user.email,
      newEmail: email
    });

    logInfo('Profile updated successfully', {
      userId: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email
    });

    return successResponse(res, 'Cập nhật thông tin thành công', {
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      updatedAt: updatedUser.updated_at
    });

  } catch (error) {
    logError('UpdateProfile Error', error, {
      userId: req.user.id,
      email: req.user.email
    });
    
    logAuth('UPDATE_PROFILE_ERROR', req.user.id, req.user.email, false, {
      error: error.message
    });

    if (error.code === '23505') {
      if (error.constraint === 'users_email_key') {
        return errorResponse(res, 'Email đã được sử dụng', 400);
      }
      if (error.constraint === 'users_username_key') {
        return errorResponse(res, 'Username đã được sử dụng', 400);
      }
    }
    
    return errorResponse(res, 'Lỗi server', 500);
  }
};

module.exports = {
  register,
  login,
  getMe,
  changePassword,
  updateProfile
};