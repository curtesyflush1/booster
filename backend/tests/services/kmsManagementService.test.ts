/**
 * KMS Management Service Tests
 */

import { KMSManagementService } from '../../src/services/kmsManagementService';
import { KMSConfig } from '../../src/utils/encryption/kms/types';
import { ILogger } from '../../src/types/dependencies';

// Mock the KMS factory and key manager
jest.mock('../../src/utils/encryption/kms/factory');
jest.mock('../../src/utils/encryption/keyManager');

const mockLogger: ILogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

describe('KMSManagementService', () => {
  let kmsManagementService: KMSManagementService;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    kmsManagementService = new KMSManagementService(mockLogger);
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getHealthStatus', () => {
    it('should return healthy status for environment provider', async () => {
      delete process.env.KMS_PROVIDER;

      const status = await kmsManagementService.getHealthStatus();
      
      expect(status.provider).toBe('env');
      expect(status.healthy).toBe(true);
      expect(status.responseTime).toBe(0);
    });

    it('should log health check completion', async () => {
      await kmsManagementService.getHealthStatus();
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'KMS health check completed',
        expect.objectContaining({
          provider: 'env',
          healthy: true
        })
      );
    });
  });

  describe('getKeyMetadata', () => {
    it('should return success result with metadata', async () => {
      const mockMetadata = {
        keyId: 'test-key',
        description: 'Test key',
        createdAt: new Date(),
        enabled: true,
        keyUsage: 'ENCRYPT_DECRYPT' as const,
        keySpec: 'AES-256'
      };

      // Mock the EncryptionKeyManager
      const { EncryptionKeyManager } = require('../../src/utils/encryption/keyManager');
      const mockKeyManager = {
        getKeyMetadata: jest.fn().mockResolvedValue(mockMetadata)
      };
      EncryptionKeyManager.getInstance = jest.fn().mockReturnValue(mockKeyManager);

      const result = await kmsManagementService.getKeyMetadata();
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockMetadata);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Key metadata retrieved',
        expect.objectContaining({
          keyId: 'test-key'
        })
      );
    });

    it('should handle errors gracefully', async () => {
      const { EncryptionKeyManager } = require('../../src/utils/encryption/keyManager');
      const mockKeyManager = {
        getKeyMetadata: jest.fn().mockRejectedValue(new Error('Test error'))
      };
      EncryptionKeyManager.getInstance = jest.fn().mockReturnValue(mockKeyManager);

      const result = await kmsManagementService.getKeyMetadata();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Test error');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('rotateEncryptionKey', () => {
    it('should return success result when rotation succeeds', async () => {
      const { EncryptionKeyManager } = require('../../src/utils/encryption/keyManager');
      const mockKeyManager = {
        rotateKey: jest.fn().mockResolvedValue('new-key-version-123')
      };
      EncryptionKeyManager.getInstance = jest.fn().mockReturnValue(mockKeyManager);

      const result = await kmsManagementService.rotateEncryptionKey();
      
      expect(result.success).toBe(true);
      expect(result.data.newKeyVersion).toBe('new-key-version-123');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Encryption key rotated successfully',
        expect.objectContaining({
          newKeyVersion: 'new-key-version-123'
        })
      );
    });

    it('should handle rotation errors', async () => {
      const { EncryptionKeyManager } = require('../../src/utils/encryption/keyManager');
      const mockKeyManager = {
        rotateKey: jest.fn().mockRejectedValue(new Error('Rotation failed'))
      };
      EncryptionKeyManager.getInstance = jest.fn().mockReturnValue(mockKeyManager);

      const result = await kmsManagementService.rotateEncryptionKey();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Rotation failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('testConfiguration', () => {
    it('should validate configuration before testing', async () => {
      const invalidConfig: KMSConfig = {
        provider: '' as any,
        keyId: ''
      };

      const result = await kmsManagementService.testConfiguration(invalidConfig);
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid KMS configuration');
    });

    it('should test valid configuration', async () => {
      const validConfig: KMSConfig = {
        provider: 'env',
        keyId: 'test-key'
      };

      // Mock the factory methods
      const { KMSFactory } = require('../../src/utils/encryption/kms/factory');
      KMSFactory.validateConfig = jest.fn().mockReturnValue({ valid: true, errors: [] });
      KMSFactory.testKMSService = jest.fn().mockResolvedValue({ healthy: true });

      const result = await kmsManagementService.testConfiguration(validConfig);
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('KMS configuration test passed');
    });
  });

  describe('getConfiguration', () => {
    it('should return null when no configuration is set', () => {
      const config = kmsManagementService.getConfiguration();
      expect(config).toBeNull();
    });
  });

  describe('updateConfiguration', () => {
    it('should validate configuration before updating', async () => {
      const invalidConfig: KMSConfig = {
        provider: '' as any,
        keyId: ''
      };

      const result = await kmsManagementService.updateConfiguration(invalidConfig);
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid KMS configuration');
    });

    it('should test configuration before updating', async () => {
      const validConfig: KMSConfig = {
        provider: 'env',
        keyId: 'test-key'
      };

      // Mock the factory methods
      const { KMSFactory } = require('../../src/utils/encryption/kms/factory');
      KMSFactory.validateConfig = jest.fn().mockReturnValue({ valid: true, errors: [] });
      KMSFactory.testKMSService = jest.fn().mockResolvedValue({ healthy: false, error: 'Connection failed' });

      const result = await kmsManagementService.updateConfiguration(validConfig);
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('KMS service connectivity test failed with new configuration');
    });
  });

  describe('createEncryptionKey', () => {
    it('should return error when KMS service not available', async () => {
      const result = await kmsManagementService.createEncryptionKey('new-key', 'Test key');
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('KMS service not available for key creation');
    });
  });
});