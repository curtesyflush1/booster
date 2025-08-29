/**
 * Google Cloud Key Management Service (KMS) Implementation
 * 
 * This module provides integration with Google Cloud KMS for secure key management.
 * It handles key retrieval, creation, rotation, and error handling specific to GCP KMS.
 */

import { KeyManagementServiceClient } from '@google-cloud/kms';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import crypto from 'crypto';
import { IKeyManagementService, KeyMetadata, KMSConfig, KMSServiceError, KMSErrorCodes } from './types';

export class GCPKMSService implements IKeyManagementService {
  private kmsClient: KeyManagementServiceClient;
  private secretClient: SecretManagerServiceClient;
  private config: KMSConfig;
  private keyCache: Map<string, { key: Buffer; expiry: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(config: KMSConfig) {
    this.config = config;
    
    const clientConfig = {
      ...(config.credentials?.projectId && { projectId: config.credentials.projectId }),
      ...(config.credentials?.keyFile && { keyFilename: config.credentials.keyFile }),
    };

    this.kmsClient = new KeyManagementServiceClient(clientConfig);
    this.secretClient = new SecretManagerServiceClient(clientConfig);
  }

  async getKey(keyId: string): Promise<Buffer> {
    try {
      // Check cache first
      const cached = this.keyCache.get(keyId);
      if (cached && cached.expiry > Date.now()) {
        return cached.key;
      }

      const projectId = this.config.credentials?.projectId || process.env.GOOGLE_CLOUD_PROJECT;
      if (!projectId) {
        throw new KMSServiceError(
          'Google Cloud project ID not configured',
          KMSErrorCodes.INVALID_CONFIGURATION,
          'gcp',
          false
        );
      }

      // Get the encryption key from Secret Manager
      const secretName = `projects/${projectId}/secrets/boosterbeacon-encryption-key-${keyId}/versions/latest`;
      
      const [accessResponse] = await this.secretClient.accessSecretVersion({
        name: secretName,
      });

      if (!accessResponse.payload?.data) {
        throw new KMSServiceError(
          `Encryption key not found in Secret Manager: ${keyId}`,
          KMSErrorCodes.KEY_NOT_FOUND,
          'gcp',
          false,
          keyId
        );
      }

      // The secret data should be a hex-encoded key
      const keyHex = accessResponse.payload.data.toString();
      const keyBuffer = Buffer.from(keyHex, 'hex');
      
      if (keyBuffer.length !== 32) {
        throw new KMSServiceError(
          `Invalid key length: expected 32 bytes, got ${keyBuffer.length}`,
          KMSErrorCodes.INVALID_KEY_FORMAT,
          'gcp',
          false,
          keyId
        );
      }

      // Cache the key
      this.keyCache.set(keyId, {
        key: keyBuffer,
        expiry: Date.now() + this.CACHE_TTL
      });

      return keyBuffer;
    } catch (error) {
      if (error instanceof KMSServiceError) {
        throw error;
      }

      // Handle Google Cloud errors
      if (error && typeof error === 'object' && 'code' in error) {
        switch (error.code) {
          case 5: // NOT_FOUND
            throw new KMSServiceError(
              `Encryption key not found: ${keyId}`,
              KMSErrorCodes.KEY_NOT_FOUND,
              'gcp',
              false,
              keyId
            );
          case 7: // PERMISSION_DENIED
            throw new KMSServiceError(
              `Access denied to encryption key: ${keyId}`,
              KMSErrorCodes.ACCESS_DENIED,
              'gcp',
              false,
              keyId
            );
          case 8: // RESOURCE_EXHAUSTED
            throw new KMSServiceError(
              `Rate limited accessing key: ${keyId}`,
              KMSErrorCodes.RATE_LIMITED,
              'gcp',
              true,
              keyId
            );
          case 14: // UNAVAILABLE
            throw new KMSServiceError(
              'Google Cloud KMS service is unavailable',
              KMSErrorCodes.SERVICE_UNAVAILABLE,
              'gcp',
              true,
              keyId
            );
        }
      }

      throw new KMSServiceError(
        `Failed to retrieve key from Google Cloud KMS: ${error instanceof Error ? error.message : 'Unknown error'}`,
        KMSErrorCodes.NETWORK_ERROR,
        'gcp',
        true,
        keyId
      );
    }
  }

  async createKey(keyId: string, description?: string): Promise<string> {
    try {
      const projectId = this.config.credentials?.projectId || process.env.GOOGLE_CLOUD_PROJECT;
      if (!projectId) {
        throw new KMSServiceError(
          'Google Cloud project ID not configured',
          KMSErrorCodes.INVALID_CONFIGURATION,
          'gcp',
          false
        );
      }

      // Generate a new 256-bit encryption key
      const encryptionKey = crypto.randomBytes(32);

      // Create the secret in Secret Manager
      const secretId = `boosterbeacon-encryption-key-${keyId}`;
      const parent = `projects/${projectId}`;

      const [secret] = await this.secretClient.createSecret({
        parent,
        secretId,
        secret: {
          labels: {
            application: 'boosterbeacon',
            purpose: 'encryption-key',
            keyId: keyId.replace(/[^a-zA-Z0-9]/g, '-')
          },
          replication: {
            automatic: {},
          },
        },
      });

      // Add the secret version with the encryption key
      const [version] = await this.secretClient.addSecretVersion({
        parent: secret.name,
        payload: {
          data: Buffer.from(encryptionKey.toString('hex')),
        },
      });

      return version.name || secretId;
    } catch (error) {
      if (error instanceof KMSServiceError) {
        throw error;
      }

      throw new KMSServiceError(
        `Failed to create key in Google Cloud KMS: ${error instanceof Error ? error.message : 'Unknown error'}`,
        KMSErrorCodes.SERVICE_UNAVAILABLE,
        'gcp',
        true,
        keyId
      );
    }
  }

  async rotateKey(keyId: string): Promise<string> {
    try {
      const projectId = this.config.credentials?.projectId || process.env.GOOGLE_CLOUD_PROJECT;
      if (!projectId) {
        throw new KMSServiceError(
          'Google Cloud project ID not configured',
          KMSErrorCodes.INVALID_CONFIGURATION,
          'gcp',
          false
        );
      }

      // Generate a new encryption key
      const newEncryptionKey = crypto.randomBytes(32);

      // Add a new version to the existing secret
      const secretName = `projects/${projectId}/secrets/boosterbeacon-encryption-key-${keyId}`;
      
      const [version] = await this.secretClient.addSecretVersion({
        parent: secretName,
        payload: {
          data: Buffer.from(newEncryptionKey.toString('hex')),
        },
      });

      // Clear cache to force reload
      this.keyCache.delete(keyId);

      return version.name || `${keyId}-${Date.now()}`;
    } catch (error) {
      throw new KMSServiceError(
        `Failed to rotate key in Google Cloud KMS: ${error instanceof Error ? error.message : 'Unknown error'}`,
        KMSErrorCodes.SERVICE_UNAVAILABLE,
        'gcp',
        true,
        keyId
      );
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const projectId = this.config.credentials?.projectId || process.env.GOOGLE_CLOUD_PROJECT;
      if (!projectId) {
        return false;
      }

      // Try to list key rings to verify connectivity
      const locationName = `projects/${projectId}/locations/global`;
      await this.kmsClient.listKeyRings({
        parent: locationName,
        pageSize: 1,
      });
      
      return true;
    } catch (error) {
      return false;
    }
  }

  async getKeyMetadata(keyId: string): Promise<KeyMetadata> {
    try {
      const projectId = this.config.credentials?.projectId || process.env.GOOGLE_CLOUD_PROJECT;
      if (!projectId) {
        throw new KMSServiceError(
          'Google Cloud project ID not configured',
          KMSErrorCodes.INVALID_CONFIGURATION,
          'gcp',
          false
        );
      }

      const secretName = `projects/${projectId}/secrets/boosterbeacon-encryption-key-${keyId}`;
      
      const [secret] = await this.secretClient.getSecret({
        name: secretName,
      });

      if (!secret) {
        throw new KMSServiceError(
          `Key metadata not found: ${keyId}`,
          KMSErrorCodes.KEY_NOT_FOUND,
          'gcp',
          false,
          keyId
        );
      }

      return {
        keyId,
        description: secret.labels?.description,
        createdAt: secret.createTime ? new Date(Number(secret.createTime.seconds) * 1000) : new Date(),
        lastRotated: secret.createTime ? new Date(Number(secret.createTime.seconds) * 1000) : undefined,
        enabled: true,
        keyUsage: 'ENCRYPT_DECRYPT',
        keySpec: 'AES-256'
      };
    } catch (error) {
      if (error instanceof KMSServiceError) {
        throw error;
      }

      throw new KMSServiceError(
        `Failed to get key metadata from Google Cloud KMS: ${error instanceof Error ? error.message : 'Unknown error'}`,
        KMSErrorCodes.SERVICE_UNAVAILABLE,
        'gcp',
        true,
        keyId
      );
    }
  }

  /**
   * Clear the key cache (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.keyCache.clear();
  }
}