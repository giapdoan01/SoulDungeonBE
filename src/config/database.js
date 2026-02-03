// src/config/database.js - Supabase Client Configuration (Publishable Key)
const { createClient } = require('@supabase/supabase-js');
const { logInfo, logError } = require('./logger');

let supabase = null;

/**
 * Khởi tạo kết nối Supabase với Publishable Key
 */
const initDatabase = async () => {
  try {
    console.log('🔗 Connecting to Supabase...');

    // Validate environment variables
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL is not defined in .env file');
    }

    if (!supabaseKey) {
      throw new Error('SUPABASE_PUBLISHABLE_KEY is not defined in .env file');
    }

    // Validate URL format
    if (!supabaseUrl.startsWith('https://')) {
      throw new Error('SUPABASE_URL must start with https://');
    }

    // Validate Publishable Key format
    if (!supabaseKey.startsWith('sb_publishable_')) {
      throw new Error('Invalid SUPABASE_PUBLISHABLE_KEY format. Must start with sb_publishable_');
    }

    // Create Supabase client với Publishable Key
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      },
      global: {
        headers: {
          'X-Client-Info': 'souldungeon-server/1.0.0'
        }
      }
    });

    // Test connection bằng cách query table users
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    if (error) {
      // Nếu table chưa tồn tại
      if (error.code === '42P01' || error.code === 'PGRST116' || error.message.includes('does not exist')) {
        console.warn('⚠️  Table "users" does not exist');
        console.log('\n💡 Please create table manually in Supabase Dashboard:');
        console.log('   Go to: https://supabase.com/dashboard/project/vdlkktbikkofouugivxu/editor\n');
        console.log('📋 Run this SQL in SQL Editor:');
        console.log('─'.repeat(60));
        console.log(`
-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(30) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP,
  login_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policies (cho phép server đọc/ghi)
CREATE POLICY "Enable read access for authenticated users" ON users
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON users
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for users based on id" ON users
  FOR UPDATE USING (true);
        `);
        console.log('─'.repeat(60));
        
        logInfo('Supabase connected but table "users" not found');
        
        // Không throw error, để server vẫn chạy được
        console.log('⚠️  Server will continue without full database support');
        return supabase;
      } else {
        // Lỗi khác (permission, network, etc.)
        throw error;
      }
    }

    // Connection successful
    console.log('✅ Supabase connected successfully');
    logInfo('Supabase database initialized successfully');

    // Đếm số users (optional)
    try {
      const { count, error: countError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      if (!countError) {
        console.log(`👥 Total users: ${count || 0}`);
        logInfo('User count retrieved', { count: count || 0 });
      }
    } catch (countErr) {
      // Ignore count error
      console.warn('⚠️  Could not retrieve user count');
    }

    return supabase;

  } catch (error) {
    const errorMessage = error?.message || 'Unknown database error';
    const errorCode = error?.code || 'UNKNOWN';

    console.error('\n❌ Supabase Connection Error:', errorMessage);
    console.error('Error code:', errorCode);
    
    logError('Database initialization failed', error);

    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check .env file exists and contains:');
    console.error('      SUPABASE_URL=https://vdlkktbikkofouugivxu.supabase.co');
    console.error('      SUPABASE_PUBLISHABLE_KEY=sb_publishable_...');
    console.error('   2. Go to Supabase Dashboard → Settings → API');
    console.error('   3. Copy "Project URL" and "Publishable" key');
    console.error('   4. Ensure Supabase project is active (not paused)');
    console.error('   5. Check your internet connection');
    console.error('   6. Verify RLS policies allow server access\n');

    // Throw error để server.js có thể catch
    throw new Error(`Database initialization failed: ${errorMessage}`);
  }
};

/**
 * Lấy Supabase client instance
 */
const getDatabase = () => {
  if (!supabase) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return supabase;
};

/**
 * Kiểm tra kết nối database (dùng cho health check)
 */
const checkDatabaseHealth = async () => {
  try {
    if (!supabase) {
      return {
        status: 'disconnected',
        message: 'Database not initialized',
        timestamp: new Date().toISOString()
      };
    }

    // Ping database
    const startTime = Date.now();
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    const responseTime = Date.now() - startTime;

    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST116') {
        return {
          status: 'warning',
          message: 'Connected but table "users" does not exist',
          responseTime: `${responseTime}ms`,
          timestamp: new Date().toISOString()
        };
      }

      return {
        status: 'error',
        message: error.message,
        code: error.code,
        timestamp: new Date().toISOString()
      };
    }

    return {
      status: 'healthy',
      message: 'Database is connected and responsive',
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    return {
      status: 'error',
      message: error?.message || 'Unknown error',
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Test query (dùng để debug)
 */
const testQuery = async () => {
  try {
    const db = getDatabase();
    
    const { data, error } = await db
      .from('users')
      .select('*')
      .limit(5);

    if (error) {
      console.error('Test query failed:', error);
      return { success: false, error: error.message };
    }

    console.log('Test query successful:', data);
    return { success: true, data };

  } catch (error) {
    console.error('Test query error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Graceful shutdown
 */
const closeDatabase = async () => {
  try {
    if (supabase) {
      // Supabase client không cần close explicitly
      // Nhưng có thể clear reference
      supabase = null;
      logInfo('Database connection closed');
      console.log('✅ Database connection closed');
    }
  } catch (error) {
    logError('Error closing database', error);
    console.error('❌ Error closing database:', error.message);
  }
};

module.exports = {
  initDatabase,
  getDatabase,
  checkDatabaseHealth,
  testQuery,
  closeDatabase,
  // Export supabase getter (không export trực tiếp)
  get supabase() {
    return getDatabase();
  }
};
