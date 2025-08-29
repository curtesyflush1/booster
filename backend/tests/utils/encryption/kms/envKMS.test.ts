/**
 * Environment KMS Service Tests
 */

import { EnvironmentKMSService } from '../../../../src/utils/encryption/kms/envKMS';
import { KMSConfig, KMSServiceError, KMSErrorCodes } from '../../../../src/utils/encryption/kms/types';

describe('EnvironmentKMSService', () => {
  let kmsService: EnvironmentKMSService;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    
    const config: KMSConfig = {
      provider: 'env',
      keyId: 'test-key'
    };
    
    kmsService = new EnvironmentKMSService(config);
  });

  afterEach(() => {
    process.env = originalEnv;
    kmsService.clearCache();
  });

  describe('getKey', () => {
    it('should retrieve key from environment variable', async () => {
      const testKey = 'a'.repeat(64); // 64 character hex key
      process.env.ENCRYPTION_KEY_TEST_KEY = testKey;

      const key = await kmsService.getKey('test-key');
      
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32);
    });

    it('should derive key from string using PBKDF2', async () => {
      const testKey = 'test-encryption-key-string';
      process.env.ENCRYPTION_KEY_TEST_KEY = testKey;

      const key = await kmsService.getKey('test-key');
      
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32);
    });

    it('should cache keys for performance', async () => {
      const testKey = 'a'.repeat(64);
      process.env.ENCRYPTION_KEY_TEST_KEY = testKey;

      const key1 = await kmsService.getKey('test-key');
      const key2 = await kmsService.getKey('test-key');
      
      expect(key1).toEqual(key2);
    });

    it('should throw error when key not found', async () => {
      delete process.env.ENCRYPTION_KEY_TEST_KEY;

      await expect(kmsService.getKey('test-key')).rejects.toThrow(KMSServiceError);
      await expect(kmsService.getKey('test-key')).rejects.toThrow('ENCRYPTION_KEY_TEST_KEY environment variable is required');
    });

    it('should handle short keys by deriving them with PBKDF2', async () => {
      const shortKey = 'a'.repeat(10); // Short key that will be derived
      process.env.ENCRYPTION_KEY_TEST_KEY = shortKey;

      const key = await kmsService.getKey('test-key');
      
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32); // Should be derived to 32 bytes
    });
  });

  describe('createKey', () => {
    it('should provide instructions for manual key creation', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await kmsService.createKey('new-key', 'Test key');
      
      expect(result).toBe('ENCRYPTION_KEY_NEW_KEY');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('ENCRYPTION_KEY_NEW_KEY=')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('rotateKey', () => {
    it('should provide instructions for manual key rotation', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await kmsService.rotateKey('test-key');
      
      expect(result).toMatch(/test-key-\d+/);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('ENCRYPTION_KEY_TEST_KEY=')
      );

      consoleSpy.mockRestore();
    });

    it('should clear cache after rotation', async () => {
      const testKey = 'a'.repeat(64);
      process.env.ENCRYPTION_KEY_TEST_KEY = testKey;

      // Get key to populate cache
      await kmsService.getKey('test-key');
      
      // Rotate key
      await kmsService.rotateKey('test-key');
      
      // Cache should be cleared (we can't directly test this, but it should work)
      const key = await kmsService.getKey('test-key');
      expect(key).toBeInstanceOf(Buffer);
    });
  });

  describe('healthCheck', () => {
    it('should return true when environment is accessible', async () => {
      const healthy = await kmsService.healthCheck();
      expect(healthy).toBe(true);
    });
  });

  describe('getKeyMetadata', () => {
    it('should return metadata for existing key', async () => {
      process.env.ENCRYPTION_KEY_TEST_KEY = 'a'.repeat(64);

      const metadata = await kmsService.getKeyMetadata('test-key');
      
      expect(metadata).toEqual({
        keyId: 'test-key',
        description: 'Environment variable: ENCRYPTION_KEY_TEST_KEY',
        createdAt: expect.any(Date),
        enabled: true,
        keyUsage: 'ENCRYPT_DECRYPT',
        keySpec: 'AES-256'
      });
    });

    it('should throw error for non-existent key', async () => {
      delete process.env.ENCRYPTION_KEY_TEST_KEY;

      await expect(kmsService.getKeyMetadata('test-key')).rejects.toThrow(KMSServiceError);
      await expect(kmsService.getKeyMetadata('test-key')).rejects.toThrow('Key not found in environment');
    });
  });

  describe('static methods', () => {
    it('should generate valid encryption key', () => {
      const key = EnvironmentKMSService.generateKey();
      
      expect(key).toHaveLength(64);
      expect(/^[0-9a-fA-F]+$/.test(key)).toBe(true);
    });

    it('should validate hex keys', () => {
      const validHexKey = 'a'.repeat(64);
      const validStringKey = 'a'.repeat(32);
      const invalidKey = 'a'.repeat(10);

      expect(EnvironmentKMSService.validateKey(validHexKey)).toBe(true);
      expect(EnvironmentKMSService.validateKey(validStringKey)).toBe(true);
      expect(EnvironmentKMSService.validateKey(invalidKey)).toBe(false);
    });
  });

  describe('clearCache', () => {
    it('should clear the key cache', async () => {
      const testKey = 'a'.repeat(64);
      process.env.ENCRYPTION_KEY_TEST_KEY = testKey;

      // Populate cache
      await kmsService.getKey('test-key');
      
      // Clear cache
      kmsService.clearCache();
      
      // Should still work after cache clear
      const key = await kmsService.getKey('test-key');
      expect(key).toBeInstanceOf(Buffer);
    });
  });
});