// app.js - REST API Server
require('dotenv').config();
console.log('✅ .env loaded trong app.js.');

const express = require('express');
console.log('✅ Express loaded.');

const cors = require('cors');
console.log('✅ CORS loaded.');

const { createServer } = require('http');
console.log('✅ HTTP server loaded.');

// Kiểm tra các module cần thiết trước khi import
try {
  console.log('📋 Đang tải các module cần thiết trong app.js...');
  const { initDatabase, closeDatabase } = require('./config/database');
  console.log('✅ Database module loaded.');
  
  const { logInfo, logError } = require('./config/logger');
  console.log('✅ Logger module loaded.');
  
  const morganMiddleware = require('./middlewares/morganMiddleware');
  console.log('✅ Morgan middleware loaded.');
  
  // ================= KHỞI TẠO DATABASE TRƯỚC ================= //
  // Khởi tạo database ngay từ đầu trước khi import routes
  console.log('📋 Khởi tạo database trước khi tải routes...');
  
  // Hàm khởi tạo tự gọi
  (async function initDatabaseBeforeRoutes() {
    try {
      await initDatabase();
      console.log('✅ Database đã được khởi tạo trước khi tải routes.');
      loadRoutes(); // Chỉ tải routes sau khi database đã sẵn sàng
    } catch (dbError) {
      console.error('⚠️ Lỗi kết nối database:', dbError);
      logError('Database initialization failed, continuing without database', dbError);
      console.warn('⚠️ WARNING: Database connection failed, will continue without database support');
      loadRoutes(); // Vẫn tải routes nhưng sẽ hiển thị lỗi khi truy cập database
    }
  })();
  
  // Biến lưu trữ routes
  let authRoutes, healthRoutes;
  
  // Hàm tải routes sau khi database đã sẵn sàng
  function loadRoutes() {
    try {
      console.log('📋 Đang tải health routes...');
      healthRoutes = require('./routes/healthRoutes');
      console.log('✅ Health routes loaded.');
    } catch (routeError) {
      console.error('❌ Lỗi khi tải health routes:', routeError);
      process.exit(1);
    }
    
    try {
      console.log('📋 Đang tải auth routes...');
      authRoutes = require('./routes/authRoutes');
      console.log('✅ Auth routes loaded.');
    } catch (routeError) {
      console.error('❌ Lỗi khi tải auth routes:', routeError);
      // Không thoát ứng dụng, vì có thể không cần auth routes để chạy server
      console.warn('⚠️ WARNING: Auth routes failed to load, continuing without auth functionality');
    }
    
    // Sau khi tải routes, khởi động server
    if (require.main === module) {
      console.log('📋 API Server được chạy trực tiếp...');
      startAPIServer()
        .then(() => console.log('✅ API Server started successfully'))
        .catch(err => {
          console.error('❌ Failed to start API server:', err);
          process.exit(1);
        });
    }
  }

  // API server function
  const startAPIServer = async () => {
    try {
      console.log('📋 Bắt đầu khởi tạo API Server...');
      // Khởi tạo Express app
      const app = express();
      const API_PORT = process.env.API_PORT || 3000;

      console.log(`📋 Cấu hình API server trên cổng ${API_PORT}...`);

      // ============= Middleware =============
      app.use(cors({
        origin: process.env.CORS_ORIGIN || '*',
        credentials: true
      }));
      app.use(express.json());
      app.use(express.urlencoded({ extended: true }));
      app.use(morganMiddleware);
      console.log('✅ Middleware đã được thiết lập.');

      logInfo('API Server starting...', {
        port: API_PORT,
        environment: process.env.NODE_ENV || 'development'
      });

      // ============= HTTP Server =============
      const httpServer = createServer(app);
      console.log('✅ HTTP Server đã được tạo.');

      // ============= Routes =============
      console.log('📋 Thiết lập routes...');
      
      // Kiểm tra routes đã tải thành công chưa trước khi thiết lập
      if (healthRoutes) {
        app.use('/health', healthRoutes);
        console.log('✅ Health routes đã được thiết lập.');
      }
      
      if (authRoutes) {
        app.use('/api/auth', authRoutes);
        console.log('✅ Auth routes đã được thiết lập.');
      }

      // Root endpoint
      app.get('/', (req, res) => {
        res.json({
          success: true,
          message: 'SoulDungeon API Server',
          version: '1.0.0',
          endpoints: {
            health: healthRoutes ? '/health' : 'không khả dụng',
            auth: authRoutes ? '/api/auth' : 'không khả dụng'
          }
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
          requestedUrl: req.url
        });
      });

      // Error Handler
      app.use((err, req, res, next) => {
        console.error('❌ Express error handler:', err);
        logError('Unhandled error', err, {
          method: req.method,
          url: req.url,
          ip: req.ip
        });

        res.status(500).json({
          success: false,
          message: 'Internal server error',
          error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
      });

      console.log(`📋 Bắt đầu lắng nghe trên cổng ${API_PORT}...`);
      
      // Start HTTP server - dùng Promise để xử lý rõ ràng
      return new Promise((resolve, reject) => {
        try {
          httpServer.listen(API_PORT, () => {
            console.log('\n╔════════════════════════════════════════════════════════╗');
            console.log('║            🌐 SoulDungeon API Server 🌐              ║');
            console.log('╠════════════════════════════════════════════════════════╣');
            console.log(`║  🌐 HTTP: http://localhost:${API_PORT}`.padEnd(57) + '║');
            console.log(`║  📝 Environment: ${process.env.NODE_ENV || 'development'}`.padEnd(57) + '║');
            console.log(`║  🗄️  Database: Supabase`.padEnd(57) + '║');
            console.log('╚════════════════════════════════════════════════════════╝\n');
            
            logInfo('API Server started successfully', {
              port: API_PORT,
              environment: process.env.NODE_ENV || 'development'
            });
            
            console.log('✅ API Server khởi động thành công.');
            resolve(httpServer);
          });
          
          httpServer.on('error', (err) => {
            console.error('❌ HTTP Server error:', err);
            reject(err);
          });
        } catch (listenError) {
          console.error('❌ Lỗi khi lắng nghe trên cổng:', listenError);
          reject(listenError);
        }
      });
      
    } catch (error) {
      console.error('❌ Lỗi khởi động API server:', error);
      logError('Failed to start API server', error);
      throw error;
    }
  };

  // ============= Graceful Shutdown =============
  const gracefulShutdown = async (signal) => {
    logInfo(`${signal} signal received: closing API server`);
    console.log(`\n🛑 ${signal} received, shutting down API server gracefully...`);
    
    try {
      // Close Database
      await closeDatabase();
    } catch (err) {
      logError('Error closing database', err);
    }

    process.exit(0);
  };

  // Error Handlers - toàn cục
  process.on('unhandledRejection', (reason, promise) => {
    console.error('\n❌ API: Unhandled Rejection at:', promise);
    console.error('Reason:', reason);
    if (reason instanceof Error) {
      console.error('Error name:', reason.name);
      console.error('Error message:', reason.message);
      console.error('Stack trace:', reason.stack);
    }
    logError('API: Unhandled Rejection', reason instanceof Error ? reason : new Error(String(reason)));
  });

  process.on('uncaughtException', (error) => {
    console.error('\n❌ API: Uncaught Exception:', error);
    logError('API: Uncaught Exception', error);
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // module.exports phải nằm bên ngoài phần tải routes để tránh lỗi
  module.exports = { startAPIServer };

} catch (moduleError) {
  console.error('❌ Lỗi khi tải các module cần thiết trong app.js:', moduleError);
  process.exit(1);
}