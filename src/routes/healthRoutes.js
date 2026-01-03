// src/routes/healthRoutes.js - Health Check Routes
const express = require('express');
const router = express.Router();
const healthController = require('../controllers/healthController');

/**
 * @route   GET /health
 * @desc    Basic health check - Nhanh, đơn giản
 * @access  Public
 */
router.get('/', healthController.basicHealth);

/**
 * @route   GET /health/detailed
 * @desc    Detailed health check - Đầy đủ thông tin
 * @access  Public
 */
router.get('/detailed', healthController.detailedHealth);

/**
 * @route   GET /health/database
 * @desc    Database health check
 * @access  Public
 */
router.get('/database', healthController.databaseHealth);

/**
 * @route   GET /health/readiness
 * @desc    Readiness probe - Cho Kubernetes/Docker
 * @access  Public
 */
router.get('/readiness', healthController.readiness);

/**
 * @route   GET /health/liveness
 * @desc    Liveness probe - Cho Kubernetes/Docker
 * @access  Public
 */
router.get('/liveness', healthController.liveness);

module.exports = router;