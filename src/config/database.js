// src/config/database.js - Supabase Database Configuration
const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');

// Supabase Client (cho auth và realtime features)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// PostgreSQL Pool (cho raw queries)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Test connection
const initDatabase = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Supabase PostgreSQL Connected');
    
    // Tạo bảng users nếu chưa có
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(30) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    `);
    
    console.log('✅ Database tables initialized');
    client.release();
  } catch (error) {
    console.error('❌ Database Connection Error:', error.message);
    process.exit(1);
  }
};

module.exports = {
  supabase,
  pool,
  initDatabase
};