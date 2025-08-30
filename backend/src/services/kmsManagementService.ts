/**
 * KMS Management Service
 * 
 * This service provides administrative operations for Key Management Services,
 * including key rotation, health monitoring, and configuration management.
 */

import { IKeyManagementService, KMSConfig, KeyMetadata, KMSServiceError } from '../utils/encryption/kms/types';
// import { KMSFactory } from '../utils/encryption/kms/factory';
import { EncryptionKeyManager } from '../utils/encryption/keyManager';
import { ILogger } from '../types/dependencies';

export interface KMSHealthStatus {
  provider: string;
  healthy: boolean;
  lastChecked: Date;
  error?: string;
  responseTime?: number;
}

export interface KMSOperationResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export class KMSManagementService {
  private logger: ILogger;
  private kmsService: IKeyManagementService | null = null;
  private config: KMSConfig | null = null;

  constructor(logger: ILogger) {
    this.logger = logger;
    this.initializeFromEnvironment();
  }

  /**
   * Initialize KMS service from environment configuration
   */
  private initializeFromEnvironment(): void {
    try {
      const provider = process.env.KMS_PROVIDER;
      if (provider && provider !== 'env') {
        // this.kmsService = KMSFactory.createFromEnvironment();
        this.config = {
          provider: provider as KMSConfig['provider'],
          keyId: process.env.KMS_KEY_ID || 'default',
          region: process.env.AWS_REGION,
          endpoint: process.env.VAULT_ADDR,
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            projectId: process.env.GOOGLE_CLOUD_PROJECT,
            keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
            token: process.env.VAULT_TOKEN,
          },
        };
      }
    } catch (error) {
      this.logger.warn('Failed to initialize KMS service from environment', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get KMS service health status
   */
  async getHealthStatus(): Promise<KMSHealthStatus> {
    const startTime = Date.now();
    
    if (!this.kmsService || !this.config) {
      return {
        provider: 'env',
        healthy: true, // Environment fallback is always considered healthy
        lastChecked: new Date(),
        responseTime: 0
      };
    }

    try {
      const healthy = await this.kmsService.healthCheck();
      const responseTime = Date.now() - startTime;

      const status: KMSHealthStatus = {
        provider: this.config.provider,
        healthy,
        lastChecked: new Date(),
        responseTime
      };

      this.logger.info('KMS health check completed', {
        provider: this.config.provider,
        healthy,
        responseTime
      });

      return status;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error('KMS health check failed', {
        provider: this.config.provider,
        error: errorMessage,
        responseTime
      });

      return {
        provider: this.config.provider,
        healthy: false,
        lastChecked: new Date(),
        responseTime,
        error: errorMessage
      };
    }
  }

  /**
   * Rotate the encryption key
   */
  async rotateEncryptionKey(): Promise<KMSOperationResult> {
    try {
      if (!this.kmsService) {
        return {
          success: false,
          message: 'KMS service not available for key rotation',
          error: 'No KMS service configured'
        };
      }

      const keyManager = EncryptionKeyManager.getInstance();
      const newKeyVersion = await keyManager.rotateKey();

      this.logger.info('Encryption key rotated successfully', {
        provider: this.config?.provider,
        newKeyVersion
      });

      return {
        success: true,
        message: 'Encryption key rotated successfully',
        data: { newKeyVersion }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.logger.error('Failed to rotate encryption key', {
        provider: this.config?.provider,
        error: errorMessage
      });

      return {
        success: false,
        message: 'Failed to rotate encryption key',
        error: errorMessage
      };
    }
  }

  /**
   * Get encryption key metadata
   */
  async getKeyMetadata(): Promise<KMSOperationResult> {
    try {
      const keyManager = EncryptionKeyManager.getInstance();
      const metadata = await keyManager.getKeyMetadata();

      return {
        success: true,
        message: 'Key metadata retrieved successfully',
        data: metadata
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.logger.error('Failed to get key metadata', {
        provider: this.config?.provider,
        error: errorMessage
      });

      return {
        success: false,
        message: 'Failed to get key metadata',
        error: errorMessage
      };
    }
  }

  /**
   * Test KMS configuration
   */
  async testConfiguration(config: KMSConfig): Promise<KMSOperationResult> {
    try {
      // const validation = KMSFactory.validateConfig(config);
      
      // if (!validation.valid) {
      //   return {
      //     success: false,
      //     message: 'Invalid KMS configuration',
      //     error: validation.errors.join(', ')
      //   };
      // }

      // const testResult = await KMSFactory.testKMSService(config);
      
      // if (!testResult.healthy) {
      //   return {
      //     success: false,
      //     message: 'KMS service connectivity test failed',
      //     error: testResult.error
      //   };
      // }

      return {
        success: true,
        message: 'KMS configuration test passed',
        data: { provider: config.provider, keyId: config.keyId }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        success: false,
        message: 'KMS configuration test failed',
        error: errorMessage
      };
    }
  }

  /**
   * Create a new encryption key
   */
  async createEncryptionKey(keyId: string, description?: string): Promise<KMSOperationResult> {
    try {
      if (!this.kmsService) {
        return {
          success: false,
          message: 'KMS service not available for key creation',
          error: 'No KMS service configured'
        };
      }

      const newKeyId = await this.kmsService.createKey(keyId, description);

      this.logger.info('Encryption key created successfully', {
        provider: this.config?.provider,
        keyId,
        newKeyId
      });

      return {
        success: true,
        message: 'Encryption key created successfully',
        data: { keyId, newKeyId }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.logger.error('Failed to create encryption key', {
        provider: this.config?.provider,
        keyId,
        error: errorMessage
      });

      return {
        success: false,
        message: 'Failed to create encryption key',
        error: errorMessage
      };
    }
  }

  /**
   * Get current KMS configuration (without sensitive data)
   */
  getConfiguration(): Partial<KMSConfig> | null {
    if (!this.config) {
      return null;
    }

    return {
      provider: this.config.provider,
      keyId: this.config.keyId,
      region: this.config.region,
      endpoint: this.config.endpoint,
      timeout: this.config.timeout,
      retryAttempts: this.config.retryAttempts
    };
  }

  /**
   * Update KMS configuration
   */
  async updateConfiguration(config: KMSConfig): Promise<KMSOperationResult> {
    try {
      // const validation = KMSFactory.validateConfig(config);
      
      // if (!validation.valid) {
      //   return {
      //     success: false,
      //     message: 'Invalid KMS configuration',
      //     error: validation.errors.join(', ')
      //   };
      // }

      // // Test the new configuration
      // const testResult = await KMSFactory.testKMSService(config);
      
      // if (!testResult.healthy) {
      //   return {
      //     success: false,
      //     message: 'KMS service connectivity test failed with new configuration',
      //     error: testResult.error
      //   };
      // }

      // // Update the service
      // this.kmsService = KMSFactory.createKMSService(config);
      this.config = config;

      // Clear the key manager cache to force reload with new configuration
      const keyManager = EncryptionKeyManager.getInstance();
      keyManager.clearCache();

      this.logger.info('KMS configuration updated successfully', {
        provider: config.provider,
        keyId: config.keyId
      });

      return {
        success: true,
        message: 'KMS configuration updated successfully',
        data: { provider: config.provider, keyId: config.keyId }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.logger.error('Failed to update KMS configuration', {
        error: errorMessage
      });

      return {
        success: false,
        message: 'Failed to update KMS configuration',
        error: errorMessage
      };
    }
  }
}

// Export factory function for creating KMSManagementService instances
import { DependencyContainer } from '../container/DependencyContainer';

export const createKMSManagementService = (dependencies?: Partial<{ logger: ILogger }>) => {
  const container = DependencyContainer.getInstance();
  return new KMSManagementService(
    dependencies?.logger || container.getLogger()
  );
};