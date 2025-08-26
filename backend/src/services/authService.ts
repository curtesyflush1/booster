import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from '../models/User';
import { IUser, IUserRegistration, ILoginCredentials, IAuthToken } from '../types/database';
import { logger } from '../utils/logger';
import {
  ValidationError,
  UserNotFoundError,
  InvalidCredentialsError,
  AccountLockedError,
  TokenExpiredError,
  InvalidTokenError,
  UserExistsError
} from '../utils/authErrors';

export interface AuthServiceConfig {
  jwtSecret: string;
  jwtRefreshSecret: string;
  accessTokenExpiry: string;
  refreshTokenExpiry: string;
}

const AUTH_CONSTANTS = {
  RESET_TOKEN_EXPIRY_HOURS: 1,
  ACCOUNT_LOCK_DURATION_MINUTES: 30,
  MAX_FAILED_LOGIN_ATTEMPTS: 5,
  BCRYPT_SALT_ROUNDS: 12,
  TOKEN_BYTES_LENGTH: 32
} as const;

export class AuthService {
  private config: AuthServiceConfig;

  constructor(config?: Partial<AuthServiceConfig>) {
    this.config = {
      jwtSecret: config?.jwtSecret || process.env.JWT_SECRET || 'your-secret-key',
      jwtRefreshSecret: config?.jwtRefreshSecret || process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key',
      accessTokenExpiry: config?.accessTokenExpiry || '15m',
      refreshTokenExpiry: config?.refreshTokenExpiry || '7d'
    };

    if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
      logger.warn('JWT secrets not set in environment variables, using defaults (not secure for production)');
    }
  }

  /**
   * Register a new user
   */
  async register(userData: IUserRegistration): Promise<{ user: Omit<IUser, 'password_hash'>, tokens: IAuthToken }> {
    try {
      this.validateEmail(userData.email);
      this.validatePassword(userData.password);
      
      await this.validateUserDoesNotExist(userData.email);
      const user = await this.createUserWithVerification(userData);
      const tokens = await this.generateTokens(user.id);
      const userWithoutPassword = this.sanitizeUserResponse(user);

      logger.info('User registered successfully', { userId: user.id, email: user.email });

      return { user: userWithoutPassword, tokens };
    } catch (error) {
      logger.error('Registration failed', { error: error instanceof Error ? error.message : String(error), email: userData.email });
      throw error;
    }
  }

  /**
   * Validate that user doesn't already exist
   */
  private async validateUserDoesNotExist(email: string): Promise<void> {
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      throw new UserExistsError('User already exists with this email');
    }
  }

  /**
   * Create user and set verification token
   */
  private async createUserWithVerification(userData: IUserRegistration): Promise<IUser> {
    const user = await User.createUser(userData);
    const verificationToken = this.generateVerificationToken();
    await User.updateById<IUser>(user.id, {
      verification_token: verificationToken
    });
    return user;
  }

  /**
   * Remove sensitive data from user response
   */
  private sanitizeUserResponse(user: IUser): Omit<IUser, 'password_hash'> {
    const { password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Login user with email and password
   */
  async login(credentials: ILoginCredentials): Promise<{ user: Omit<IUser, 'password_hash'>, tokens: IAuthToken }> {
    try {
      this.validateEmail(credentials.email);
      
      const user = await this.validateLoginCredentials(credentials);
      await this.validateAccountNotLocked(user.id);
      await this.verifyPasswordAndHandleAttempts(credentials.password, user);
      
      const tokens = await this.generateTokens(user.id);
      const userWithoutPassword = this.sanitizeUserResponse(user);

      logger.info('User logged in successfully', { userId: user.id, email: user.email });

      return { user: userWithoutPassword, tokens };
    } catch (error) {
      logger.error('Login failed', { error: error instanceof Error ? error.message : String(error), email: credentials.email });
      throw error;
    }
  }

  /**
   * Validate login credentials and return user
   */
  private async validateLoginCredentials(credentials: ILoginCredentials): Promise<IUser> {
    const user = await User.findByEmail(credentials.email);
    if (!user) {
      throw new InvalidCredentialsError();
    }
    return user;
  }

  /**
   * Check if account is locked
   */
  private async validateAccountNotLocked(userId: string): Promise<void> {
    const isLocked = await User.isAccountLocked(userId);
    if (isLocked) {
      throw new AccountLockedError();
    }
  }

  /**
   * Verify password and handle login attempts
   */
  private async verifyPasswordAndHandleAttempts(password: string, user: IUser): Promise<void> {
    const isValidPassword = await User.verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      await User.handleFailedLogin(user.id);
      throw new InvalidCredentialsError();
    }
    await User.handleSuccessfulLogin(user.id);
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<IAuthToken> {
    try {
      this.validateToken(refreshToken);
      
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, this.config.jwtRefreshSecret) as { userId: string };
      
      // Check if user still exists
      const user = await User.findById<IUser>(decoded.userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user.id);

      logger.info('Token refreshed successfully', { userId: user.id });

      return tokens;
    } catch (error) {
      logger.error('Token refresh failed', { error: error instanceof Error ? error.message : String(error) });
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Validate access token and return user
   */
  async validateAccessToken(token: string): Promise<Omit<IUser, 'password_hash'>> {
    try {
      this.validateToken(token);
      
      // Verify token
      const decoded = jwt.verify(token, this.config.jwtSecret) as { userId: string };
      
      // Get user from database
      const user = await User.findById<IUser>(decoded.userId);
      if (!user) {
        throw new Error('User not found');
      }

      return this.sanitizeUserResponse(user);
    } catch (error) {
      logger.error('Token validation failed', { error: error instanceof Error ? error.message : String(error) });
      throw new Error('Invalid token');
    }
  }

  /**
   * Initiate password reset process
   */
  async initiatePasswordReset(email: string): Promise<string> {
    try {
      this.validateEmail(email);
      
      const user = await User.findByEmail(email);
      if (!user) {
        // Don't reveal if email exists or not
        logger.info('Password reset requested for non-existent email', { email });
        return 'If an account with this email exists, a password reset link has been sent.';
      }

      // Generate reset token
      const resetToken = this.generateResetToken();
      const expiresAt = new Date(Date.now() + AUTH_CONSTANTS.RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

      await User.setResetToken(user.id, resetToken, expiresAt);

      logger.info('Password reset initiated', { userId: user.id, email });

      return resetToken; // In real implementation, this would be sent via email
    } catch (error) {
      logger.error('Password reset initiation failed', { error: error instanceof Error ? error.message : String(error), email });
      throw error;
    }
  }

  /**
   * Reset password using reset token
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      this.validateToken(token);
      this.validatePassword(newPassword);
      
      // Find user by reset token
      const user = await User.findOneBy<IUser>({ reset_token: token });
      if (!user) {
        throw new Error('Invalid or expired reset token');
      }

      // Check if token is expired
      if (!user.reset_token_expires || new Date() > user.reset_token_expires) {
        throw new Error('Reset token has expired');
      }

      // Update password
      const success = await User.updatePassword(user.id, newPassword);
      if (!success) {
        throw new Error('Failed to update password');
      }

      logger.info('Password reset successfully', { userId: user.id });
    } catch (error) {
      logger.error('Password reset failed', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Verify email using verification token
   */
  async verifyEmail(token: string): Promise<void> {
    try {
      this.validateToken(token);
      
      const user = await User.findOneBy<IUser>({ verification_token: token });
      if (!user) {
        throw new Error('Invalid verification token');
      }

      const success = await User.verifyEmail(user.id);
      if (!success) {
        throw new Error('Failed to verify email');
      }

      logger.info('Email verified successfully', { userId: user.id });
    } catch (error) {
      logger.error('Email verification failed', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Change user password (requires current password)
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    try {
      this.validatePassword(newPassword);
      
      const user = await User.findById<IUser>(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const isValidPassword = await User.verifyPassword(currentPassword, user.password_hash);
      if (!isValidPassword) {
        throw new Error('Current password is incorrect');
      }

      // Update password
      const success = await User.updatePassword(userId, newPassword);
      if (!success) {
        throw new Error('Failed to update password');
      }

      logger.info('Password changed successfully', { userId });
    } catch (error) {
      logger.error('Password change failed', { error: error instanceof Error ? error.message : String(error), userId });
      throw error;
    }
  }

  /**
   * Generate JWT tokens for user
   */
  private async generateTokens(userId: string): Promise<IAuthToken> {
    const payload = { userId };

    const accessToken = jwt.sign(payload, this.config.jwtSecret, {
      expiresIn: this.config.accessTokenExpiry
    } as jwt.SignOptions);

    const refreshToken = jwt.sign(payload, this.config.jwtRefreshSecret, {
      expiresIn: this.config.refreshTokenExpiry
    } as jwt.SignOptions);

    // Calculate expiry time in seconds
    const expiresIn = this.parseExpiryToSeconds(this.config.accessTokenExpiry);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: expiresIn,
      token_type: 'Bearer'
    };
  }

  /**
   * Validate email format
   */
  private validateEmail(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError('Invalid email format');
    }
  }

  /**
   * Validate password strength
   */
  private validatePassword(password: string): void {
    if (password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long');
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      throw new ValidationError('Password must contain at least one uppercase letter, one lowercase letter, and one number');
    }
  }

  /**
   * Validate token format
   */
  private validateToken(token: string): void {
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      throw new InvalidTokenError();
    }
  }

  /**
   * Generate secure verification token
   */
  private generateVerificationToken(): string {
    return crypto.randomBytes(AUTH_CONSTANTS.TOKEN_BYTES_LENGTH).toString('hex');
  }

  /**
   * Generate secure reset token
   */
  private generateResetToken(): string {
    return crypto.randomBytes(AUTH_CONSTANTS.TOKEN_BYTES_LENGTH).toString('hex');
  }

  /**
   * Parse JWT expiry string to seconds
   */
  private parseExpiryToSeconds(expiry: string): number {
    const unit = expiry.slice(-1);
    const value = parseInt(expiry.slice(0, -1));

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 24 * 60 * 60;
      default: return 900; // 15 minutes default
    }
  }
}

// Export singleton instance
export const authService = new AuthService();