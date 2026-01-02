// src/config/logger.js - Winston Logger Configuration
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Định nghĩa màu sắc cho các log level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

winston.addColors(colors);

// Định nghĩa format cho log
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Format cho console (có màu sắc)
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(
    (info) => `${info.timestamp} [${info.level}]: ${info.message}`
  )
);

// Tạo thư mục logs nếu chưa có
const logsDir = path.join(__dirname, '../../logs');

// Transport cho error logs
const errorFileTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  maxSize: '20m',
  maxFiles: '14d',
  format: logFormat,
});

// Transport cho combined logs
const combinedFileTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'combined-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  format: logFormat,
});

// Transport cho access logs (HTTP requests)
const accessFileTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'access-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  format: logFormat,
});

// Transport cho auth logs (đăng nhập, đăng ký)
const authFileTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'auth-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  format: logFormat,
});

// Tạo logger chính
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    errorFileTransport,
    combinedFileTransport,
  ],
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'exceptions.log') 
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'rejections.log') 
    }),
  ],
});

// Thêm console transport trong development
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}

// Logger cho access logs
const accessLogger = winston.createLogger({
  level: 'http',
  format: logFormat,
  transports: [accessFileTransport],
});

// Logger cho auth logs
const authLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  transports: [authFileTransport],
});

// Helper functions
const logInfo = (message, meta = {}) => {
  logger.info(message, meta);
};

const logError = (message, error = null, meta = {}) => {
  if (error) {
    logger.error(message, { 
      error: error.message, 
      stack: error.stack,
      ...meta 
    });
  } else {
    logger.error(message, meta);
  }
};

const logWarn = (message, meta = {}) => {
  logger.warn(message, meta);
};

const logDebug = (message, meta = {}) => {
  logger.debug(message, meta);
};

const logHttp = (message, meta = {}) => {
  accessLogger.http(message, meta);
};

const logAuth = (action, userId, email, success, meta = {}) => {
  authLogger.info(`Auth Action: ${action}`, {
    action,
    userId,
    email,
    success,
    timestamp: new Date().toISOString(),
    ...meta
  });
};

module.exports = {
  logger,
  accessLogger,
  authLogger,
  logInfo,
  logError,
  logWarn,
  logDebug,
  logHttp,
  logAuth,
};