// src/services/authService.js - Authentication Service với Supabase Client
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase } = require('../config/database');
const { logInfo, logError } = require('../config/logger');

class AuthService {
  /**
   * Đăng ký user mới
   */
  static async register(username, email, password) {
    try {
      logInfo('Register attempt', { username, email });

      // Kiểm tra email đã tồn tại
      const { data: existingEmail, error: emailCheckError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle(); // Sử dụng maybeSingle() thay vì single() để tránh lỗi khi không tìm thấy

      // Nếu có lỗi khác ngoài "not found"
      if (emailCheckError && emailCheckError.code !== 'PGRST116') {
        throw emailCheckError;
      }

      if (existingEmail) {
        logInfo('Register failed: Email already exists', { email });
        return {
          success: false,
          message: 'Email đã được sử dụng'
        };
      }

      // Kiểm tra username đã tồn tại
      const { data: existingUsername, error: usernameCheckError } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .maybeSingle();

      if (usernameCheckError && usernameCheckError.code !== 'PGRST116') {
        throw usernameCheckError;
      }

      if (existingUsername) {
        logInfo('Register failed: Username already exists', { username });
        return {
          success: false,
          message: 'Username đã được sử dụng'
        };
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Tạo user mới
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([
          {
            username,
            email,
            password: hashedPassword
          }
        ])
        .select()
        .single();

      if (insertError) {
        logError('Insert user error', insertError, { username, email });
        throw insertError;
      }

      // Tạo JWT token
      const token = jwt.sign(
        { id: newUser.id, email: newUser.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE }
      );

      // Xóa password trước khi trả về
      delete newUser.password;

      logInfo('Register successful', { userId: newUser.id, email });

      return {
        success: true,
        message: 'Đăng ký thành công',
        data: {
          token,
          user: newUser
        }
      };
    } catch (error) {
      logError('Register error', error, { username, email });
      
      // Xử lý lỗi unique constraint
      if (error.code === '23505') {
        if (error.message.includes('users_email_key')) {
          return {
            success: false,
            message: 'Email đã được sử dụng'
          };
        }
        if (error.message.includes('users_username_key')) {
          return {
            success: false,
            message: 'Username đã được sử dụng'
          };
        }
      }

      return {
        success: false,
        message: 'Lỗi server khi đăng ký'
      };
    }
  }

  /**
   * Đăng nhập
   */
  static async login(email, password) {
    try {
      logInfo('Login attempt', { email });

      // Tìm user theo email
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!user) {
        logInfo('Login failed: User not found', { email });
        return {
          success: false,
          message: 'Email hoặc mật khẩu không đúng'
        };
      }

      // Kiểm tra password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        logInfo('Login failed: Invalid password', { email });
        return {
          success: false,
          message: 'Email hoặc mật khẩu không đúng'
        };
      }

      // Tạo JWT token
      const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE }
      );

      // Xóa password trước khi trả về
      delete user.password;

      logInfo('Login successful', { userId: user.id, email });

      return {
        success: true,
        message: 'Đăng nhập thành công',
        data: {
          token,
          user
        }
      };
    } catch (error) {
      logError('Login error', error, { email });
      return {
        success: false,
        message: 'Lỗi server khi đăng nhập'
      };
    }
  }

  /**
   * Lấy thông tin user từ token
   */
  static async getUserInfo(userId) {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('id, username, email, created_at')
        .eq('id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!user) {
        return {
          success: false,
          message: 'User không tồn tại'
        };
      }

      return {
        success: true,
        data: user
      };
    } catch (error) {
      logError('Get user info error', error, { userId });
      return {
        success: false,
        message: 'Lỗi server'
      };
    }
  }

  /**
   * Đổi mật khẩu
   */
  static async changePassword(userId, oldPassword, newPassword) {
    try {
      logInfo('Change password attempt', { userId });

      // Lấy user hiện tại
      const { data: user, error } = await supabase
        .from('users')
        .select('password')
        .eq('id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!user) {
        return {
          success: false,
          message: 'User không tồn tại'
        };
      }

      // Kiểm tra mật khẩu cũ
      const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
      if (!isPasswordValid) {
        logInfo('Change password failed: Invalid old password', { userId });
        return {
          success: false,
          message: 'Mật khẩu cũ không đúng'
        };
      }

      // Hash mật khẩu mới
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          password: hashedPassword,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        throw updateError;
      }

      logInfo('Change password successful', { userId });

      return {
        success: true,
        message: 'Đổi mật khẩu thành công'
      };
    } catch (error) {
      logError('Change password error', error, { userId });
      return {
        success: false,
        message: 'Lỗi server khi đổi mật khẩu'
      };
    }
  }
}

module.exports = AuthService;