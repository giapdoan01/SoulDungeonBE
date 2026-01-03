// src/routes/authRoutes.js - Auth Routes
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');

// Validation rules
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
];

// Routes
router.post('/register', registerValidation, authController.register);
router.post('/login', loginValidation, authController.login);
router.get('/me', authMiddleware, authController.getUserInfo);
router.post('/change-password', authMiddleware, changePasswordValidation, authController.changePassword);

module.exports = router;