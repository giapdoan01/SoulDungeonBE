// src/controllers/healthController.js - Health Check Controller
const { supabase } = require('../config/database');
const { successResponse, errorResponse } = require('../utils/response');
const os = require('os');

/**
 * Basic Health Check - Nhanh, đơn giản
 */
const basicHealth = (req, res) => {
  return successResponse(res, 'Server is running', {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
};

/**
 * Detailed Health Check - Kiểm tra đầy đủ
 */
const detailedHealth = async (req, res) => {
  const startTime = Date.now();
  
  try {
    // 1. Server Info
    const serverInfo = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      nodeVersion: process.version,
      platform: process.platform,
      uptime: {
        process: formatUptime(process.uptime()),
        system: formatUptime(os.uptime())
      }
    };

    // 2. Memory Info
    const memoryUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    const memoryInfo = {
      process: {
        rss: formatBytes(memoryUsage.rss),
        heapTotal: formatBytes(memoryUsage.heapTotal),
        heapUsed: formatBytes(memoryUsage.heapUsed),
        external: formatBytes(memoryUsage.external)
      },
      system: {
        total: formatBytes(totalMemory),
        used: formatBytes(usedMemory),
        free: formatBytes(freeMemory),
        usagePercent: ((usedMemory / totalMemory) * 100).toFixed(2) + '%'
      }
    };

    // 3. CPU Info
    const cpuInfo = {
      cores: os.cpus().length,
      model: os.cpus()[0].model,
      speed: os.cpus()[0].speed + ' MHz',
      loadAverage: os.loadavg().map(load => load.toFixed(2))
    };

    // 4. Database Health Check
    const dbHealth = await checkDatabaseHealth();

    // 5. Response Time
    const responseTime = Date.now() - startTime;

    return successResponse(res, 'Health check completed', {
      server: serverInfo,
      memory: memoryInfo,
      cpu: cpuInfo,
      database: dbHealth,
      performance: {
        responseTime: responseTime + 'ms'
      }
    });

  } catch (error) {
    return errorResponse(res, 'Health check failed', 500, {
      error: error.message
    });
  }
};

/**
 * Database Health Check
 */
const databaseHealth = async (req, res) => {
  const startTime = Date.now();

  try {
    const dbHealth = await checkDatabaseHealth();
    const responseTime = Date.now() - startTime;

    if (!dbHealth.connected) {
      return errorResponse(res, 'Database connection failed', 503, {
        database: dbHealth,
        responseTime: responseTime + 'ms'
      });
    }

    return successResponse(res, 'Database is healthy', {
      database: dbHealth,
      responseTime: responseTime + 'ms'
    });

  } catch (error) {
    return errorResponse(res, 'Database health check failed', 500, {
      error: error.message
    });
  }
};

/**
 * Readiness Check - Kubernetes/Docker ready probe
 */
const readiness = async (req, res) => {
  try {
    // Kiểm tra database connection
    const dbHealth = await checkDatabaseHealth();

    if (!dbHealth.connected) {
      return res.status(503).json({
        status: 'NOT_READY',
        reason: 'Database not connected'
      });
    }

    // Kiểm tra các dependencies khác nếu cần
    // ...

    return res.status(200).json({
      status: 'READY',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return res.status(503).json({
      status: 'NOT_READY',
      error: error.message
    });
  }
};

/**
 * Liveness Check - Kubernetes/Docker liveness probe
 */
const liveness = (req, res) => {
  // Chỉ kiểm tra process còn sống
  return res.status(200).json({
    status: 'ALIVE',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
};

// ============= Helper Functions =============

/**
 * Kiểm tra database health
 */
async function checkDatabaseHealth() {
  const startTime = Date.now();
  
  try {
    // Test connection với simple query
    const { data, error } = await supabase
      .from('users')
      .select('count', { count: 'exact', head: true });

    const responseTime = Date.now() - startTime;

    if (error && error.code !== 'PGRST116') {
      return {
        connected: false,
        error: error.message,
        responseTime: responseTime + 'ms'
      };
    }

    // Đếm số users
    const { count: userCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    return {
      connected: true,
      status: 'OK',
      provider: 'Supabase',
      url: process.env.SUPABASE_URL,
      responseTime: responseTime + 'ms',
      stats: {
        totalUsers: userCount || 0
      }
    };

  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      connected: false,
      error: error.message,
      responseTime: responseTime + 'ms'
    };
  }
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format uptime to human readable
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

module.exports = {
  basicHealth,
  detailedHealth,
  databaseHealth,
  readiness,
  liveness
};