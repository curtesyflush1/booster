import crypto from 'crypto';
import { EncryptionError, EncryptionErrorCodes } from './types';

export class EncryptionKeyManager {
  private static instance: EncryptionKeyManager | null = null;
  private cachedKey: Buffer | null = null;

  private constructor() {}

  static getInstance(): EncryptionKeyManager {
    if (!EncryptionKeyManager.instance) {
      EncryptionKeyManager.instance = new EncryptionKeyManager();
    }
    return EncryptionKeyManager.instance;
  }

  static resetInstance(): void {
    EncryptionKeyManager.instance = null;
  }

  getKey(): Buffer {
    // Always check if we need to derive a new key
    if (!this.cachedKey) {
      this.cachedKey = this.deriveKeyFromEnv();
    }
    
    return this.cachedKey;
  }

  clearCache(): void {
    this.cachedKey = null;
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