// src/routes/authRoutes.js - Auth Routes
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { 
  registerValidator, 
  loginValidator, 
  changePasswordValidator 
} = require('../validators/authValidator');

// Public Routes
router.post('/register', registerValidator, authController.register);
router.post('/login', loginValidator, authController.login);

// Protected Routes (yêu cầu authentication)
router.get('/me', authenticateToken, authController.getMe);
router.post('/change-password', authenticateToken, changePasswordValidator, authController.changePassword);
router.put('/profile', authenticateToken, authController.updateProfile);

module.exports = router;