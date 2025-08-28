import { AuthService } from '../../src/services/authService';
import { User } from '../../src/models/User';
import jwt from 'jsonwebtoken';
import { IUser, IUserRegistration, ILoginCredentials } from '../../src/types/database';
import { SubscriptionTier } from '../../src/types/subscription';

// Mock dependencies
jest.mock('../../src/models/User');
jest.mock('jsonwebtoken');
jest.mock('../../src/utils/logger');

const MockedUser = User as jest.Mocked<typeof User>;
const mockedJwt = jwt as jest.Mocked<typeof jwt>;

describe('AuthService', () => {
  let authService: AuthService;
  const mockConfig = {
    jwtSecret: 'test-secret',
    jwtRefreshSecret: 'test-refresh-secret',
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '7d'
  };

  beforeEach(() => {
    authService = new AuthService(mockConfig);
    jest.clearAllMocks();
  });

  const createMockUser = (overrides: Partial<IUser> = {}): IUser => ({
    id: 'user-123',
    email: 'test@example.com',
    password_hash: 'hashed-password',
    subscription_tier: SubscriptionTier.FREE,
    role: 'user',
    first_name: 'John',
    last_name: 'Doe',
    email_verified: false,
    failed_login_attempts: 0,
    admin_permissions: [],
    shipping_addresses: [],
    payment_methods: [],
    retailer_credentials: {},
    notification_settings: {
      web_push: true,
      email: true,
      sms: false,
      discord: false
    },
    quiet_hours: {
      enabled: false,
      start_time: '22:00',
      end_time: '08:00',
      timezone: 'UTC',
      days: []
    },
    timezone: 'UTC',
    preferences: {},
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides
  });

  describe('register', () => {
    const mockUserData: IUserRegistration = {
      email: 'test@example.com',
      password: 'Password123',
      first_name: 'John',
      last_name: 'Doe'
    };

    it('should register a new user successfully', async () => {
      const mockUser = createMockUser();
      MockedUser.findByEmail.mockResolvedValue(null);
      MockedUser.createUser.mockResolvedValue(mockUser);
      MockedUser.updateById.mockResolvedValue(mockUser);
      (mockedJwt.sign as jest.Mock).mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');

      const result = await authService.register(mockUserData);

      expect(MockedUser.findByEmail).toHaveBeenCalledWith(mockUserData.email);
      expect(MockedUser.createUser).toHaveBeenCalledWith(mockUserData);
      expect(MockedUser.updateById).toHaveBeenCalledWith(mockUser.id, {
        verification_token: expect.any(String)
      });
      expect(result.user).not.toHaveProperty('password_hash');
      expect(result.tokens).toEqual({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 900,
        token_type: 'Bearer'
      });
    });

    it('should throw error if user already exists', async () => {
      const mockUser = createMockUser();
      MockedUser.findByEmail.mockResolvedValue(mockUser);

      await expect(authService.register(mockUserData)).rejects.toThrow('User already exists with this email');
      expect(MockedUser.createUser).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const mockCredentials: ILoginCredentials = {
      email: 'test@example.com',
      password: 'password123'
    };

    it('should login user successfully', async () => {
      const mockUser = createMockUser({ email_verified: true });
      MockedUser.findByEmail.mockResolvedValue(mockUser);
      MockedUser.isAccountLocked.mockResolvedValue(false);
      MockedUser.verifyPassword.mockResolvedValue(true);
      MockedUser.handleSuccessfulLogin.mockResolvedValue();
      (mockedJwt.sign as jest.Mock).mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');

      const result = await authService.login(mockCredentials);

      expect(MockedUser.findByEmail).toHaveBeenCalledWith(mockCredentials.email);
      expect(MockedUser.isAccountLocked).toHaveBeenCalledWith(mockUser.id);
      expect(MockedUser.verifyPassword).toHaveBeenCalledWith(mockCredentials.password, mockUser.password_hash);
      expect(MockedUser.handleSuccessfulLogin).toHaveBeenCalledWith(mockUser.id);
      expect(result.user).not.toHaveProperty('password_hash');
      expect(result.tokens).toBeDefined();
    });

    it('should throw error for non-existent user', async () => {
      MockedUser.findByEmail.mockResolvedValue(null);

      await expect(authService.login(mockCredentials)).rejects.toThrow('Invalid credentials');
      expect(MockedUser.verifyPassword).not.toHaveBeenCalled();
    });

    it('should throw error for locked account', async () => {
      const mockUser = createMockUser();
      MockedUser.findByEmail.mockResolvedValue(mockUser);
      MockedUser.isAccountLocked.mockResolvedValue(true);

      await expect(authService.login(mockCredentials)).rejects.toThrow('Account is temporarily locked');
      expect(MockedUser.verifyPassword).not.toHaveBeenCalled();
    });

    it('should handle failed login attempt', async () => {
      const mockUser = createMockUser();
      MockedUser.findByEmail.mockResolvedValue(mockUser);
      MockedUser.isAccountLocked.mockResolvedValue(false);
      MockedUser.verifyPassword.mockResolvedValue(false);
      MockedUser.handleFailedLogin.mockResolvedValue();

      await expect(authService.login(mockCredentials)).rejects.toThrow('Invalid credentials');
      expect(MockedUser.handleFailedLogin).toHaveBeenCalledWith(mockUser.id);
      expect(MockedUser.handleSuccessfulLogin).not.toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    const mockRefreshToken = 'valid-refresh-token';

    it('should refresh token successfully', async () => {
      const mockUser = createMockUser({ email_verified: true });
      (mockedJwt.verify as jest.Mock).mockReturnValue({ userId: 'user-123' });
      MockedUser.findById.mockResolvedValue(mockUser);
      (mockedJwt.sign as jest.Mock).mockReturnValueOnce('new-access-token').mockReturnValueOnce('new-refresh-token');

      const result = await authService.refreshToken(mockRefreshToken);

      expect(mockedJwt.verify).toHaveBeenCalledWith(mockRefreshToken, mockConfig.jwtRefreshSecret);
      expect(MockedUser.findById).toHaveBeenCalledWith('user-123');
      expect(result).toEqual({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 900,
        token_type: 'Bearer'
      });
    });

    it('should throw error for invalid refresh token', async () => {
      (mockedJwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(authService.refreshToken(mockRefreshToken)).rejects.toThrow('Invalid refresh token');
    });

    it('should throw error if user not found', async () => {
      (mockedJwt.verify as jest.Mock).mockReturnValue({ userId: 'user-123' });
      MockedUser.findById.mockResolvedValue(null);

      await expect(authService.refreshToken(mockRefreshToken)).rejects.toThrow('Invalid refresh token');
    });
  });

  describe('validateAccessToken', () => {
    const mockAccessToken = 'valid-access-token';

    it('should validate token successfully', async () => {
      const mockUser = createMockUser({ email_verified: true });
      (mockedJwt.verify as jest.Mock).mockReturnValue({ userId: 'user-123' });
      MockedUser.findById.mockResolvedValue(mockUser);

      const result = await authService.validateAccessToken(mockAccessToken);

      expect(mockedJwt.verify).toHaveBeenCalledWith(mockAccessToken, mockConfig.jwtSecret);
      expect(MockedUser.findById).toHaveBeenCalledWith('user-123');
      expect(result).not.toHaveProperty('password_hash');
      expect(result.id).toBe('user-123');
    });

    it('should throw error for invalid token', async () => {
      (mockedJwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(authService.validateAccessToken(mockAccessToken)).rejects.toThrow('Invalid token');
    });

    it('should throw error if user not found', async () => {
      (mockedJwt.verify as jest.Mock).mockReturnValue({ userId: 'user-123' });
      MockedUser.findById.mockResolvedValue(null);

      await expect(authService.validateAccessToken(mockAccessToken)).rejects.toThrow('Invalid token');
    });
  });

  describe('initiatePasswordReset', () => {
    const mockEmail = 'test@example.com';

    it('should initiate password reset for existing user', async () => {
      const mockUser = createMockUser({ email_verified: true });
      MockedUser.findByEmail.mockResolvedValue(mockUser);
      MockedUser.setResetToken.mockResolvedValue(true);

      const result = await authService.initiatePasswordReset(mockEmail);

      expect(MockedUser.findByEmail).toHaveBeenCalledWith(mockEmail);
      expect(MockedUser.setResetToken).toHaveBeenCalledWith(
        mockUser.id,
        expect.any(String),
        expect.any(Date)
      );
      expect(typeof result).toBe('string');
    });

    it('should return success message for non-existent user', async () => {
      MockedUser.findByEmail.mockResolvedValue(null);

      const result = await authService.initiatePasswordReset(mockEmail);

      expect(result).toBe('If an account with this email exists, a password reset link has been sent.');
      expect(MockedUser.setResetToken).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    const mockToken = 'valid-reset-token';
    const mockPassword = 'NewPassword123';

    it('should reset password successfully', async () => {
      const mockUser = createMockUser({
        reset_token: mockToken,
        reset_token_expires: new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now
      });
      MockedUser.findOneBy.mockResolvedValue(mockUser);
      MockedUser.updatePassword.mockResolvedValue(true);

      await authService.resetPassword(mockToken, mockPassword);

      expect(MockedUser.findOneBy).toHaveBeenCalledWith({ reset_token: mockToken });
      expect(MockedUser.updatePassword).toHaveBeenCalledWith(mockUser.id, mockPassword);
    });

    it('should throw error for invalid token', async () => {
      MockedUser.findOneBy.mockResolvedValue(null);

      await expect(authService.resetPassword(mockToken, mockPassword)).rejects.toThrow('Invalid or expired reset token');
    });

    it('should throw error for expired token', async () => {
      const expiredUser = createMockUser({
        reset_token: mockToken,
        reset_token_expires: new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago
      });
      MockedUser.findOneBy.mockResolvedValue(expiredUser);

      await expect(authService.resetPassword(mockToken, mockPassword)).rejects.toThrow('Reset token has expired');
    });
  });

  describe('changePassword', () => {
    const mockUserId = 'user-123';
    const mockCurrentPassword = 'CurrentPassword123';
    const mockNewPassword = 'NewPassword123';

    it('should change password successfully', async () => {
      const mockUser = createMockUser();
      MockedUser.findById.mockResolvedValue(mockUser);
      MockedUser.verifyPassword.mockResolvedValue(true);
      MockedUser.updatePassword.mockResolvedValue(true);

      await authService.changePassword(mockUserId, mockCurrentPassword, mockNewPassword);

      expect(MockedUser.findById).toHaveBeenCalledWith(mockUserId);
      expect(MockedUser.verifyPassword).toHaveBeenCalledWith(mockCurrentPassword, mockUser.password_hash);
      expect(MockedUser.updatePassword).toHaveBeenCalledWith(mockUserId, mockNewPassword);
    });

    it('should throw error for non-existent user', async () => {
      MockedUser.findById.mockResolvedValue(null);

      await expect(authService.changePassword(mockUserId, mockCurrentPassword, mockNewPassword))
        .rejects.toThrow('User not found');
    });

    it('should throw error for incorrect current password', async () => {
      const mockUser = createMockUser();
      MockedUser.findById.mockResolvedValue(mockUser);
      MockedUser.verifyPassword.mockResolvedValue(false);

      await expect(authService.changePassword(mockUserId, mockCurrentPassword, mockNewPassword))
        .rejects.toThrow('Current password is incorrect');
    });
  });
});