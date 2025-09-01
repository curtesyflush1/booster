import request from 'supertest';
import app from '../../src/index';
import { User } from '../../src/models/User';
import { authService } from '../../src/services/authService';
import jwt from 'jsonwebtoken';
import { rateLimitStore } from '../../src/middleware/rateLimiter';
import { SubscriptionTier } from '../../src/types/subscription';

// Mock dependencies
jest.mock('../../src/models/User');
jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  loggerWithContext: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

const MockedUser = User as jest.Mocked<typeof User>;

describe('Authentication Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear rate limit store before each test
    rateLimitStore.destroy();
  });

  afterAll(() => {
    rateLimitStore.destroy();
  });

  describe('POST /api/auth/register', () => {
    const validRegistrationData = {
      email: 'test@example.com',
      password: 'password123',
      first_name: 'John',
      last_name: 'Doe'
    };

    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      password_hash: 'hashed-password',
      subscription_tier: SubscriptionTier.FREE,
      role: 'user' as const,
      first_name: 'John',
      last_name: 'Doe',
      email_verified: false,
      verification_token: null,
      reset_token: null,
      reset_token_expires: null,
      failed_login_attempts: 0,
      locked_until: null,
      last_login: null,
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
      zip_code: null,
      preferences: {},
      created_at: new Date(),
      updated_at: new Date()
    };

    it('should register a new user successfully', async () => {
      MockedUser.findByEmail.mockResolvedValue(null);
      MockedUser.createUser.mockResolvedValue(mockUser);
      MockedUser.updateById.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistrationData)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'Registration successful');
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('tokens');
      expect(response.body.user).not.toHaveProperty('password_hash');
      expect(response.body.tokens).toHaveProperty('access_token');
      expect(response.body.tokens).toHaveProperty('refresh_token');
    });

    it('should return 409 if user already exists', async () => {
      MockedUser.findByEmail.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistrationData)
        .expect(409);

      expect(response.body.error).toHaveProperty('code', 'USER_EXISTS');
      expect(response.body.error).toHaveProperty('message', 'A user with this email already exists');
    });

    it('should return 400 for invalid email', async () => {
      const invalidData = { ...validRegistrationData, email: 'invalid-email' };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(response.body.error.message).toContain('valid email address');
    });

    it('should return 400 for short password', async () => {
      const invalidData = { ...validRegistrationData, password: '123' };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(response.body.error.message).toContain('at least 8 characters');
    });

    it('should return 400 for missing required fields', async () => {
      const invalidData = { email: 'test@example.com' };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(response.body.error.message).toContain('Password is required');
    });
  });

  describe('POST /api/auth/login', () => {
    const validLoginData = {
      email: 'test@example.com',
      password: 'password123'
    };

    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      password_hash: 'hashed-password',
      subscription_tier: SubscriptionTier.FREE,
      role: 'user' as const,
      first_name: 'John',
      last_name: 'Doe',
      email_verified: true,
      verification_token: null,
      reset_token: null,
      reset_token_expires: null,
      failed_login_attempts: 0,
      locked_until: null,
      last_login: null,
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
      zip_code: null,
      preferences: {},
      created_at: new Date(),
      updated_at: new Date()
    };

    it('should login user successfully', async () => {
      MockedUser.findByEmail.mockResolvedValue(mockUser);
      MockedUser.isAccountLocked.mockResolvedValue(false);
      MockedUser.verifyPassword.mockResolvedValue(true);
      MockedUser.handleSuccessfulLogin.mockResolvedValue();

      const response = await request(app)
        .post('/api/auth/login')
        .send(validLoginData)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Login successful');
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('tokens');
      expect(response.body.user).not.toHaveProperty('password_hash');
    });

    it('should return 401 for invalid credentials', async () => {
      MockedUser.findByEmail.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send(validLoginData)
        .expect(401);

      expect(response.body.error).toHaveProperty('code', 'INVALID_CREDENTIALS');
      expect(response.body.error).toHaveProperty('message', 'Invalid email or password');
    });

    it('should return 401 for wrong password', async () => {
      MockedUser.findByEmail.mockResolvedValue(mockUser);
      MockedUser.isAccountLocked.mockResolvedValue(false);
      MockedUser.verifyPassword.mockResolvedValue(false);
      MockedUser.handleFailedLogin.mockResolvedValue();

      const response = await request(app)
        .post('/api/auth/login')
        .send(validLoginData)
        .expect(401);

      expect(response.body.error).toHaveProperty('code', 'INVALID_CREDENTIALS');
      expect(MockedUser.handleFailedLogin).toHaveBeenCalledWith(mockUser.id);
    });

    it('should return 423 for locked account', async () => {
      MockedUser.findByEmail.mockResolvedValue(mockUser);
      MockedUser.isAccountLocked.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/login')
        .send(validLoginData)
        .expect(423);

      expect(response.body.error).toHaveProperty('code', 'ACCOUNT_LOCKED');
      expect(response.body.error.message).toContain('temporarily locked');
    });

    it('should return 400 for invalid email format', async () => {
      const invalidData = { ...validLoginData, email: 'invalid-email' };

      const response = await request(app)
        .post('/api/auth/login')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh token successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password_hash: 'hashed-password',
        subscription_tier: 'free' as const,
        first_name: 'John',
        last_name: 'Doe',
        email_verified: true,
        verification_token: null,
        reset_token: null,
        reset_token_expires: null,
        failed_login_attempts: 0,
        locked_until: null,
        last_login: null,
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
        zip_code: null,
        preferences: {},
        created_at: new Date(),
        updated_at: new Date()
      };

      MockedUser.findById.mockResolvedValue(mockUser);

      // Mock the refreshToken service method instead of invalid assignment
      const refreshSpy = jest
        .spyOn(authService, 'refreshToken')
        .mockResolvedValue({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 900,
          token_type: 'Bearer'
        } as any);

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refresh_token: 'valid-refresh-token' })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Token refreshed successfully');
      expect(response.body).toHaveProperty('tokens');
      refreshSpy.mockRestore();
    });

    it('should return 401 for invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refresh_token: 'invalid-token' })
        .expect(401);

      expect(response.body.error).toHaveProperty('code', 'INVALID_REFRESH_TOKEN');
    });

    it('should return 400 for missing refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('GET /api/auth/profile', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      password_hash: 'hashed-password',
      subscription_tier: 'free' as const,
      first_name: 'John',
      last_name: 'Doe',
      email_verified: true,
      verification_token: null,
      reset_token: null,
      reset_token_expires: null,
      failed_login_attempts: 0,
      locked_until: null,
      last_login: null,
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
      zip_code: null,
      preferences: {},
      created_at: new Date(),
      updated_at: new Date()
    };

    it('should get user profile successfully', async () => {
      MockedUser.findById.mockResolvedValue(mockUser);

      // Create a valid access token signed with configured or default secret
      const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
      const accessToken = jwt.sign({ sub: mockUser.id, jti: 'test-jti' }, jwtSecret, { expiresIn: '15m' });

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user).not.toHaveProperty('password_hash');
      expect(response.body.user).toHaveProperty('id', 'user-123');
    });

    it('should return 401 without authentication token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .expect(401);

      expect(response.body.error).toHaveProperty('code', 'MISSING_TOKEN');
    });

    it('should return 401 for invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.error).toHaveProperty('code', 'INVALID_TOKEN');
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should initiate password reset successfully', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('password reset link has been sent');
    });

    it('should return same message for non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('password reset link has been sent');
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'invalid-email' })
        .expect(400);

      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/reset-password', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      password_hash: 'hashed-password',
      subscription_tier: 'free' as const,
      first_name: 'John',
      last_name: 'Doe',
      email_verified: true,
      verification_token: null,
      reset_token: 'valid-reset-token',
      reset_token_expires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      failed_login_attempts: 0,
      locked_until: null,
      last_login: null,
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
      zip_code: null,
      preferences: {},
      created_at: new Date(),
      updated_at: new Date()
    };

    it('should reset password successfully', async () => {
      MockedUser.findOneBy.mockResolvedValue(mockUser);
      MockedUser.updatePassword.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'valid-reset-token',
          password: 'newpassword123'
        })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Password reset successful');
    });

    it('should return 400 for invalid token', async () => {
      MockedUser.findOneBy.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'invalid-token',
          password: 'newpassword123'
        })
        .expect(400);

      expect(response.body.error).toHaveProperty('code', 'INVALID_RESET_TOKEN');
    });

    it('should return 400 for short password', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'valid-reset-token',
          password: '123'
        })
        .expect(400);

      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(response.body.error.message).toContain('at least 8 characters');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        subscription_tier: 'free' as const,
        email_verified: true
      };

      MockedUser.findById.mockResolvedValue(mockUser as any);

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer valid-access-token')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Logout successful');
    });

    it('should return 401 without authentication token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401);

      expect(response.body.error).toHaveProperty('code', 'MISSING_TOKEN');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limiting on login endpoint', async () => {
      MockedUser.findByEmail.mockResolvedValue(null);

      // Make multiple requests to exceed rate limit
      const promises = Array(6).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send({ email: 'test@example.com', password: 'password123' })
      );

      const responses = await Promise.all(promises);

      // First 5 should be 401 (invalid credentials), 6th should be 429 (rate limited)
      expect(responses.slice(0, 5).every(res => res.status === 401)).toBe(true);
      expect(responses[5].status).toBe(429);
      expect(responses[5].body.error).toHaveProperty('code', 'RATE_LIMIT_EXCEEDED');
    });

    it('should enforce rate limiting on registration endpoint', async () => {
      MockedUser.findByEmail.mockResolvedValue(null);
      MockedUser.createUser.mockResolvedValue({} as any);
      MockedUser.updateById.mockResolvedValue({} as any);

      // Make multiple requests to exceed rate limit
      const promises = Array(4).fill(null).map((_, index) =>
        request(app)
          .post('/api/auth/register')
          .send({
            email: `test${index}@example.com`,
            password: 'password123'
          })
      );

      const responses = await Promise.all(promises);

      // First 3 should succeed, 4th should be rate limited
      expect(responses.slice(0, 3).every(res => res.status === 201)).toBe(true);
      expect(responses[3].status).toBe(429);
      expect(responses[3].body.error).toHaveProperty('code', 'RATE_LIMIT_EXCEEDED');
    });
  });
});
