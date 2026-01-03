// server.js - Entry point
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./src/config/database');
const { logInfo, logError } = require('./src/config/logger');
const morganMiddleware = require('./src/middlewares/morganMiddleware');
const authRoutes = require('./src/routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Database
initDatabase();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Morgan HTTP Logger
app.use(morganMiddleware);

// Log server start
logInfo('Server starting...', {
  port: PORT,
  environment: process.env.NODE_ENV,
  nodeVersion: process.version
});

// Routes
app.use('/api/auth', authRoutes);

// Health check
app.get('/health', (req, res) => {
  const healthData = {
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    database: 'Supabase',
    uptime: process.uptime(),
    memory: process.memoryUsage()
  };
  
  logInfo('Health check', healthData);
  res.json(healthData);
});

// 404 Handler
app.use((req, res) => {
  logError('Route not found', null, {
    method: req.method,
    url: req.url,
    ip: req.ip
  });
  
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error Handler
app.use((err, req, res, next) => {
  logError('Unhandled error', err, {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userId: req.user ? req.user.id : null
  });

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start Server
const server = app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV}`);
  console.log(`🗄️  Database: Supabase`);
  console.log(`📊 Logs directory: ./logs`);
  
  logInfo('Server started successfully', {
    port: PORT,
    environment: process.env.NODE_ENV,
    database: 'Supabase'
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logInfo('SIGTERM signal received: closing HTTP server');
  console.log('\n🛑 SIGTERM received, shutting down gracefully...');
  
  server.close(() => {
    logInfo('HTTP server closed');
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logInfo('SIGINT signal received: closing HTTP server');
  console.log('\n🛑 SIGINT received, shutting down gracefully...');
  
  server.close(() => {
    logInfo('HTTP server closed');
    console.log('✅ Server closed');
    process.exit(0);
  });
});

module.exports = server;