// src/validators/authValidator.js - Validation Rules
const { body } = require('express-validator');

const registerValidator = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username phải có từ 3-30 ký tự')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username chỉ được chứa chữ cái, số và dấu gạch dưới'),
  
  body('email')
    .trim()
    .isEmail()
    .withMessage('Email không hợp lệ')
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password phải có ít nhất 6 ký tự')
];

const loginValidator = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Email không hợp lệ')
    .normalizeEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('Password là bắt buộc')
];

const changePasswordValidator = [
  body('oldPassword')
    .notEmpty()
    .withMessage('Password cũ là bắt buộc'),
  
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('Password mới phải có ít nhất 6 ký tự')
];

module.exports = {
  registerValidator,
  loginValidator,
  changePasswordValidator
};