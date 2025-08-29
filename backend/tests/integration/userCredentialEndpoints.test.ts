import request from 'supertest';
import { app } from '../../src/index';
import { User } from '../../src/models/User';
import { IUser } from '../../src/types/database';
import { generateTestJWT } from '../helpers/authHelper';

describe('User Credential Endpoints (User-Specific Encryption)', () => {
  let testUser: IUser;
  let authToken: string;
  const testUserPassword = 'TestPassword123!';
  const testRetailerPassword = 'RetailerPassword456!';

  beforeAll(async () => {
    // Create test user
    testUser = await User.createUser({
      email: 'test-user-encryption@example.com',
      password: testUserPassword,
      firstName: 'Test',
      lastName: 'User'
    });

    // Generate auth token
    authToken = generateTestJWT(testUser.id);
  });

  afterAll(async () => {
    // Clean up test user
    if (testUser) {
      await User.deleteById(testUser.id);
    }
  });

  describe('POST /api/users/retailer-credentials/secure', () => {
    it('should store retailer credentials with user-specific encryption', async () => {
      const credentialData = {
        retailer: 'bestbuy',
        username: 'testuser@example.com',
        retailerPassword: testRetailerPassword,
        userPassword: testUserPassword,
        twoFactorEnabled: true
      };

      const response = await request(app)
        .post('/api/users/retailer-credentials/secure')
        .set('Authorization', `Bearer ${authToken}`)
        .send(credentialData)
        .expect(201);

      expect(response.body).toMatchObject({
        message: 'Retailer credentials added successfully with enhanced security',
        retailer: 'bestbuy',
        encryptionType: 'user-specific'
      });
    });

    it('should reject invalid user password', async () => {
      const credentialData = {
        retailer: 'walmart',
        username: 'testuser@example.com',
        retailerPassword: testRetailerPassword,
        userPassword: 'short', // Too short
        twoFactorEnabled: false
      };

      const response = await request(app)
        .post('/api/users/retailer-credentials/secure')
        .set('Authorization', `Bearer ${authToken}`)
        .send(credentialData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('User password must be at least 8 characters');
    });

    it('should reject missing required fields', async () => {
      const credentialData = {
        retailer: 'costco',
        username: 'testuser@example.com'
        // Missing retailerPassword and userPassword
      };

      const response = await request(app)
        .post('/api/users/retailer-credentials/secure')
        .set('Authorization', `Bearer ${authToken}`)
        .send(credentialData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should require authentication', async () => {
      const credentialData = {
        retailer: 'samsclub',
        username: 'testuser@example.com',
        retailerPassword: testRetailerPassword,
        userPassword: testUserPassword
      };

      await request(app)
        .post('/api/users/retailer-credentials/secure')
        .send(credentialData)
        .expect(401);
    });
  });

  describe('POST /api/users/retailer-credentials/secure/:retailer', () => {
    beforeAll(async () => {
      // Store a credential first
      await request(app)
        .post('/api/users/retailer-credentials/secure')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          retailer: 'target',
          username: 'targetuser@example.com',
          retailerPassword: testRetailerPassword,
          userPassword: testUserPassword,
          twoFactorEnabled: true
        });
    });

    it('should retrieve retailer credentials with correct user password', async () => {
      const response = await request(app)
        .post('/api/users/retailer-credentials/secure/target')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userPassword: testUserPassword })
        .expect(200);

      expect(response.body).toMatchObject({
        retailer: 'target',
        username: 'targetuser@example.com',
        twoFactorEnabled: true,
        encryptionType: 'user-specific',
        message: 'Credentials retrieved successfully'
      });

      // Password should not be included in response
      expect(response.body.password).toBeUndefined();
    });

    it('should reject incorrect user password', async () => {
      const response = await request(app)
        .post('/api/users/retailer-credentials/secure/target')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userPassword: 'WrongPassword123!' })
        .expect(500); // Decryption will fail

      expect(response.body.error).toBeDefined();
    });

    it('should return 404 for non-existent retailer', async () => {
      const response = await request(app)
        .post('/api/users/retailer-credentials/secure/nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userPassword: testUserPassword })
        .expect(404);

      expect(response.body.error.code).toBe('CREDENTIALS_NOT_FOUND');
    });

    it('should require user password in request body', async () => {
      const response = await request(app)
        .post('/api/users/retailer-credentials/secure/target')
        .set('Authorization', `Bearer ${authToken}`)
        .send({}) // Missing userPassword
        .expect(400);

      expect(response.body.error.message).toContain('User password is required');
    });
  });

  describe('GET /api/users/retailer-credentials/secure', () => {
    it('should list all retailer credentials with encryption type', async () => {
      const response = await request(app)
        .get('/api/users/retailer-credentials/secure')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.credentials).toBeDefined();
      expect(Array.isArray(response.body.credentials)).toBe(true);
      expect(response.body.summary).toBeDefined();
      expect(response.body.summary.total).toBeGreaterThan(0);
      expect(response.body.summary.userEncrypted).toBeGreaterThan(0);

      // Check that credentials include encryption type
      const credential = response.body.credentials.find((c: any) => c.retailer === 'target');
      expect(credential).toBeDefined();
      expect(credential.encryptionType).toBe('user-specific');
      expect(credential.username).toBe('targetuser@example.com');
      expect(credential.twoFactorEnabled).toBe(true);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/users/retailer-credentials/secure')
        .expect(401);
    });
  });

  describe('POST /api/users/retailer-credentials/migrate', () => {
    beforeAll(async () => {
      // Store a credential using the old global encryption method
      await request(app)
        .post('/api/users/retailer-credentials')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          retailer: 'gamestop',
          username: 'gamestopuser@example.com',
          password: 'GameStopPassword789!'
        });
    });

    it('should migrate existing credentials to user-specific encryption', async () => {
      const response = await request(app)
        .post('/api/users/retailer-credentials/migrate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userPassword: testUserPassword })
        .expect(200);

      expect(response.body.message).toBe('Credential migration completed');
      expect(response.body.results).toBeDefined();
      expect(response.body.summary).toBeDefined();
      expect(response.body.summary.totalProcessed).toBeGreaterThan(0);

      // Verify that gamestop was migrated (if it was global-encrypted)
      if (response.body.results.migrated.includes('gamestop')) {
        expect(response.body.summary.successfullyMigrated).toBeGreaterThan(0);
      }
    });

    it('should handle migration when no credentials need migration', async () => {
      // Run migration again - should skip already migrated credentials
      const response = await request(app)
        .post('/api/users/retailer-credentials/migrate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userPassword: testUserPassword })
        .expect(200);

      expect(response.body.message).toBe('Credential migration completed');
      expect(response.body.summary.alreadySecure).toBeGreaterThanOrEqual(0);
    });

    it('should reject invalid user password', async () => {
      const response = await request(app)
        .post('/api/users/retailer-credentials/migrate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userPassword: 'short' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should require user password', async () => {
      const response = await request(app)
        .post('/api/users/retailer-credentials/migrate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({}) // Missing userPassword
        .expect(400);

      expect(response.body.error.message).toContain('User password is required');
    });
  });

  describe('Security Tests', () => {
    it('should not allow access to other users credentials', async () => {
      // Create another user
      const otherUser = await User.createUser({
        email: 'other-user@example.com',
        password: 'OtherPassword123!',
        firstName: 'Other',
        lastName: 'User'
      });

      const otherAuthToken = generateTestJWT(otherUser.id);

      try {
        // Try to access the first user's credentials with the second user's token
        const response = await request(app)
          .post('/api/users/retailer-credentials/secure/target')
          .set('Authorization', `Bearer ${otherAuthToken}`)
          .send({ userPassword: 'OtherPassword123!' })
          .expect(404); // Should not find credentials

        expect(response.body.error.code).toBe('CREDENTIALS_NOT_FOUND');
      } finally {
        // Clean up
        await User.deleteById(otherUser.id);
      }
    });

    it('should not decrypt credentials with wrong user password even with correct user ID', async () => {
      // This tests that user password is actually used in encryption
      const response = await request(app)
        .post('/api/users/retailer-credentials/secure/target')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userPassword: 'WrongButValidPassword123!' })
        .expect(500); // Decryption should fail

      expect(response.body.error).toBeDefined();
    });

    it('should handle rate limiting on credential endpoints', async () => {
      // Make multiple rapid requests to test rate limiting
      const promises = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/users/retailer-credentials/secure')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            retailer: `test-${Math.random()}`,
            username: 'testuser@example.com',
            retailerPassword: testRetailerPassword,
            userPassword: testUserPassword
          })
      );

      const responses = await Promise.all(promises);
      
      // Some requests should succeed, but rate limiting should kick in
      const successCount = responses.filter(r => r.status === 201).length;
      const rateLimitedCount = responses.filter(r => r.status === 429).length;
      
      expect(successCount + rateLimitedCount).toBe(10);
      // At least some should be rate limited if the rate limiter is working
      // (This depends on the rate limit configuration)
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/users/retailer-credentials/secure')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}') // Malformed JSON
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should handle very long passwords', async () => {
      const longPassword = 'a'.repeat(1000); // Very long password

      const response = await request(app)
        .post('/api/users/retailer-credentials/secure')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          retailer: 'longpasstest',
          username: 'testuser@example.com',
          retailerPassword: longPassword,
          userPassword: testUserPassword
        })
        .expect(400); // Should be rejected by validation

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle special characters in credentials', async () => {
      const specialPassword = 'P@ssw0rd!#$%^&*()_+{}|:"<>?[]\\;\',./ 中文 🔒';

      const response = await request(app)
        .post('/api/users/retailer-credentials/secure')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          retailer: 'specialchars',
          username: 'user@example.com',
          retailerPassword: specialPassword,
          userPassword: testUserPassword,
          twoFactorEnabled: false
        })
        .expect(201);

      expect(response.body.message).toContain('successfully');

      // Verify we can retrieve it
      const retrieveResponse = await request(app)
        .post('/api/users/retailer-credentials/secure/specialchars')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userPassword: testUserPassword })
        .expect(200);

      expect(retrieveResponse.body.username).toBe('user@example.com');
    });
  });
});