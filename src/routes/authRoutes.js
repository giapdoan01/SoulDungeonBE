// src/routes/authRoutes.js - Complete Auth Routes
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');

// ============= Validation Rules =============

const registerValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username phải từ 3-30 ký tự')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username chỉ chứa chữ, số và dấu gạch dưới'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Email không hợp lệ')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Mật khẩu phải có ít nhất 6 ký tự')
];

const loginValidation = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Email không hợp lệ')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Mật khẩu không được để trống')
];

const changePasswordValidation = [
  body('oldPassword')
    .notEmpty()
    .withMessage('Mật khẩu cũ không được để trống'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('Mật khẩu mới phải có ít nhất 6 ký tự')
    .custom((value, { req }) => {
      if (value === req.body.oldPassword) {
        throw new Error('Mật khẩu mới phải khác mật khẩu cũ');
      }
      return true;
    })
];

const forgotPasswordValidation = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Email không hợp lệ')
    .normalizeEmail()
];

const resetPasswordValidation = [
  body('token')
    .notEmpty()
    .withMessage('Token không được để trống'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('Mật khẩu mới phải có ít nhất 6 ký tự')
];

// ============= Public Routes (Không cần authentication) =============

/**
 * @route   POST /api/auth/register
 * @desc    Đăng ký user mới
 * @access  Public
 * @body    { username, email, password }
 */
router.post('/register', registerValidation, authController.register);

/**
 * @route   POST /api/auth/login
 * @desc    Đăng nhập
 * @access  Public
 * @body    { email, password }
 * @return  { accessToken, refreshToken, user }
 */
router.post('/login', loginValidation, authController.login);

/**
 * @route   POST /api/auth/logout
 * @desc    Đăng xuất (revoke refresh token)
 * @access  Public
 * @body    { refreshToken }
 */
router.post('/logout', authController.logout);

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Refresh access token bằng refresh token
 * @access  Public
 * @body    { refreshToken }
 * @return  { accessToken }
 */
router.post('/refresh-token', authController.refreshToken);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Yêu cầu reset password (gửi email với token)
 * @access  Public
 * @body    { email }
 */
router.post('/forgot-password', forgotPasswordValidation, authController.forgotPassword);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password với token từ email
 * @access  Public
 * @body    { token, newPassword }
 */
router.post('/reset-password', resetPasswordValidation, authController.resetPassword);

// ============= Protected Routes (Cần Bearer Token) =============

/**
 * @route   GET /api/auth/me
 * @desc    Lấy thông tin user hiện tại
 * @access  Private
 * @header  Authorization: Bearer {accessToken}
 */
router.get('/me', authMiddleware, authController.getUserInfo);

/**
 * @route   POST /api/auth/change-password
 * @desc    Đổi mật khẩu (cần mật khẩu cũ)
 * @access  Private
 * @header  Authorization: Bearer {accessToken}
 * @body    { oldPassword, newPassword }
 */
router.post('/change-password', authMiddleware, changePasswordValidation, authController.changePassword);

/**
 * @route   POST /api/auth/logout-all
 * @desc    Đăng xuất khỏi tất cả thiết bị (revoke all refresh tokens)
 * @access  Private
 * @header  Authorization: Bearer {accessToken}
 */
router.post('/logout-all', authMiddleware, authController.logoutAllDevices);

module.exports = router;