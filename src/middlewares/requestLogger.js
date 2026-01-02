// src/middlewares/requestLogger.js - Custom Request Logger
const { logInfo, logWarn } = require('../config/logger');

const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  // Log request
  logInfo('Incoming Request', {
    method: req.method,
    url: req.url,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    userId: req.user ? req.user.id : null,
    body: req.method === 'POST' || req.method === 'PUT' ? 
      sanitizeBody(req.body) : undefined,
  });

  // Capture response
  const originalSend = res.send;
  res.send = function (data) {
    const duration = Date.now() - startTime;
    
    // Log response
    const logData = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user ? req.user.id : null,
    };

    if (res.statusCode >= 400) {
      logWarn('Request Failed', logData);
    } else {
      logInfo('Request Completed', logData);
    }

    originalSend.call(this, data);
  };

  next();
};

// Helper function để ẩn sensitive data
const sanitizeBody = (body) => {
  if (!body) return body;
  
  const sanitized = { ...body };
  
  // Ẩn password
  if (sanitized.password) {
    sanitized.password = '***HIDDEN***';
  }
  if (sanitized.oldPassword) {
    sanitized.oldPassword = '***HIDDEN***';
  }
  if (sanitized.newPassword) {
    sanitized.newPassword = '***HIDDEN***';
  }
  
  return sanitized;
};

module.exports = requestLogger;