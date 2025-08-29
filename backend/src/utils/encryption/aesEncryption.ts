import crypto from 'crypto';
import { IEncryptionService, EncryptionError, EncryptionErrorCodes } from './types';
import { EncryptionKeyManager } from './keyManager';
import { EncryptionValidator } from './validator';
import { HashingService } from './hashingService';
import { EncryptionPerformanceTracker } from './performanceTracker';

export class AESEncryptionService implements IEncryptionService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly VERSION = 'v1';
  private performanceTracker = new EncryptionPerformanceTracker();

  constructor(private keyManager: EncryptionKeyManager = EncryptionKeyManager.getInstance()) {}

  encrypt(plaintext: string): string {
    this.performanceTracker.startTimer();
    try {
      EncryptionValidator.validatePlaintext(plaintext);
      
      // Use synchronous key retrieval for backward compatibility
      const key = this.keyManager.getKeySync();
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(AESEncryptionService.ALGORITHM, key, iv);
      
      cipher.setAAD(Buffer.from(AESEncryptionService.VERSION));
      
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      const result = `${AESEncryptionService.VERSION}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
      this.performanceTracker.endTimer('encrypt');
      return result;
    } catch (error) {
      if (error instanceof EncryptionError) {
        throw error;
      }
      
      // Check if it's a key-related error and preserve the original message
      if (error instanceof Error && error.message.includes('ENCRYPTION_KEY')) {
        throw new EncryptionError(
          error.message,
          EncryptionErrorCodes.INVALID_KEY,
          { originalError: error.message }
        );
      }
      
      throw new EncryptionError(
        'Failed to encrypt data',
        EncryptionErrorCodes.ENCRYPTION_FAILED,
        { 
          error: error instanceof Error ? error.message : 'Unknown error',
          plaintextLength: plaintext.length 
        }
      );
    }
  }

  async encryptAsync(plaintext: string): Promise<string> {
    this.performanceTracker.startTimer();
    try {
      EncryptionValidator.validatePlaintext(plaintext);
      
      const key = await this.keyManager.getKey();
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(AESEncryptionService.ALGORITHM, key, iv);
      
      cipher.setAAD(Buffer.from(AESEncryptionService.VERSION));
      
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      const result = `${AESEncryptionService.VERSION}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
      this.performanceTracker.endTimer('encrypt');
      return result;
    } catch (error) {
      if (error instanceof EncryptionError) {
        throw error;
      }
      
      // Check if it's a key-related error and preserve the original message
      if (error instanceof Error && error.message.includes('ENCRYPTION_KEY')) {
        throw new EncryptionError(
          error.message,
          EncryptionErrorCodes.INVALID_KEY,
          { originalError: error.message }
        );
      }
      
      throw new EncryptionError(
        'Failed to encrypt data',
        EncryptionErrorCodes.ENCRYPTION_FAILED,
        { 
          error: error instanceof Error ? error.message : 'Unknown error',
          plaintextLength: plaintext.length 
        }
      );
    }
  }

  decrypt(encryptedData: string): string {
    this.performanceTracker.startTimer();
    try {
      EncryptionValidator.validateEncryptedData(encryptedData);

      const parts = encryptedData.split(':');
      if (parts.length !== 4) {
        throw new EncryptionError(
          'Invalid encrypted data format',
          EncryptionErrorCodes.DECRYPTION_FAILED,
          { partsCount: parts.length }
        );
      }

      const [version, ivHex, authTagHex, encrypted] = parts;
      
      if (version !== AESEncryptionService.VERSION) {
        throw new EncryptionError(
          'Unsupported encryption version',
          EncryptionErrorCodes.DECRYPTION_FAILED,
          { version }
        );
      }

      // Use synchronous key retrieval for backward compatibility
      const key = this.keyManager.getKeySync();
      const iv = Buffer.from(ivHex!, 'hex');
      const authTag = Buffer.from(authTagHex!, 'hex');
      
      const decipher = crypto.createDecipheriv(AESEncryptionService.ALGORITHM, key, iv);
      decipher.setAAD(Buffer.from(version!));
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted!, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      const result = decrypted;
      this.performanceTracker.endTimer('decrypt');
      return result;
    } catch (error) {
      if (error instanceof EncryptionError) {
        throw error;
      }
      
      throw new EncryptionError(
        'Failed to decrypt data',
        EncryptionErrorCodes.DECRYPTION_FAILED,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  async decryptAsync(encryptedData: string): Promise<string> {
    this.performanceTracker.startTimer();
    try {
      EncryptionValidator.validateEncryptedData(encryptedData);

      const parts = encryptedData.split(':');
      if (parts.length !== 4) {
        throw new EncryptionError(
          'Invalid encrypted data format',
          EncryptionErrorCodes.DECRYPTION_FAILED,
          { partsCount: parts.length }
        );
      }

      const [version, ivHex, authTagHex, encrypted] = parts;
      
      if (version !== AESEncryptionService.VERSION) {
        throw new EncryptionError(
          'Unsupported encryption version',
          EncryptionErrorCodes.DECRYPTION_FAILED,
          { version }
        );
      }

      const key = await this.keyManager.getKey();
      const iv = Buffer.from(ivHex!, 'hex');
      const authTag = Buffer.from(authTagHex!, 'hex');
      
      const decipher = crypto.createDecipheriv(AESEncryptionService.ALGORITHM, key, iv);
      decipher.setAAD(Buffer.from(version!));
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted!, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      const result = decrypted;
      this.performanceTracker.endTimer('decrypt');
      return result;
    } catch (error) {
      if (error instanceof EncryptionError) {
        throw error;
      }
      
      throw new EncryptionError(
        'Failed to decrypt data',
        EncryptionErrorCodes.DECRYPTION_FAILED,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  hashSensitiveData(data: string, salt?: string): string {
    return HashingService.hashSensitiveData(data, salt);
  }

  verifyHashedData(data: string, hashedData: string): boolean {
    return HashingService.verifyHashedData(data, hashedData);
  }

  getPerformanceMetrics() {
    return this.performanceTracker.getMetrics();
  }

  resetPerformanceMetrics() {
    this.performanceTracker.reset();
  }
}