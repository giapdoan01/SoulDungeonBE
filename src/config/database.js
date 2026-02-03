// src/config/database.js - Supabase Client Configuration
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Kiểm tra biến môi trường
if (!supabaseUrl || !supabaseKey) {
  console.error('SUPABASE_URL hoặc SUPABASE_KEY chưa được thiết lập');
  console.error('Hãy kiểm tra file .env của bạn');
  process.exit(1);
}

// Tạo Supabase client với service role key (có full quyền)
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Test connection và tạo bảng
const initDatabase = async () => {
  try {
    console.log('🔗 Connecting to Supabase...');
    
    // Test connection bằng cách query đơn giản
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    if (error && error.code === '42P01') {
      // Bảng chưa tồn tại, cần tạo thủ công trên Supabase Dashboard
      console.log('⚠️  Table "users" does not exist');
      console.log('💡 Please create table manually in Supabase Dashboard:');
      console.log(`
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(30) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
      `);
    } else if (error) {
      throw error;
    } else {
      console.log('✅ Supabase connected successfully');
      
      // Đếm số users
      const { count } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });
      
      console.log(`👥 Total users: ${count || 0}`);
    }
  } catch (error) {
    console.error('❌ Supabase Connection Error:', error.message);
    console.error('💡 Troubleshooting:');
    console.error('   1. Kiểm tra SUPABASE_URL và SUPABASE_KEY trong .env');
    console.error('   2. Đảm bảo Supabase project đang active');
    console.error('   3. Kiểm tra table "users" đã được tạo chưa');
    console.error('   4. Vào Supabase Dashboard → SQL Editor để tạo table');
  }
};

module.exports = {
  supabase,
  initDatabase
};