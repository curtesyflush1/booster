/**
 * Key Management Service Factory
 * 
 * This module provides a factory for creating KMS service instances based on
 * configuration. It supports AWS KMS, Google Cloud KMS, HashiCorp Vault, and
 * environment variable fallback.
 */

import { IKeyManagementService, KMSConfig, KMSServiceError, KMSErrorCodes } from './types';
import { AWSKMSService } from './awsKMS';
import { GCPKMSService } from './gcpKMS';
import { VaultKMSService } from './vaultKMS';
import { EnvironmentKMSService } from './envKMS';

export class KMSFactory {
  /**
   * Create a KMS service instance based on configuration
   */
  static createKMSService(config: KMSConfig): IKeyManagementService {
    switch (config.provider) {
      case 'aws':
        return new AWSKMSService(config);
      
      case 'gcp':
        return new GCPKMSService(config);
      
      case 'vault':
        return new VaultKMSService(config);
      
      case 'env':
        return new EnvironmentKMSService(config);
      
      default:
        throw new KMSServiceError(
          `Unsupported KMS provider: ${config.provider}`,
          KMSErrorCodes.INVALID_CONFIGURATION,
          config.provider,
          false
        );
    }
  }

  /**
   * Create a KMS service from environment variables
   */
  static createFromEnvironment(): IKeyManagementService {
    const provider = (process.env.KMS_PROVIDER || 'env') as KMSConfig['provider'];
    
    const config: KMSConfig = {
      provider,
      keyId: process.env.KMS_KEY_ID || 'default',
      timeout: parseInt(process.env.KMS_TIMEOUT || '10000'),
      retryAttempts: parseInt(process.env.KMS_RETRY_ATTEMPTS || '3'),
    };

    // Provider-specific configuration
    switch (provider) {
      case 'aws':
        config.region = process.env.AWS_REGION;
        config.credentials = {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        };
        break;

      case 'gcp':
        config.credentials = {
          projectId: process.env.GOOGLE_CLOUD_PROJECT,
          keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        };
        break;

      case 'vault':
        config.endpoint = process.env.VAULT_ADDR;
        config.credentials = {
          token: process.env.VAULT_TOKEN,
        };
        break;

      case 'env':
        // No additional configuration needed for environment provider
        break;

      default:
        throw new KMSServiceError(
          `Unsupported KMS provider in environment: ${provider}`,
          KMSErrorCodes.INVALID_CONFIGURATION,
          provider,
          false
        );
    }

    return this.createKMSService(config);
  }

  /**
   * Validate KMS configuration
   */
  static validateConfig(config: KMSConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.provider) {
      errors.push('KMS provider is required');
    }

    if (!config.keyId) {
      errors.push('KMS key ID is required');
    }

    // Provider-specific validation
    switch (config.provider) {
      case 'aws':
        if (!config.region && !process.env.AWS_REGION) {
          errors.push('AWS region is required for AWS KMS');
        }
        if (!config.credentials?.accessKeyId && !process.env.AWS_ACCESS_KEY_ID) {
          errors.push('AWS access key ID is required for AWS KMS');
        }
        if (!config.credentials?.secretAccessKey && !process.env.AWS_SECRET_ACCESS_KEY) {
          errors.push('AWS secret access key is required for AWS KMS');
        }
        break;

      case 'gcp':
        if (!config.credentials?.projectId && !process.env.GOOGLE_CLOUD_PROJECT) {
          errors.push('Google Cloud project ID is required for GCP KMS');
        }
        break;

      case 'vault':
        if (!config.endpoint && !process.env.VAULT_ADDR) {
          errors.push('Vault address is required for Vault KMS');
        }
        if (!config.credentials?.token && !process.env.VAULT_TOKEN) {
          errors.push('Vault token is required for Vault KMS');
        }
        break;

      case 'env':
        // Environment provider doesn't require additional validation
        break;

      default:
        errors.push(`Unsupported KMS provider: ${config.provider}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Test KMS service connectivity
   */
  static async testKMSService(config: KMSConfig): Promise<{ healthy: boolean; error?: string }> {
    try {
      const validation = this.validateConfig(config);
      if (!validation.valid) {
        return {
          healthy: false,
          error: `Configuration errors: ${validation.errors.join(', ')}`
        };
      }

      const kmsService = this.createKMSService(config);
      const healthy = await kmsService.healthCheck();
      
      return { healthy };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}