import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { IUser, IUserRegistration, ILoginCredentials, IAuthToken } from '../types/database';
import { IUserRepository, ILogger } from '../types/dependencies';
import { TokenBlacklistService } from './tokenBlacklistService';
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

export interface JWTPayload {
  userId: string;
  iat?: number;
  exp?: number;
  jti?: string;
}

export interface TokenMetadata {
  issuedAt: number;
  userAgent?: string;
  ipAddress?: string;
}

const AUTH_CONSTANTS = {
  RESET_TOKEN_EXPIRY_HOURS: 1,
  ACCOUNT_LOCK_DURATION_MINUTES: 30,
  MAX_FAILED_LOGIN_ATTEMPTS: 5,
  BCRYPT_SALT_ROUNDS: 12,
  TOKEN_BYTES_LENGTH: 32,
  DEFAULT_ACCESS_TOKEN_EXPIRY: '15m',
  DEFAULT_REFRESH_TOKEN_EXPIRY: '7d',
  TOKEN_REVOCATION_BATCH_SIZE: 100
} as const;

export class AuthService {
  private config: AuthServiceConfig;
  private userRepository: IUserRepository;
  private logger: ILogger;

  constructor(
    userRepository: IUserRepository,
    logger: ILogger,
    config?: Partial<AuthServiceConfig>
  ) {
    this.userRepository = userRepository;
    this.logger = logger;
    this.config = this.buildConfig(config);
    this.validateSecurityConfiguration();
  }

  private buildConfig(config?: Partial<AuthServiceConfig>): AuthServiceConfig {
    return {
      jwtSecret: config?.jwtSecret || process.env.JWT_SECRET || 'your-secret-key',
      jwtRefreshSecret: config?.jwtRefreshSecret || process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key',
      accessTokenExpiry: config?.accessTokenExpiry || '15m',
      refreshTokenExpiry: config?.refreshTokenExpiry || '7d'
    };
  }

  private validateSecurityConfiguration(): void {
    if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
      this.logger.warn('JWT secrets not set in environment variables, using defaults (not secure for production)');
    }

