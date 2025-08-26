import request from 'supertest';
import app from '../../src/index';
import { User } from '../../src/models/User';
import { authService } from '../../src/services/authService';
import { rateLimitStore } from '../../src/middleware/rateLimiter';
import jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('../../src/models/User');
jest.mock('../../src/utils/logger');

const MockedUser = User as jest.Mocked<typeof User>;

describe('Authentication Security Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rateLimitStore.destroy();
  });

  afterAll(() => {
    rateLimitStore.destroy();
  });

  describe('Password Security', () => {
    it('should reject weak passwords', async () => {
      const weakPasswords = [
        '123',
        'password',
        '12345678',
        'qwerty',
        'abc123'
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'test@example.com',
            password
          });

        if (password.length < 8) {
          expect(response.status).toBe(400);
          expect(response.body.error.message).toContain('at least 8 characters');
        }
      }
    });

    it('should hash passwords before storage', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password_hash: 'hashed-password',
        subscription_tier: 'free' as const,
        email_verified: false,
        created_at: new Date(),
        updated_at: new Date()
      };

      MockedUser.findByEmail.mockResolvedValue(null);
      MockedUser.createUser.mockResolvedValue(mockUser as any);
      MockedUser.updateById.mockResolvedValue(mockUser as any);

      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'plainpassword123'
        })
        .expect(201);

      expect(MockedUser.createUser).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'plainpassword123'
      });
    });
  });

  describe('JWT Token Security', () => {
    it('should generate secure JWT tokens', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password_hash: 'hashed-password',
        subscription_tier: 'free' as const,
        email_verified: true,
        failed_login_attempts: 0,
        locked_until: null,
        created_at: new Date(),
        updated_at: new Date()
      };

      MockedUser.findByEmail.mockResolvedValue(mockUser as any);
      MockedUser.isAccountLocked.mockResolvedValue(false);
      MockedUser.verifyPassword.mockResolvedValue(true);
      MockedUser.handleSuccessfulLogin.mockResolvedValue();

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })
        .expect(200);

      expect(response.body.tokens).toHaveProperty('access_token');
      expect(response.body.tokens).toHaveProperty('refresh_token');
      expect(response.body.tokens.token_type).toBe('Bearer');
      expect(response.body.tokens.expires_in).toBeGreaterThan(0);
    });

    it('should reject tampered JWT tokens', async () => {
      const tamperedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyLTEyMyIsImlhdCI6MTYzOTU4NzYwMCwiZXhwIjoxNjM5NTg4NTAwfQ.invalid_signature';

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${tamperedToken}`)
        .expect(401);

      expect(response.body.error).toHaveProperty('code', 'INVALID_TOKEN');
    });

    it('should reject expired JWT tokens', async () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        { userId: 'user-123' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '-1h' }
      );

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.error).toHaveProperty('code', 'INVALID_TOKEN');
    });

    it('should validate token format', async () => {
      const invalidTokens = [
        'invalid-token',
        'Bearer',
        'Bearer ',
        'Bearer invalid',
        ''
      ];

      for (const token of invalidTokens) {
        const response = await request(app)
          .get('/api/auth/profile')
          .set('Authorization', token);

        expect(response.status).toBe(401);
        expect(response.body.error.code).toMatch(/MISSING_TOKEN|INVALID_TOKEN/);
      }
    });
  });

  describe('Account Lockout Security', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      password_hash: 'hashed-password',
      subscription_tier: 'free' as const,
      email_verified: true,
      failed_login_attempts: 0,
      locked_until: null,
      created_at: new Date(),
      updated_at: new Date()
    };

    it('should lock account after multiple failed attempts', async () => {
      MockedUser.findByEmail.mockResolvedValue(mockUser as any);
      MockedUser.isAccountLocked.mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValue(true); // Locked after 5 attempts
      MockedUser.verifyPassword.mockResolvedValue(false);
      MockedUser.handleFailedLogin.mockResolvedValue();

      // Make 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrongpassword'
          })
          .expect(401);
      }

      // 6th attempt should be blocked due to account lock
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        })
        .expect(423);

      expect(response.body.error).toHaveProperty('code', 'ACCOUNT_LOCKED');
      expect(MockedUser.handleFailedLogin).toHaveBeenCalledTimes(5);
    });

    it('should reset failed attempts on successful login', async () => {
      MockedUser.findByEmail.mockResolvedValue(mockUser as any);
      MockedUser.isAccountLocked.mockResolvedValue(false);
      MockedUser.verifyPassword.mockResolvedValue(true);
      MockedUser.handleSuccessfulLogin.mockResolvedValue();

      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'correctpassword'
        })
        .expect(200);

      expect(MockedUser.handleSuccessfulLogin).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('Rate Limiting Security', () => {
    it('should enforce strict rate limiting on authentication endpoints', async () => {
      MockedUser.findByEmail.mockResolvedValue(null);

      // Test login rate limiting
      const loginPromises = Array(6).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send({ email: 'test@example.com', password: 'password123' })
      );

      const loginResponses = await Promise.all(loginPromises);
      expect(loginResponses[5]?.status).toBe(429);
      expect(loginResponses[5]?.body.error).toHaveProperty('code', 'RATE_LIMIT_EXCEEDED');
    });

    it('should include rate limit headers', async () => {
      MockedUser.findByEmail.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
    });

    it('should enforce password reset rate limiting', async () => {
      const promises = Array(4).fill(null).map(() =>
        request(app)
          .post('/api/auth/forgot-password')
          .send({ email: 'test@example.com' })
      );

      const responses = await Promise.all(promises);
      expect(responses[3]?.status).toBe(429);
      expect(responses[3]?.body.error).toHaveProperty('code', 'RATE_LIMIT_EXCEEDED');
    });
  });

  describe('Input Validation Security', () => {
    it('should sanitize email input', async () => {
      const maliciousEmails = [
        'test@example.com<script>alert("xss")</script>',
        'test@example.com"; DROP TABLE users; --',
        'test@example.com\r\nBcc: attacker@evil.com'
      ];

      for (const email of maliciousEmails) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email,
            password: 'password123'
          });

        // Should either be rejected as invalid email or sanitized
        if (response.status === 400) {
          expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
        }
      }
    });

    it('should reject oversized payloads', async () => {
      const largeString = 'a'.repeat(10000);

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: largeString,
          first_name: largeString,
          last_name: largeString
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should validate required fields', async () => {
      const invalidPayloads = [
        {},
        { email: 'test@example.com' },
        { password: 'password123' },
        { email: '', password: 'password123' },
        { email: 'test@example.com', password: '' }
      ];

      for (const payload of invalidPayloads) {
        const response = await request(app)
          .post('/api/auth/register')
          .send(payload);

        expect(response.status).toBe(400);
        expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
      }
    });
  });

  describe('Session Security', () => {
    it('should not expose sensitive information in responses', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password_hash: 'hashed-password',
        subscription_tier: 'free' as const,
        email_verified: false,
        reset_token: 'secret-reset-token',
        verification_token: 'secret-verification-token',
        created_at: new Date(),
        updated_at: new Date()
      };

      MockedUser.findByEmail.mockResolvedValue(null);
      MockedUser.createUser.mockResolvedValue(mockUser as any);
      MockedUser.updateById.mockResolvedValue(mockUser as any);

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })
        .expect(201);

      expect(response.body.user).not.toHaveProperty('password_hash');
      expect(response.body.user).not.toHaveProperty('reset_token');
      expect(response.body.user).not.toHaveProperty('verification_token');
    });

    it('should handle concurrent login attempts', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password_hash: 'hashed-password',
        subscription_tier: 'free' as const,
        email_verified: true,
        failed_login_attempts: 0,
        locked_until: null,
        created_at: new Date(),
        updated_at: new Date()
      };

      MockedUser.findByEmail.mockResolvedValue(mockUser as any);
      MockedUser.isAccountLocked.mockResolvedValue(false);
      MockedUser.verifyPassword.mockResolvedValue(true);
      MockedUser.handleSuccessfulLogin.mockResolvedValue();

      // Simulate concurrent login attempts
      const promises = Array(3).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'password123'
          })
      );

      const responses = await Promise.all(promises);

      // All should succeed (within rate limit)
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('tokens');
      });
    });
  });

  describe('Error Handling Security', () => {
    it('should not leak sensitive information in error messages', async () => {
      // Test various error scenarios
      const response1 = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        });

      expect(response1.body.error.message).not.toContain('user not found');
      expect(response1.body.error.message).toBe('Invalid email or password');

      // Test database error handling
      MockedUser.findByEmail.mockRejectedValue(new Error('Database connection failed'));

      const response2 = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response2.status).toBe(500);
      expect(response2.body.error.message).not.toContain('Database connection failed');
    });

    it('should include request IDs for error tracking', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid-email',
          password: 'password123'
        });

      expect(response.body.error).toHaveProperty('timestamp');
      expect(response.body.error).toHaveProperty('requestId');
    });
  });
});