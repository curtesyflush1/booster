import crypto from 'crypto';
import { EncryptionError, EncryptionErrorCodes } from './types';
import { IKeyManagementService } from './kms/types';
// import { KMSFactory } from './kms/factory';

export class EncryptionKeyManager {
  private static instance: EncryptionKeyManager | null = null;
  private cachedKey: Buffer | null = null;
  private kmsService: IKeyManagementService | null = null;
  private keyId: string;

  private constructor() {
    this.keyId = process.env.KMS_KEY_ID || 'default';
    this.initializeKMS();
  }

  static getInstance(): EncryptionKeyManager {
    if (!EncryptionKeyManager.instance) {
      EncryptionKeyManager.instance = new EncryptionKeyManager();
    }
    return EncryptionKeyManager.instance;
  }

  static resetInstance(): void {
    EncryptionKeyManager.instance = null;
  }

  async getKey(): Promise<Buffer> {
    // Always check if we need to derive a new key
    if (!this.cachedKey) {
      this.cachedKey = await this.retrieveKey();
    }
    
    return this.cachedKey;
  }

  /**
   * Synchronous version for backward compatibility
   * Falls back to environment variable if KMS is not available
   */
  getKeySync(): Buffer {
    if (this.cachedKey) {
      return this.cachedKey;
    }

    // Fallback to environment variable for synchronous access
    return this.deriveKeyFromEnv();
  }

  clearCache(): void {
    this.cachedKey = null;
  }

  /**
   * Rotate the encryption key using KMS
   */
  async rotateKey(): Promise<string> {
    if (!this.kmsService) {
      throw new EncryptionError(
        'KMS service not available for key rotation',
        EncryptionErrorCodes.INVALID_KEY
      );
    }

    try {
      const newKeyVersion = await this.kmsService.rotateKey(this.keyId);
      this.clearCache(); // Force reload of the new key
      return newKeyVersion;
    } catch (error) {
      throw new EncryptionError(
        `Failed to rotate encryption key: ${error instanceof Error ? error.message : 'Unknown error'}`,
        EncryptionErrorCodes.INVALID_KEY,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Get key metadata from KMS
   */
  async getKeyMetadata() {
    if (!this.kmsService) {
      return {
        keyId: this.keyId,
        provider: 'env',
        description: 'Environment variable fallback',
        createdAt: new Date(),
        enabled: true
      };
    }

    try {
      return await this.kmsService.getKeyMetadata(this.keyId);
    } catch (error) {
      throw new EncryptionError(
        `Failed to get key metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
        EncryptionErrorCodes.INVALID_KEY,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Check KMS service health
   */
  async healthCheck(): Promise<boolean> {
    if (!this.kmsService) {
      return false;
    }

    try {
      return await this.kmsService.healthCheck();
    } catch (error) {
      return false;
    }
  }

  private initializeKMS(): void {
    try {
      // Only initialize KMS if explicitly configured
      const kmsProvider = process.env.KMS_PROVIDER;
      if (kmsProvider && kmsProvider !== 'env') {
        // this.kmsService = KMSFactory.createFromEnvironment();
      }
    } catch (error) {
      // Log warning but don't fail - fall back to environment variables
      console.warn('Failed to initialize KMS service, falling back to environment variables:', 
        error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async retrieveKey(): Promise<Buffer> {
    // Try KMS first if available
    if (this.kmsService) {
      try {
        return await this.kmsService.getKey(this.keyId);
      } catch (error) {
        console.warn('Failed to retrieve key from KMS, falling back to environment variable:', 
          error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // Fallback to environment variable
    return this.deriveKeyFromEnv();
  }

  private deriveKeyFromEnv(): Buffer {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    
    if (!encryptionKey) {
      throw new EncryptionError(
        'ENCRYPTION_KEY environment variable is required',
        EncryptionErrorCodes.INVALID_KEY
      );
    }

    try {
      // Derive a 32-byte key using PBKDF2
      return crypto.pbkdf2Sync(encryptionKey, 'booster-beacon-salt', 100000, 32, 'sha256');
    } catch (error) {
      throw new EncryptionError(
        'Failed to derive encryption key',
        EncryptionErrorCodes.INVALID_KEY,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }
}

export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function resetEncryptionManager(): void {
  EncryptionKeyManager.resetInstance();
}