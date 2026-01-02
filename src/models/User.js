// src/models/User.js - User Model for Supabase PostgreSQL
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

class User {
  // Tạo user mới
  static async create({ username, email, password }) {
    try {
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      const query = `
        INSERT INTO users (username, email, password, created_at, updated_at)
        VALUES ($1, $2, $3, NOW(), NOW())
        RETURNING id, username, email, created_at, updated_at
      `;

      const result = await pool.query(query, [username, email, hashedPassword]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Tìm user theo email
  static async findByEmail(email) {
    try {
      const query = `
        SELECT id, username, email, password, created_at, updated_at
        FROM users
        WHERE email = $1
      `;

      const result = await pool.query(query, [email]);
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  // Tìm user theo username
  static async findByUsername(username) {
    try {
      const query = `
        SELECT id, username, email, password, created_at, updated_at
        FROM users
        WHERE username = $1
      `;

      const result = await pool.query(query, [username]);
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  // Tìm user theo ID
  static async findById(id) {
    try {
      const query = `
        SELECT id, username, email, created_at, updated_at
        FROM users
        WHERE id = $1
      `;

      const result = await pool.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  // Tìm user theo ID (bao gồm password)
  static async findByIdWithPassword(id) {
    try {
      const query = `
        SELECT id, username, email, password, created_at, updated_at
        FROM users
        WHERE id = $1
      `;

      const result = await pool.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  // Cập nhật password
  static async updatePassword(id, newPassword) {
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      const query = `
        UPDATE users
        SET password = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, username, email, updated_at
      `;

      const result = await pool.query(query, [hashedPassword, id]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // So sánh password
  static async comparePassword(plainPassword, hashedPassword) {
    try {
      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error) {
      throw error;
    }
  }

  // Xóa user (nếu cần)
  static async delete(id) {
    try {
      const query = `
        DELETE FROM users
        WHERE id = $1
        RETURNING id
      `;

      const result = await pool.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  // Lấy tất cả users (cho admin)
  static async findAll(limit = 100, offset = 0) {
    try {
      const query = `
        SELECT id, username, email, created_at, updated_at
        FROM users
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
      `;

      const result = await pool.query(query, [limit, offset]);
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  // Đếm tổng số users
  static async count() {
    try {
      const query = `SELECT COUNT(*) as count FROM users`;
      const result = await pool.query(query);
      return parseInt(result.rows[0].count);
    } catch (error) {
      throw error;
    }
  }

  // Cập nhật thông tin user
  static async update(id, { username, email }) {
    try {
      const updates = [];
      const values = [];
      let paramCount = 1;

      if (username) {
        updates.push(`username = $${paramCount++}`);
        values.push(username);
      }

      if (email) {
        updates.push(`email = $${paramCount++}`);
        values.push(email);
      }

      if (updates.length === 0) {
        throw new Error('No fields to update');
      }

      updates.push(`updated_at = NOW()`);
      values.push(id);

      const query = `
        UPDATE users
        SET ${updates.join(', ')}
        WHERE id = $${paramCount}
        RETURNING id, username, email, created_at, updated_at
      `;

      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }
}

module.exports = User;