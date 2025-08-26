import crypto, { timingSafeEqual } from 'crypto';
import { EncryptionValidator } from './validator';
import { EncryptionError, EncryptionErrorCodes, EncryptionConstants } from './types';
import { logger } from '../logger';

export class HashingService {

  static hashSensitiveData(data: string, salt?: string): string {
    try {
      EncryptionValidator.validateHashData(data);
      
      const actualSalt = salt || crypto.randomBytes(EncryptionConstants.SALT_LENGTH).toString('hex');
      if (salt) {
        EncryptionValidator.validateSalt(salt);
      }

      const hash = crypto.pbkdf2Sync(
        data, 
        actualSalt, 
        EncryptionConstants.PBKDF2_ITERATIONS, 
        EncryptionConstants.HASH_LENGTH, 
        EncryptionConstants.HASH_ALGORITHM
      );

      return `${actualSalt}:${hash.toString('hex')}`;
    } catch (error) {
      if (error instanceof EncryptionError) {
        throw error;
      }
      
      throw new EncryptionError(
        'Failed to hash sensitive data',
        EncryptionErrorCodes.ENCRYPTION_FAILED,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  static verifyHashedData(data: string, hashedData: string): boolean {
    try {
      EncryptionValidator.validateHashData(data);
      EncryptionValidator.validateHashData(hashedData);

      const parts = hashedData.split(':');
      if (parts.length !== 2) {
        return false;
      }

      const salt = parts[0]!;
      const expectedHash = parts[1]!;

      const testHash = crypto.pbkdf2Sync(
        data, 
        salt, 
        EncryptionConstants.PBKDF2_ITERATIONS, 
        EncryptionConstants.HASH_LENGTH, 
        EncryptionConstants.HASH_ALGORITHM
      );
      
      const expectedBuffer = Buffer.from(expectedHash, 'hex');

      // Use timing-safe comparison to prevent timing attacks
      return testHash.length === expectedBuffer.length && 
             timingSafeEqual(testHash, expectedBuffer);
    } catch (error) {
      // Log error but don't throw - return false for security
      logger.error('Hash verification failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return false;
    }
  }
}