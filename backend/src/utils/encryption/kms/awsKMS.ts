/**
 * AWS Key Management Service (KMS) Implementation
 * 
 * This module provides integration with AWS KMS for secure key management.
 * It handles key retrieval, creation, rotation, and error handling specific to AWS KMS.
 */

import { KMSClient, CreateKeyCommand, DescribeKeyCommand } from '@aws-sdk/client-kms';
import { SSMClient, GetParameterCommand as SSMGetParameterCommand, PutParameterCommand } from '@aws-sdk/client-ssm';
import crypto from 'crypto';
import { IKeyManagementService, KeyMetadata, KMSConfig, KMSServiceError, KMSErrorCodes } from './types';

export class AWSKMSService implements IKeyManagementService {
  private kmsClient: KMSClient;
  private ssmClient: SSMClient;
  private config: KMSConfig;
  private keyCache: Map<string, { key: Buffer; expiry: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(config: KMSConfig) {
    this.config = config;
    
    const clientConfig = {
      region: config.region || process.env.AWS_REGION || 'us-east-1',
      ...(config.credentials && {
        credentials: {
          accessKeyId: config.credentials.accessKeyId || process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: config.credentials.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY!,
        }
      }),
      ...(config.endpoint && { endpoint: config.endpoint })
    };

    this.kmsClient = new KMSClient(clientConfig);
    this.ssmClient = new SSMClient(clientConfig);
  }

  async getKey(keyId: string): Promise<Buffer> {
    try {
      // Check cache first
      const cached = this.keyCache.get(keyId);
      if (cached && cached.expiry > Date.now()) {
        return cached.key;
      }

      // For AWS KMS, we'll store the actual encryption key in SSM Parameter Store
      // and use KMS to encrypt/decrypt it. This provides better key rotation capabilities.
      const parameterName = `/boosterbeacon/encryption-keys/${keyId}`;
      
      const command = new SSMGetParameterCommand({
        Name: parameterName,
        WithDecryption: true // This uses the KMS key to decrypt the parameter
      });

      const response = await this.ssmClient.send(command);
      
      if (!response.Parameter?.Value) {
        throw new KMSServiceError(
          `Encryption key not found in Parameter Store: ${parameterName}`,
          KMSErrorCodes.KEY_NOT_FOUND,
          'aws',
          false,
          keyId
        );
      }

      // The parameter value should be a hex-encoded key
      const keyBuffer = Buffer.from(response.Parameter.Value, 'hex');
      
      if (keyBuffer.length !== 32) {
        throw new KMSServiceError(
          `Invalid key length: expected 32 bytes, got ${keyBuffer.length}`,
          KMSErrorCodes.INVALID_KEY_FORMAT,
          'aws',
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

      // Handle AWS SDK errors
      if (error && typeof error === 'object' && 'name' in error) {
        switch (error.name) {
          case 'ParameterNotFound':
            throw new KMSServiceError(
              `Encryption key parameter not found: ${keyId}`,
              KMSErrorCodes.KEY_NOT_FOUND,
              'aws',
              false,
              keyId
            );
          case 'AccessDeniedException':
            throw new KMSServiceError(
              `Access denied to encryption key: ${keyId}`,
              KMSErrorCodes.ACCESS_DENIED,
              'aws',
              false,
              keyId
            );
          case 'ThrottlingException':
            throw new KMSServiceError(
              `Rate limited accessing key: ${keyId}`,
              KMSErrorCodes.RATE_LIMITED,
              'aws',
              true,
              keyId
            );
          case 'ServiceUnavailableException':
            throw new KMSServiceError(
              'AWS KMS service is unavailable',
              KMSErrorCodes.SERVICE_UNAVAILABLE,
              'aws',
              true,
              keyId
            );
        }
      }

      throw new KMSServiceError(
        `Failed to retrieve key from AWS KMS: ${error instanceof Error ? error.message : 'Unknown error'}`,
        KMSErrorCodes.NETWORK_ERROR,
        'aws',
        true,
        keyId
      );
    }
  }

  async createKey(keyId: string, description?: string): Promise<string> {
    try {
      // First, create a KMS key for encrypting the parameter
      const createKeyCommand = new CreateKeyCommand({
        Description: description || `BoosterBeacon encryption key for ${keyId}`,
        KeyUsage: 'ENCRYPT_DECRYPT',
        KeySpec: 'SYMMETRIC_DEFAULT',
        Tags: [
          { TagKey: 'Application', TagValue: 'BoosterBeacon' },
          { TagKey: 'Purpose', TagValue: 'EncryptionKey' },
          { TagKey: 'KeyId', TagValue: keyId }
        ]
      });

      const keyResponse = await this.kmsClient.send(createKeyCommand);
      const kmsKeyId = keyResponse.KeyMetadata?.KeyId;

      if (!kmsKeyId) {
        throw new KMSServiceError(
          'Failed to create KMS key: no key ID returned',
          KMSErrorCodes.SERVICE_UNAVAILABLE,
          'aws',
          true
        );
      }

      // Generate a new 256-bit encryption key
      const encryptionKey = crypto.randomBytes(32);

      // Store the encryption key in SSM Parameter Store, encrypted with the KMS key
      const parameterName = `/boosterbeacon/encryption-keys/${keyId}`;
      const putParameterCommand = new PutParameterCommand({
        Name: parameterName,
        Value: encryptionKey.toString('hex'),
        Type: 'SecureString',
        KeyId: kmsKeyId,
        Description: description || `BoosterBeacon encryption key for ${keyId}`,
        Tags: [
          { Key: 'Application', Value: 'BoosterBeacon' },
          { Key: 'Purpose', Value: 'EncryptionKey' },
          { Key: 'KeyId', Value: keyId }
        ]
      });

      await this.ssmClient.send(putParameterCommand);

      return kmsKeyId;
    } catch (error) {
      if (error instanceof KMSServiceError) {
        throw error;
      }

      throw new KMSServiceError(
        `Failed to create key in AWS KMS: ${error instanceof Error ? error.message : 'Unknown error'}`,
        KMSErrorCodes.SERVICE_UNAVAILABLE,
        'aws',
        true,
        keyId
      );
    }
  }

  async rotateKey(keyId: string): Promise<string> {
    try {
      // Generate a new encryption key
      const newEncryptionKey = crypto.randomBytes(32);

      // Update the parameter with the new key
      const parameterName = `/boosterbeacon/encryption-keys/${keyId}`;
      const putParameterCommand = new PutParameterCommand({
        Name: parameterName,
        Value: newEncryptionKey.toString('hex'),
        Type: 'SecureString',
        Overwrite: true,
        Description: `BoosterBeacon encryption key for ${keyId} (rotated on ${new Date().toISOString()})`
      });

      await this.ssmClient.send(putParameterCommand);

      // Clear cache to force reload
      this.keyCache.delete(keyId);

      return `${keyId}-${Date.now()}`;
    } catch (error) {
      throw new KMSServiceError(
        `Failed to rotate key in AWS KMS: ${error instanceof Error ? error.message : 'Unknown error'}`,
        KMSErrorCodes.SERVICE_UNAVAILABLE,
        'aws',
        true,
        keyId
      );
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Try to list keys to verify connectivity
      const command = new DescribeKeyCommand({
        KeyId: 'alias/aws/ssm' // Use a default AWS managed key for health check
      });

      await this.kmsClient.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  async getKeyMetadata(keyId: string): Promise<KeyMetadata> {
    try {
      const parameterName = `/boosterbeacon/encryption-keys/${keyId}`;
      
      // Get parameter metadata
      const command = new SSMGetParameterCommand({
        Name: parameterName,
        WithDecryption: false
      });

      const response = await this.ssmClient.send(command);
      
      if (!response.Parameter) {
        throw new KMSServiceError(
          `Key metadata not found: ${keyId}`,
          KMSErrorCodes.KEY_NOT_FOUND,
          'aws',
          false,
          keyId
        );
      }

      return {
        keyId,
        description: `AWS SSM Parameter: ${parameterName}`,
        createdAt: response.Parameter?.LastModifiedDate || new Date(),
        lastRotated: response.Parameter?.LastModifiedDate,
        enabled: true,
        keyUsage: 'ENCRYPT_DECRYPT',
        keySpec: 'AES-256'
      };
    } catch (error) {
      if (error instanceof KMSServiceError) {
        throw error;
      }

      throw new KMSServiceError(
        `Failed to get key metadata from AWS KMS: ${error instanceof Error ? error.message : 'Unknown error'}`,
        KMSErrorCodes.SERVICE_UNAVAILABLE,
        'aws',
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