    if (process.env.NODE_ENV === 'production' && 
        (this.config.jwtSecret === 'your-secret-key' || this.config.jwtRefreshSecret === 'your-refresh-secret-key')) {
      throw new Error('Production environment requires secure JWT secrets');
    }
  }

  /**
   * Register a new user
   */
  async register(userData: IUserRegistration): Promise<{ user: Omit<IUser, 'password_hash'>, tokens: IAuthToken }> {
    try {
      await this.validateRegistrationData(userData);
      const { user, verificationToken } = await this.createUserWithVerification(userData);
      const tokens = await this.generateTokens(user.id);
      const userWithoutPassword = this.sanitizeUserResponse(user);

      // Best-effort verification email (non-blocking)
      try {
        const { EmailService } = await import('./notifications/emailService');
        await EmailService.sendVerificationEmail(userWithoutPassword, verificationToken);
      } catch (e) {
        this.logger.warn('Verification email send failed (non-blocking)', { error: e instanceof Error ? e.message : String(e) });
      }

      this.logger.info('User registered successfully', { userId: user.id, email: user.email });

      return { user: userWithoutPassword, tokens };
    } catch (error) {
      this.logger.error('Registration failed', { error: error instanceof Error ? error.message : String(error), email: userData.email });
      throw error;
    }
  }

  /**
   * Validate registration data comprehensively
   */
  private async validateRegistrationData(userData: IUserRegistration): Promise<void> {
    this.validateEmail(userData.email);
    this.validatePassword(userData.password);
    await this.validateUserDoesNotExist(userData.email);
  }

  /**
   * Validate that user doesn't already exist
   */
  private async validateUserDoesNotExist(email: string): Promise<void> {
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new UserExistsError('User already exists with this email');
    }
  }

  /**
   * Create user and set verification token
   */
  private async createUserWithVerification(userData: IUserRegistration): Promise<{ user: IUser; verificationToken: string }> {
    const user = await this.userRepository.createUser(userData);
    const verificationToken = this.generateVerificationToken();
    await this.userRepository.updateById<IUser>(user.id, {
      verification_token: verificationToken
    });
    return { user, verificationToken };
  }

  /** Resend email verification to an email address */
  async resendVerificationEmail(email: string): Promise<void> {
    this.validateEmail(email);
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      return; // do not reveal
    }
    if (user.email_verified) {
      return;
    }
    const token = this.generateVerificationToken();
    await this.userRepository.updateById<IUser>(user.id, { verification_token: token });
    try {
      const { EmailService } = await import('./notifications/emailService');
      await EmailService.sendVerificationEmail(this.sanitizeUserResponse(user), token);
    } catch (e) {
      this.logger.warn('Resend verification email failed', { error: e instanceof Error ? e.message : String(e) });
    }
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

      this.logger.info('User logged in successfully', { userId: user.id, email: user.email });

      return { user: userWithoutPassword, tokens };
    } catch (error) {
      this.logger.error('Login failed', { error: error instanceof Error ? error.message : String(error), email: credentials.email });
      throw error;
    }
  }

  /**
   * Validate login credentials and return user
   */
  private async validateLoginCredentials(credentials: ILoginCredentials): Promise<IUser> {
    const user = await this.userRepository.findByEmail(credentials.email);
    if (!user) {
      throw new InvalidCredentialsError();
    }
    return user;
  }

  /**
   * Check if account is locked
   */
  private async validateAccountNotLocked(userId: string): Promise<void> {
    const isLocked = await this.userRepository.isAccountLocked(userId);
    if (isLocked) {
      throw new AccountLockedError();
    }
  }

  /**
   * Verify password and handle login attempts
   */
  private async verifyPasswordAndHandleAttempts(password: string, user: IUser): Promise<void> {
    const isValidPassword = await this.userRepository.verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      await this.userRepository.handleFailedLogin(user.id);
      throw new InvalidCredentialsError();
    }
    await this.userRepository.handleSuccessfulLogin(user.id);
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<IAuthToken> {
    try {
      this.validateToken(refreshToken);
      
      // Check if refresh token is blacklisted
      const isBlacklisted = await TokenBlacklistService.isTokenRevoked(refreshToken);
      if (isBlacklisted) {
        throw new TokenExpiredError('Token has been revoked');
      }
      
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, this.config.jwtRefreshSecret) as { userId: string };
      
      // Check if user still exists
      const user = await this.userRepository.findById<IUser>(decoded.userId);
      if (!user) {
        throw new UserNotFoundError('User associated with token no longer exists');
      }

      // Blacklist the old refresh token
      await TokenBlacklistService.revokeToken(refreshToken);

      // Generate new tokens
      const tokens = await this.generateTokens(user.id);

      this.logger.info('Token refreshed successfully', { userId: user.id });

      return tokens;
    } catch (error) {
      this.logger.error('Token refresh failed', { error: error instanceof Error ? error.message : String(error) });
      if (error instanceof UserNotFoundError || error instanceof TokenExpiredError || error instanceof InvalidTokenError) {
        throw error;
      }
      throw new InvalidTokenError('Invalid refresh token');
    }
  }

  /**
   * Validate access token and return user
   */
  async validateAccessToken(token: string): Promise<Omit<IUser, 'password_hash'>> {
    try {
      const { user } = await this.validateAndDecodeToken(token, this.config.jwtSecret);
      return this.sanitizeUserResponse(user);
    } catch (error) {
      this.logger.error('Token validation failed', { error: error instanceof Error ? error.message : String(error) });
      if (error instanceof UserNotFoundError || error instanceof InvalidTokenError || error instanceof TokenExpiredError) {
        throw error;
      }
      throw new InvalidTokenError('Invalid token');
    }
  }

  /**
   * Common token validation and decoding logic
   */
  private async validateAndDecodeToken(token: string, secret: string): Promise<{ decoded: { sub: string }, user: IUser }> {
    this.validateToken(token);
    
    // Check if token is blacklisted
    const isBlacklisted = await TokenBlacklistService.isTokenRevoked(token);
    if (isBlacklisted) {
      throw new InvalidTokenError('Token has been revoked');
    }
    
    // Verify token
    const decoded = jwt.verify(token, secret) as { sub: string };
    
    // Get user from database
    const user = await this.userRepository.findById<IUser>(decoded.sub);
    if (!user) {
      throw new UserNotFoundError('User associated with token not found');
    }

    return { decoded, user };
  }

  /**
   * Initiate password reset process
   */
  async initiatePasswordReset(email: string): Promise<string> {
    try {
      this.validateEmail(email);
      
      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        // Don't reveal if email exists or not
        this.logger.info('Password reset requested for non-existent email', { email });
        return 'If an account with this email exists, a password reset link has been sent.';
      }

      // Generate reset token
      const resetToken = this.generateResetToken();
      const expiresAt = new Date(Date.now() + AUTH_CONSTANTS.RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

      await this.userRepository.setResetToken(user.id, resetToken, expiresAt);

      this.logger.info('Password reset initiated', { userId: user.id, email });

      return resetToken; // In real implementation, this would be sent via email
    } catch (error) {
      this.logger.error('Password reset initiation failed', { error: error instanceof Error ? error.message : String(error), email });
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
      const user = await this.userRepository.findOneBy<IUser>({ reset_token: token });
      if (!user) {
        throw new Error('Invalid or expired reset token');
      }

      // Check if token is expired
      if (!user.reset_token_expires || new Date() > user.reset_token_expires) {
        throw new Error('Reset token has expired');
      }

      // Update password
      const success = await this.userRepository.updatePassword(user.id, newPassword);
      if (!success) {
        throw new Error('Failed to update password');
      }

      // Blacklist all existing tokens for this user
      await TokenBlacklistService.revokeAllUserTokens(user.id, 'password_reset');

      this.logger.info('Password reset successfully', { userId: user.id });
    } catch (error) {
      this.logger.error('Password reset failed', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Verify email using verification token
   */
  async verifyEmail(token: string): Promise<void> {
    try {
      this.validateToken(token);
      
      const user = await this.userRepository.findOneBy<IUser>({ verification_token: token });
      if (!user) {
        throw new Error('Invalid verification token');
      }

      const success = await this.userRepository.verifyEmail(user.id);
      if (!success) {
        throw new Error('Failed to verify email');
      }

      this.logger.info('Email verified successfully', { userId: user.id });
    } catch (error) {
      this.logger.error('Email verification failed', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Change user password (requires current password)
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    try {
      this.validatePassword(newPassword);
      
      const user = await this.userRepository.findById<IUser>(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const isValidPassword = await this.userRepository.verifyPassword(currentPassword, user.password_hash);
      if (!isValidPassword) {
        throw new Error('Current password is incorrect');
      }

      // Update password
      const success = await this.userRepository.updatePassword(userId, newPassword);
      if (!success) {
        throw new Error('Failed to update password');
      }

      // Blacklist all existing tokens for this user
      await TokenBlacklistService.revokeAllUserTokens(userId, 'password_change');

      this.logger.info('Password changed successfully', { userId });
    } catch (error) {
      this.logger.error('Password change failed', { error: error instanceof Error ? error.message : String(error), userId });
      throw error;
    }
  }

  /**
   * Logout user by blacklisting their tokens
   */
  async logout(accessToken: string, refreshToken?: string): Promise<void> {
    try {
      // Blacklist the access token
      await TokenBlacklistService.revokeToken(accessToken);
      
      // Blacklist the refresh token if provided
      if (refreshToken) {
        await TokenBlacklistService.revokeToken(refreshToken);
      }

      // Extract user ID from access token for logging
      try {
        const decoded = jwt.decode(accessToken) as any;
        if (decoded?.userId) {
          this.logger.info('User logged out successfully', { userId: decoded.userId });
        }
      } catch (error) {
        // Ignore decode errors for logging
      }
    } catch (error) {
      this.logger.error('Logout failed', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Logout user from all devices by revoking all their tokens
   */
  async logoutAllDevices(userId: string): Promise<void> {
    try {
      await TokenBlacklistService.revokeAllUserTokens(userId, 'user_logout_all');
      this.logger.info('User logged out from all devices', { userId });
    } catch (error) {
      this.logger.error('Logout all devices failed', { 
        userId,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Generate JWT tokens for user
   */
  private async generateTokens(userId: string): Promise<IAuthToken> {
    const payload = { 
      sub: userId,  // Standard JWT subject field
      jti: crypto.randomBytes(16).toString('hex')  // JWT ID for blacklisting
    };

    const accessToken = jwt.sign(payload, this.config.jwtSecret, {
      expiresIn: this.config.accessTokenExpiry
    } as jwt.SignOptions);

    const refreshToken = jwt.sign(payload, this.config.jwtRefreshSecret, {
      expiresIn: this.config.refreshTokenExpiry
    } as jwt.SignOptions);

    // Note: Token tracking is handled internally by the TokenBlacklistService
    // when tokens are created and revoked

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

// Export factory function for creating AuthService instances
import { DependencyContainer } from '../container/DependencyContainer';

export const createAuthService = (dependencies?: Partial<{ userRepository: IUserRepository; logger: ILogger; config: Partial<AuthServiceConfig> }>) => {
  const container = DependencyContainer.getInstance();
  return new AuthService(
    dependencies?.userRepository || container.getUserRepository(),
    dependencies?.logger || container.getLogger(),
    dependencies?.config
  );
};

// Export singleton instance for backward compatibility
export const authService = createAuthService();
