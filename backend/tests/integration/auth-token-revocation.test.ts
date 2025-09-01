import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../src/index';
import { SubscriptionTier } from '../../src/types/subscription';
import { User } from '../../src/models/User';
import { redisService } from '../../src/services/redisService';
import { tokenBlacklistService } from '../../src/services/tokenBlacklistService';

// Mock Redis service for testing
jest.mock('../../src/services/redisService');
const mockRedisService = redisService as jest.Mocked<typeof redisService>;

// Mock User model
jest.mock('../../src/models/User');
const mockUser = User as jest.Mocked<typeof User>;

// Mock logger to prevent side effects during app import
jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  loggerWithContext: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

describe('Auth Token Revocation Integration Tests', () => {
  const testUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    password_hash: '$2b$12$hashedpassword',
    subscription_tier: SubscriptionTier.FREE,
    role: 'user' as const,
    email_verified: true,
    admin_permissions: [],
    failed_login_attempts: 0,
    shipping_addresses: [],
    payment_methods: [],
    retailer_credentials: {},
    notification_settings: { web_push: true, email: true, sms: false, discord: false },
    quiet_hours: { enabled: false, start_time: '22:00', end_time: '08:00', timezone: 'UTC', days: [] },
    timezone: 'UTC',
    preferences: {},
    created_at: new Date(),
    updated_at: new Date()
  };

  const jwtSecret = process.env.JWT_SECRET || 'test-secret';
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup Redis mocks
    mockRedisService.connect.mockResolvedValue();
    mockRedisService.disconnect.mockResolvedValue();
    mockRedisService.isReady.mockReturnValue(true);
    mockRedisService.exists.mockResolvedValue(false);
    mockRedisService.set.mockResolvedValue();
    mockRedisService.sadd.mockResolvedValue(1);
    mockRedisService.expire.mockResolvedValue(true);
    mockRedisService.smembers.mockResolvedValue([]);
    mockRedisService.del.mockResolvedValue(1);
  });

  describe('POST /api/auth/logout', () => {
    it('should successfully logout and blacklist tokens', async () => {
      // Mock user lookup
      mockUser.findById.mockResolvedValue(testUser);
      
      // Create a valid access token
      const accessToken = jwt.sign({ userId: testUser.id }, jwtSecret, { expiresIn: '15m' });
      const refreshToken = jwt.sign({ userId: testUser.id }, jwtRefreshSecret, { expiresIn: '7d' });

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refresh_token: refreshToken })
        .expect(200);

      expect(response.body.message).toBe('Logout successful');
      
      // Verify tokens were blacklisted
      expect(mockRedisService.set).toHaveBeenCalledTimes(2); // Both access and refresh tokens
    });

    it('should fail logout without access token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .send({ refresh_token: 'some-refresh-token' })
        .expect(400);

      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });

    it('should logout with only access token', async () => {
      mockUser.findById.mockResolvedValue(testUser);
      
      const accessToken = jwt.sign({ userId: testUser.id }, jwtSecret, { expiresIn: '15m' });

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(200);

      expect(response.body.message).toBe('Logout successful');
      expect(mockRedisService.set).toHaveBeenCalledTimes(1); // Only access token
    });
  });

  describe('POST /api/auth/logout-all', () => {
    it('should logout user from all devices', async () => {
      mockUser.findById.mockResolvedValue(testUser);
      
      const accessToken = jwt.sign({ userId: testUser.id }, jwtSecret, { expiresIn: '15m' });
      
      // Mock existing tokens for the user
      const existingTokens = [
        jwt.sign({ userId: testUser.id }, jwtSecret, { expiresIn: '15m' }),
        jwt.sign({ userId: testUser.id }, jwtRefreshSecret, { expiresIn: '7d' })
      ];
      mockRedisService.smembers.mockResolvedValue(existingTokens);

      const response = await request(app)
        .post('/api/auth/logout-all')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.message).toBe('Logged out from all devices successfully');
      
      // Verify all tokens were blacklisted
      expect(mockRedisService.set).toHaveBeenCalledTimes(existingTokens.length);
      expect(mockRedisService.del).toHaveBeenCalledWith(`user:tokens:${testUser.id}`);
    });

    it('should require authentication for logout all', async () => {
      const response = await request(app)
        .post('/api/auth/logout-all')
        .expect(401);

      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('POST /api/auth/change-password', () => {
    it('should blacklist all tokens after password change', async () => {
      mockUser.findById.mockResolvedValue(testUser);
      mockUser.verifyPassword.mockResolvedValue(true);
      mockUser.updatePassword.mockResolvedValue(true);
      
      const accessToken = jwt.sign({ userId: testUser.id }, jwtSecret, { expiresIn: '15m' });
      
      // Mock existing tokens for the user
      const existingTokens = [
        jwt.sign({ userId: testUser.id }, jwtSecret, { expiresIn: '15m' }),
        jwt.sign({ userId: testUser.id }, jwtRefreshSecret, { expiresIn: '7d' })
      ];
      mockRedisService.smembers.mockResolvedValue(existingTokens);

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          current_password: 'currentPassword123',
          new_password: 'newPassword123'
        })
        .expect(200);

      expect(response.body.message).toBe('Password changed successfully');
      
      // Verify all existing tokens were blacklisted
      expect(mockRedisService.set).toHaveBeenCalledTimes(existingTokens.length);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should blacklist old refresh token when refreshing', async () => {
      mockUser.findById.mockResolvedValue(testUser);
      
      const refreshToken = jwt.sign({ userId: testUser.id }, jwtRefreshSecret, { expiresIn: '7d' });

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refresh_token: refreshToken })
        .expect(200);

      expect(response.body.message).toBe('Token refreshed successfully');
      expect(response.body.tokens).toBeDefined();
      expect(response.body.tokens.access_token).toBeDefined();
      expect(response.body.tokens.refresh_token).toBeDefined();
      
      // Verify old refresh token was blacklisted
      expect(mockRedisService.set).toHaveBeenCalledWith(
        expect.stringContaining('blacklist:token:'),
        expect.stringContaining('token_refresh'),
        expect.any(Number)
      );
      
      // Verify new tokens are tracked
      expect(mockRedisService.sadd).toHaveBeenCalledTimes(2); // New access and refresh tokens
    });

    it('should reject blacklisted refresh tokens', async () => {
      const refreshToken = jwt.sign({ userId: testUser.id }, jwtRefreshSecret, { expiresIn: '7d' });
      
      // Mock token as blacklisted
      mockRedisService.exists.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refresh_token: refreshToken })
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_REFRESH_TOKEN');
    });
  });

  describe('Authentication middleware with blacklisted tokens', () => {
    it('should reject blacklisted access tokens', async () => {
      const accessToken = jwt.sign({ userId: testUser.id }, jwtSecret, { expiresIn: '15m' });
      
      // Mock token as blacklisted
      mockRedisService.exists.mockResolvedValue(true);

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should accept non-blacklisted tokens', async () => {
      mockUser.findById.mockResolvedValue(testUser);
      
      const accessToken = jwt.sign({ userId: testUser.id }, jwtSecret, { expiresIn: '15m' });
      
      // Mock token as not blacklisted
      mockRedisService.exists.mockResolvedValue(false);

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.user).toBeDefined();
      expect(response.body.user.id).toBe(testUser.id);
    });

    it('should fail secure when Redis is unavailable', async () => {
      const accessToken = jwt.sign({ userId: testUser.id }, jwtSecret, { expiresIn: '15m' });
      
      // Mock Redis error
      mockRedisService.exists.mockRejectedValue(new Error('Redis unavailable'));

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('Token tracking', () => {
    it('should track tokens during login', async () => {
      mockUser.findByEmail.mockResolvedValue(testUser);
      mockUser.isAccountLocked.mockResolvedValue(false);
      mockUser.verifyPassword.mockResolvedValue(true);
      mockUser.handleSuccessfulLogin.mockResolvedValue();

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'password123'
        })
        .expect(200);

      expect(response.body.tokens).toBeDefined();
      
      // Verify tokens are tracked for the user
      expect(mockRedisService.sadd).toHaveBeenCalledTimes(2); // Access and refresh tokens
      expect(mockRedisService.sadd).toHaveBeenCalledWith(
        `user:tokens:${testUser.id}`,
        expect.any(String)
      );
    });

    it('should track tokens during registration', async () => {
      mockUser.findByEmail.mockResolvedValue(null); // User doesn't exist
      mockUser.createUser.mockResolvedValue(testUser);
      mockUser.updateById.mockResolvedValue(testUser);

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'password123'
        })
        .expect(201);

      expect(response.body.tokens).toBeDefined();
      
      // Verify tokens are tracked for the new user
      expect(mockRedisService.sadd).toHaveBeenCalledTimes(2); // Access and refresh tokens
    });
  });
});
