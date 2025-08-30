/**
 * KMS Integration Tests
 * 
 * These tests verify the complete KMS integration including API endpoints,
 * service layer, and encryption functionality.
 */

import request from 'supertest';
import app from '../../src/index';
import { generateEncryptionKey } from '../../src/utils/encryption/keyManager';

describe('KMS Integration Tests', () => {
  let adminToken: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(async () => {
    originalEnv = { ...process.env };
    
    // Set up test environment
    process.env.ENCRYPTION_KEY = generateEncryptionKey();
    process.env.KMS_PROVIDER = 'env';
    process.env.KMS_KEY_ID = 'test-key';
    
    // Create admin user and get token for testing
    // This would typically involve creating a test admin user
    // For now, we'll mock the admin authentication
    adminToken = 'mock-admin-token';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('KMS Health Endpoints', () => {
    it('should get KMS health status', async () => {
      const response = await request(app)
        .get('/api/admin/kms/health')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('provider');
      expect(response.body.data).toHaveProperty('healthy');
      expect(response.body.data).toHaveProperty('lastChecked');
    });

    it('should require admin authentication', async () => {
      await request(app)
        .get('/api/admin/kms/health')
        .expect(401);
    });
  });

  describe('Key Management Endpoints', () => {
    it('should get key metadata', async () => {
      const response = await request(app)
        .get('/api/admin/kms/key/metadata')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('keyId');
      expect(response.body.data).toHaveProperty('enabled');
      expect(response.body.data).toHaveProperty('keyUsage');
    });

    it('should handle key rotation for environment provider', async () => {
      const response = await request(app)
        .post('/api/admin/kms/key/rotate')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(500); // Environment provider doesn't support rotation

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('KMS service not available');
    });

    it('should handle key creation for environment provider', async () => {
      const response = await request(app)
        .post('/api/admin/kms/key/create')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          keyId: 'new-test-key',
          description: 'Test key for integration tests'
        })
        .expect(500); // Environment provider doesn't support creation

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('KMS service not available');
    });

    it('should validate key creation input', async () => {
      await request(app)
        .post('/api/admin/kms/key/create')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          description: 'Missing keyId'
        })
        .expect(400);
    });
  });

  describe('Configuration Management Endpoints', () => {
    it('should get current KMS configuration', async () => {
      const response = await request(app)
        .get('/api/admin/kms/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      // Environment provider returns null config
      expect(response.body.data).toBeNull();
    });

    it('should test KMS configuration', async () => {
      const testConfig = {
        provider: 'env',
        keyId: 'test-config-key'
      };

      const response = await request(app)
        .post('/api/admin/kms/config/test')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testConfig)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('provider', 'env');
    });

    it('should validate configuration input', async () => {
      const invalidConfig = {
        provider: '',
        keyId: ''
      };

      await request(app)
        .post('/api/admin/kms/config/test')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidConfig)
        .expect(400);
    });

    it('should update KMS configuration', async () => {
      const newConfig = {
        provider: 'env',
        keyId: 'updated-test-key'
      };

      const response = await request(app)
        .put('/api/admin/kms/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newConfig)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('provider', 'env');
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to KMS endpoints', async () => {
      // Make multiple requests quickly to trigger rate limiting
      const requests = Array(60).fill(null).map(() =>
        request(app)
          .get('/api/admin/kms/health')
          .set('Authorization', `Bearer ${adminToken}`)
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited (429 status)
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle internal server errors gracefully', async () => {
      // Test with malformed request that might cause internal error
      const response = await request(app)
        .post('/api/admin/kms/config/test')
        .set('Authorization', `Bearer ${adminToken}`)
        .send('invalid-json')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return proper error format', async () => {
      const response = await request(app)
        .get('/api/admin/kms/nonexistent')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
    });
  });

  describe('Encryption Integration', () => {
    it('should use KMS for encryption operations', async () => {
      // This test would verify that the encryption system
      // properly integrates with the KMS
      const { encrypt, decrypt } = require('../../src/utils/encryption');
      
      const testData = 'sensitive-test-data';
      const encrypted = encrypt(testData);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(testData);
      expect(encrypted).not.toBe(testData);
      expect(encrypted).toMatch(/^v1:/); // Should have version prefix
    });
  });
});

// Mock admin authentication middleware for testing
jest.mock('../../src/middleware/adminAuth', () => ({
  adminAuth: (req: any, res: any, next: any) => {
    // Mock admin user
    req.user = {
      id: 'admin-user-id',
      email: 'admin@test.com',
      role: 'admin'
    };
    next();
  }
}));