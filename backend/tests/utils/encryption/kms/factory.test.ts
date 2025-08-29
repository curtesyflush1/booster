/**
 * KMS Factory Tests
 */

import { KMSFactory } from '../../../../src/utils/encryption/kms/factory';
import { KMSConfig, KMSServiceError } from '../../../../src/utils/encryption/kms/types';
import { EnvironmentKMSService } from '../../../../src/utils/encryption/kms/envKMS';

describe('KMSFactory', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('createKMSService', () => {
    it('should create EnvironmentKMSService for env provider', () => {
      const config: KMSConfig = {
        provider: 'env',
        keyId: 'test-key'
      };

      const service = KMSFactory.createKMSService(config);
      expect(service).toBeInstanceOf(EnvironmentKMSService);
    });

    it('should throw error for unsupported provider', () => {
      const config: KMSConfig = {
        provider: 'unsupported' as any,
        keyId: 'test-key'
      };

      expect(() => KMSFactory.createKMSService(config)).toThrow(KMSServiceError);
      expect(() => KMSFactory.createKMSService(config)).toThrow('Unsupported KMS provider');
    });
  });

  describe('createFromEnvironment', () => {
    it('should create service from environment variables', () => {
      process.env.KMS_PROVIDER = 'env';
      process.env.KMS_KEY_ID = 'test-key';

      const service = KMSFactory.createFromEnvironment();
      expect(service).toBeInstanceOf(EnvironmentKMSService);
    });

    it('should use default values when env vars not set', () => {
      delete process.env.KMS_PROVIDER;
      delete process.env.KMS_KEY_ID;

      const service = KMSFactory.createFromEnvironment();
      expect(service).toBeInstanceOf(EnvironmentKMSService);
    });

    it('should throw error for unsupported provider in environment', () => {
      process.env.KMS_PROVIDER = 'unsupported';

      expect(() => KMSFactory.createFromEnvironment()).toThrow(KMSServiceError);
    });
  });

  describe('validateConfig', () => {
    it('should validate valid env config', () => {
      const config: KMSConfig = {
        provider: 'env',
        keyId: 'test-key'
      };

      const result = KMSFactory.validateConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for missing required fields', () => {
      const config: KMSConfig = {
        provider: '' as any,
        keyId: ''
      };

      const result = KMSFactory.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('KMS provider is required');
      expect(result.errors).toContain('KMS key ID is required');
    });

    it('should validate AWS config requirements', () => {
      const config: KMSConfig = {
        provider: 'aws',
        keyId: 'test-key'
      };

      // Without AWS credentials in env
      delete process.env.AWS_REGION;
      delete process.env.AWS_ACCESS_KEY_ID;
      delete process.env.AWS_SECRET_ACCESS_KEY;

      const result = KMSFactory.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('AWS region is required for AWS KMS');
      expect(result.errors).toContain('AWS access key ID is required for AWS KMS');
      expect(result.errors).toContain('AWS secret access key is required for AWS KMS');
    });

    it('should validate GCP config requirements', () => {
      const config: KMSConfig = {
        provider: 'gcp',
        keyId: 'test-key'
      };

      delete process.env.GOOGLE_CLOUD_PROJECT;

      const result = KMSFactory.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Google Cloud project ID is required for GCP KMS');
    });

    it('should validate Vault config requirements', () => {
      const config: KMSConfig = {
        provider: 'vault',
        keyId: 'test-key'
      };

      delete process.env.VAULT_ADDR;
      delete process.env.VAULT_TOKEN;

      const result = KMSFactory.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Vault address is required for Vault KMS');
      expect(result.errors).toContain('Vault token is required for Vault KMS');
    });

    it('should accept config with credentials provided', () => {
      const config: KMSConfig = {
        provider: 'aws',
        keyId: 'test-key',
        region: 'us-east-1',
        credentials: {
          accessKeyId: 'test-key',
          secretAccessKey: 'test-secret'
        }
      };

      const result = KMSFactory.validateConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('testKMSService', () => {
    it('should return validation errors for invalid config', async () => {
      const config: KMSConfig = {
        provider: '' as any,
        keyId: ''
      };

      const result = await KMSFactory.testKMSService(config);
      expect(result.healthy).toBe(false);
      expect(result.error).toContain('Configuration errors');
    });

    it('should test service connectivity for valid config', async () => {
      const config: KMSConfig = {
        provider: 'env',
        keyId: 'test-key'
      };

      const result = await KMSFactory.testKMSService(config);
      expect(result.healthy).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle service creation errors', async () => {
      const config: KMSConfig = {
        provider: 'unsupported' as any,
        keyId: 'test-key'
      };

      const result = await KMSFactory.testKMSService(config);
      expect(result.healthy).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});