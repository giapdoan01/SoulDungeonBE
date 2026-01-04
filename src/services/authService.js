// src/services/authService.js - Timezone Fixed
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { supabase } = require('../config/database');
const { logInfo, logError } = require('../config/logger');

class AuthService {
  /**
   * Register
   */
  static async register(username, email, password) {
    try {
      logInfo('Register attempt', { username, email });

      const { data: existingEmail, error: emailCheckError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle();

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

      const hashedPassword = await bcrypt.hash(password, 10);

      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([
          {
            username,
            email,
            password: hashedPassword,
            is_active: true,
            email_verified: false,
            login_count: 0
          }
        ])
        .select()
        .single();

      if (insertError) {
        logError('Insert user error', insertError, { username, email });
        throw insertError;
      }

      const { accessToken, refreshToken } = await this.generateTokens(newUser);

      delete newUser.password;

      logInfo('Register successful', { userId: newUser.id, email });

      return {
        success: true,
        message: 'Đăng ký thành công',
        data: {
          accessToken,
          refreshToken,
          user: newUser
        }
      };
    } catch (error) {
      logError('Register error', error, { username, email });
      
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
   * Login
   */
  static async login(email, password, ipAddress = null, userAgent = null) {
    try {
      logInfo('Login attempt', { email, ip: ipAddress });

      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!user) {
        await this.logLoginHistory(null, ipAddress, userAgent, false);
        logInfo('Login failed: User not found', { email });
        return {
          success: false,
          message: 'Email hoặc mật khẩu không đúng'
        };
      }

      if (!user.is_active) {
        logInfo('Login failed: Account locked', { email, userId: user.id });
        return {
          success: false,
          message: 'Tài khoản đã bị khóa. Vui lòng liên hệ admin.'
        };
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        await this.logLoginHistory(user.id, ipAddress, userAgent, false);
        logInfo('Login failed: Invalid password', { email });
        return {
          success: false,
          message: 'Email hoặc mật khẩu không đúng'
        };
      }

      await supabase
        .from('users')
        .update({ 
          last_login: new Date().toISOString(),
          login_count: user.login_count + 1
        })
        .eq('id', user.id);

      const { accessToken, refreshToken } = await this.generateTokens(user, ipAddress, userAgent);

      await this.logLoginHistory(user.id, ipAddress, userAgent, true);

      delete user.password;

      logInfo('Login successful', { userId: user.id, email });

      return {
        success: true,
        message: 'Đăng nhập thành công',
        data: {
          accessToken,
          refreshToken,
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
   * Logout
   */
  static async logout(refreshToken) {
    try {
      logInfo('Logout attempt');

      if (!refreshToken) {
        return {
          success: false,
          message: 'Refresh token không được để trống'
        };
      }

      const { error } = await supabase
        .from('refresh_tokens')
        .update({ 
          revoked: true,
          revoked_at: new Date().toISOString()
        })
        .eq('token', refreshToken)
        .eq('revoked', false);

      if (error) {
        throw error;
      }

      logInfo('Logout successful');
      return {
        success: true,
        message: 'Đăng xuất thành công'
      };
    } catch (error) {
      logError('Logout error', error);
      return {
        success: false,
        message: 'Lỗi khi đăng xuất'
      };
    }
  }

  /**
   * Logout All Devices
   */
  static async logoutAllDevices(userId) {
    try {
      logInfo('Logout all devices', { userId });

      const { error } = await supabase
        .from('refresh_tokens')
        .update({ 
          revoked: true,
          revoked_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('revoked', false);

      if (error) {
        throw error;
      }

      logInfo('Logout all devices successful', { userId });
      return {
        success: true,
        message: 'Đã đăng xuất khỏi tất cả thiết bị'
      };
    } catch (error) {
      logError('Logout all devices error', error, { userId });
      return {
        success: false,
        message: 'Lỗi khi đăng xuất'
      };
    }
  }

  /**
   * Refresh Access Token
   */
  static async refreshAccessToken(refreshToken) {
    try {
      logInfo('Refresh token attempt');

      if (!refreshToken) {
        return {
          success: false,
          message: 'Refresh token không được để trống'
        };
      }

      const { data: tokenData, error } = await supabase
        .from('refresh_tokens')
        .select('*')
        .eq('token', refreshToken)
        .eq('revoked', false)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!tokenData) {
        logInfo('Refresh token failed: Token not found or revoked');
        return {
          success: false,
          message: 'Refresh token không hợp lệ hoặc đã bị thu hồi'
        };
      }

      // ✅ FIX: Force UTC timezone
      const expiresAt = new Date(tokenData.expires_at + 'Z');
      if (expiresAt < new Date()) {
        logInfo('Refresh token failed: Token expired');
        return {
          success: false,
          message: 'Refresh token đã hết hạn. Vui lòng đăng nhập lại.'
        };
      }

      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, username, email, is_active')
        .eq('id', tokenData.user_id)
        .maybeSingle();

      if (userError || !user) {
        return {
          success: false,
          message: 'User không tồn tại'
        };
      }

      if (!user.is_active) {
        return {
          success: false,
          message: 'Tài khoản đã bị khóa'
        };
      }

      const accessToken = jwt.sign(
        { id: user.id, email: user.email, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || '15m' }
      );

      logInfo('Refresh token successful', { userId: user.id });

      return {
        success: true,
        message: 'Refresh token thành công',
        data: {
          accessToken
        }
      };
    } catch (error) {
      logError('Refresh token error', error);
      return {
        success: false,
        message: 'Lỗi khi refresh token'
      };
    }
  }

  /**
   * Get User Info
   */
  static async getUserInfo(userId) {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('id, username, email, created_at, updated_at, last_login, login_count, email_verified, is_active')
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
   * Change Password
   */
  static async changePassword(userId, oldPassword, newPassword) {
    try {
      logInfo('Change password attempt', { userId });

      const { data: user, error } = await supabase
        .from('users')
        .select('password')
        .eq('id', userId)
        .maybeSingle();

      if (error || !user) {
        return {
          success: false,
          message: 'User không tồn tại'
        };
      }

      const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
      if (!isPasswordValid) {
        logInfo('Change password failed: Invalid old password', { userId });
        return {
          success: false,
          message: 'Mật khẩu cũ không đúng'
        };
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

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

      await this.logoutAllDevices(userId);

      logInfo('Change password successful', { userId });

      return {
        success: true,
        message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại trên tất cả thiết bị.'
      };
    } catch (error) {
      logError('Change password error', error, { userId });
      return {
        success: false,
        message: 'Lỗi server khi đổi mật khẩu'
      };
    }
  }

  /**
   * Forgot Password
   * ✅ FIX: Lưu timestamp với 'Z' để force UTC
   */
  static async forgotPassword(email) {
    try {
      logInfo('Forgot password attempt', { email });

      const { data: user, error } = await supabase
        .from('users')
        .select('id, email, username')
        .eq('email', email)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!user) {
        logInfo('Forgot password: User not found', { email });
        return {
          success: true,
          message: 'Nếu email tồn tại trong hệ thống, link reset password đã được gửi đến email của bạn'
        };
      }

      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour

      // ✅ FIX: Lưu với 'Z' để force UTC
      const { error: insertError } = await supabase
        .from('password_resets')
        .insert([{
          user_id: user.id,
          token: resetToken,
          expires_at: expiresAt.toISOString() // Có 'Z' ở cuối
        }]);

      if (insertError) {
        throw insertError;
      }

      logInfo('Password reset token generated', { userId: user.id });

      return {
        success: true,
        message: 'Link reset password đã được gửi đến email của bạn',
        data: process.env.NODE_ENV === 'development' ? { resetToken } : undefined
      };
    } catch (error) {
      logError('Forgot password error', error, { email });
      return {
        success: false,
        message: 'Lỗi server khi tạo reset token'
      };
    }
  }

  /**
   * Reset Password
   * ✅ FIX: Parse timestamp với 'Z' để force UTC
   */
  static async resetPassword(resetToken, newPassword) {
    try {
      logInfo('Reset password attempt');

      if (!resetToken) {
        return {
          success: false,
          message: 'Token không được để trống'
        };
      }

      const { data: resetData, error } = await supabase
        .from('password_resets')
        .select('*')
        .eq('token', resetToken)
        .eq('used', false)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!resetData) {
        logInfo('Reset password failed: Invalid or used token');
        return {
          success: false,
          message: 'Token không hợp lệ hoặc đã được sử dụng'
        };
      }

      // ✅ FIX: Force UTC timezone bằng cách thêm 'Z' nếu chưa có
      const expiresAtStr = resetData.expires_at.endsWith('Z') 
        ? resetData.expires_at 
        : resetData.expires_at + 'Z';
      
      const expiresAt = new Date(expiresAtStr);
      const now = new Date();

      if (expiresAt < now) {
        logInfo('Reset password failed: Token expired', {
          expiresAt: expiresAt.toISOString(),
          now: now.toISOString()
        });
        return {
          success: false,
          message: 'Token đã hết hạn. Vui lòng yêu cầu reset password lại.'
        };
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          password: hashedPassword,
          updated_at: new Date().toISOString()
        })
        .eq('id', resetData.user_id);

      if (updateError) {
        throw updateError;
      }

      // Mark token as used
      await supabase
        .from('password_resets')
        .update({ 
          used: true,
          used_at: new Date().toISOString()
        })
        .eq('id', resetData.id);

      // Revoke all refresh tokens
      await this.logoutAllDevices(resetData.user_id);

      logInfo('Reset password successful', { userId: resetData.user_id });

      return {
        success: true,
        message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập với mật khẩu mới.'
      };
    } catch (error) {
      logError('Reset password error', error);
      return {
        success: false,
        message: 'Lỗi server khi reset password'
      };
    }
  }

  // ============= Helper Methods =============

  static async generateTokens(user, ipAddress = null, userAgent = null) {
    try {
      const accessToken = jwt.sign(
        { 
          id: user.id, 
          email: user.email,
          username: user.username 
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || '15m' }
      );

      const refreshToken = crypto.randomBytes(64).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await supabase
        .from('refresh_tokens')
        .insert([{
          user_id: user.id,
          token: refreshToken,
          expires_at: expiresAt.toISOString(),
          ip_address: ipAddress,
          user_agent: userAgent
        }]);

      return { accessToken, refreshToken };
    } catch (error) {
      logError('Generate tokens error', error);
      throw error;
    }
  }

  static async logLoginHistory(userId, ipAddress, userAgent, success) {
    try {
      await supabase
        .from('login_history')
        .insert([{
          user_id: userId,
          ip_address: ipAddress,
          user_agent: userAgent,
          success
        }]);
    } catch (error) {
      logError('Log login history error', error);
    }
  }
}

module.exports = AuthService;