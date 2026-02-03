// server.js - Entry point
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('colyseus');
const { monitor } = require('@colyseus/monitor');

const { initDatabase } = require('./src/config/database');
const { logInfo, logError } = require('./src/config/logger');
const morganMiddleware = require('./src/middlewares/morganMiddleware');

// Routes
const authRoutes = require('./src/routes/authRoutes');
const healthRoutes = require('./src/routes/healthRoutes');

// Colyseus Rooms
const { MatchmakingRoom } = require('./src/Colyseus/rooms/MatchmakingRoom');
const { GameRoom } = require('./src/Colyseus/rooms/GameRoom');

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

// ============= Colyseus Setup =============
const httpServer = createServer(app);
const gameServer = new Server({
  server: httpServer,
  express: app,
});

// Define Colyseus Rooms
gameServer.define("matchmaking", MatchmakingRoom);
gameServer.define("game_room", GameRoom);

// Colyseus Monitor (optional - for debugging)
if (process.env.NODE_ENV === 'development') {
  app.use('/colyseus', monitor());
  logInfo('Colyseus Monitor enabled at /colyseus');
}

logInfo('Colyseus rooms registered', {
  rooms: ['matchmaking', 'game_room']
});

// ============= Routes =============

// Health Check Routes (không cần auth)
app.use('/health', healthRoutes);

// Auth Routes
app.use('/api/auth', authRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'SoulDungeon API Server',
    version: '1.0.0',
    endpoints: {
      health: {
        basic: '/health',
        detailed: '/health/detailed',
        database: '/health/database',
        readiness: '/health/readiness',
        liveness: '/health/liveness'
      },
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        me: 'GET /api/auth/me',
        changePassword: 'POST /api/auth/change-password'
      },
      colyseus: {
        websocket: `ws://localhost:${PORT}`,
        matchmaking: 'Room: matchmaking',
        game: 'Room: game_room',
        monitor: process.env.NODE_ENV === 'development' ? '/colyseus' : 'disabled'
      }
    },
    documentation: 'https://github.com/yourusername/souldungeon'
  });
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
    message: 'Route not found',
    requestedUrl: req.url,
    method: req.method
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

// Start Server (dùng httpServer thay vì app.listen)
httpServer.listen(PORT, () => {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║          🎮 SoulDungeon API Server Started 🎮         ║');
  console.log('╠════════════════════════════════════════════════════════╣');
  console.log(`║  🌐 HTTP: http://localhost:${PORT}`.padEnd(57) + '║');
  console.log(`║  🎮 WebSocket: ws://localhost:${PORT}`.padEnd(57) + '║');
  console.log(`║  📝 Environment: ${process.env.NODE_ENV}`.padEnd(57) + '║');
  console.log(`║  🗄️  Database: Supabase`.padEnd(57) + '║');
  console.log(`║  📊 Logs: ./logs`.padEnd(57) + '║');
  console.log('╠════════════════════════════════════════════════════════╣');
  console.log('║  Health Checks:'.padEnd(57) + '║');
  console.log(`║    • Basic:    GET /health`.padEnd(57) + '║');
  console.log(`║    • Detailed: GET /health/detailed`.padEnd(57) + '║');
  console.log(`║    • Database: GET /health/database`.padEnd(57) + '║');
  console.log('╠════════════════════════════════════════════════════════╣');
  console.log('║  Colyseus Rooms:'.padEnd(57) + '║');
  console.log(`║    • Matchmaking: matchmaking`.padEnd(57) + '║');
  console.log(`║    • Game Room:   game_room`.padEnd(57) + '║');
  if (process.env.NODE_ENV === 'development') {
    console.log(`║    • Monitor:     http://localhost:${PORT}/colyseus`.padEnd(57) + '║');
  }
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  logInfo('Server started successfully', {
    port: PORT,
    environment: process.env.NODE_ENV,
    database: 'Supabase',
    colyseus: 'enabled'
  });
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logInfo(`${signal} signal received: closing HTTP server`);
  console.log(`\n🛑 ${signal} received, shutting down gracefully...`);
  
  try {
    // Gracefully shutdown Colyseus first
    await gameServer.gracefullyShutdown();
    logInfo('Colyseus server closed');
    console.log('✅ Colyseus closed');
  } catch (err) {
    logError('Error closing Colyseus', err);
  }

  httpServer.close(() => {
    logInfo('HTTP server closed');
    console.log('✅ Server closed');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    logError('Forced shutdown after timeout');
    console.error('❌ Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled rejection
process.on('unhandledRejection', (reason, promise) => {
  logError('Unhandled Rejection', reason, { promise });
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Uncaught exception
process.on('uncaughtException', (error) => {
  logError('Uncaught Exception', error);
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

module.exports = httpServer;
