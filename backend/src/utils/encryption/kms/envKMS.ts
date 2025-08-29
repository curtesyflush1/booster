/**
 * Environment Variable Key Management Service Implementation
 * 
 * This module provides a fallback KMS implementation that uses environment variables
 * for development and testing purposes. It maintains the same interface as other KMS
 * providers but stores keys in environment variables.
 */

import crypto from 'crypto';
import { IKeyManagementService, KeyMetadata, KMSConfig, KMSServiceError, KMSErrorCodes } from './types';

export class EnvironmentKMSService implements IKeyManagementService {
  private config: KMSConfig;
  private keyCache: Map<string, { key: Buffer; expiry: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(config: KMSConfig) {
    this.config = config;
  }

  async getKey(keyId: string): Promise<Buffer> {
    try {
      // Check cache first
      const cached = this.keyCache.get(keyId);
      if (cached && cached.expiry > Date.now()) {
        return cached.key;
      }

      // Look for the key in environment variables
      const envVarName = this.getEnvVarName(keyId);
      const encryptionKey = process.env[envVarName];
      
      if (!encryptionKey) {
        throw new KMSServiceError(
          `${envVarName} environment variable is required`,
          KMSErrorCodes.KEY_NOT_FOUND,
          'env',
          false,
          keyId
        );
      }

      let keyBuffer: Buffer;

      // Handle both hex-encoded and raw string keys
      if (encryptionKey.length === 64 && /^[0-9a-fA-F]+$/.test(encryptionKey)) {
        // Hex-encoded key
        keyBuffer = Buffer.from(encryptionKey, 'hex');
      } else {
        // Derive key from string using PBKDF2 (same as original implementation)
        keyBuffer = crypto.pbkdf2Sync(encryptionKey, 'booster-beacon-salt', 100000, 32, 'sha256');
      }

      if (keyBuffer.length !== 32) {
        throw new KMSServiceError(
          `Invalid key length: expected 32 bytes, got ${keyBuffer.length}`,
          KMSErrorCodes.INVALID_KEY_FORMAT,
          'env',
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

      throw new KMSServiceError(
        `Failed to retrieve key from environment: ${error instanceof Error ? error.message : 'Unknown error'}`,
        KMSErrorCodes.INVALID_CONFIGURATION,
        'env',
        false,
        keyId
      );
    }
  }

  async createKey(keyId: string, description?: string): Promise<string> {
    // For environment-based KMS, we can't actually create keys
    // This method provides instructions for manual key creation
    const envVarName = this.getEnvVarName(keyId);
    const newKey = crypto.randomBytes(32).toString('hex');
    
    console.warn(`
Environment KMS: To create key '${keyId}', set the following environment variable:
${envVarName}=${newKey}

Description: ${description || 'BoosterBeacon encryption key'}
    `);

    return envVarName;
  }

  async rotateKey(keyId: string): Promise<string> {
    // For environment-based KMS, we can't automatically rotate keys
    // This method provides instructions for manual key rotation
    const envVarName = this.getEnvVarName(keyId);
    const newKey = crypto.randomBytes(32).toString('hex');
    
    console.warn(`
Environment KMS: To rotate key '${keyId}', update the following environment variable:
${envVarName}=${newKey}

Note: You'll need to restart the application after updating the environment variable.
    `);

    // Clear cache to force reload on next access
    this.keyCache.delete(keyId);

    return `${keyId}-${Date.now()}`;
  }

  async healthCheck(): Promise<boolean> {
    // For environment KMS, we just check if we can access environment variables
    try {
      const testKey = process.env.NODE_ENV || 'test';
      return typeof testKey === 'string';
    } catch (error) {
      return false;
    }
  }

  async getKeyMetadata(keyId: string): Promise<KeyMetadata> {
    const envVarName = this.getEnvVarName(keyId);
    const keyExists = !!process.env[envVarName];

    if (!keyExists) {
      throw new KMSServiceError(
        `Key not found in environment: ${envVarName}`,
        KMSErrorCodes.KEY_NOT_FOUND,
        'env',
        false,
        keyId
      );
    }

    return {
      keyId,
      description: `Environment variable: ${envVarName}`,
      createdAt: new Date(), // We can't know the actual creation time
      enabled: true,
      keyUsage: 'ENCRYPT_DECRYPT',
      keySpec: 'AES-256'
    };
  }

  /**
   * Clear the key cache (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.keyCache.clear();
  }

  /**
   * Generate the environment variable name for a given key ID
   */
  private getEnvVarName(keyId: string): string {
    // Convert keyId to a valid environment variable name
    const sanitizedKeyId = keyId.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    return `ENCRYPTION_KEY_${sanitizedKeyId}`;
  }

  /**
   * Generate a new encryption key (utility method)
   */
  static generateKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Validate an encryption key format
   */
  static validateKey(key: string): boolean {
    if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
      return true; // Valid hex key
    }
    if (key.length >= 32) {
      return true; // Valid string key (will be derived)
    }
    return false;
  }
}