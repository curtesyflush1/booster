import crypto from 'crypto';
import { IEncryptionService, EncryptionError, EncryptionErrorCodes } from './types';
import { EncryptionValidator } from './validator';
import { EncryptionPerformanceTracker } from './performanceTracker';

/**
 * User-specific encryption service that derives unique encryption keys
 * from user passwords for maximum security of retailer credentials.
 * 
 * This ensures that even if the database is compromised, retailer credentials
 * remain protected by the user's password.
 * 
 * @example
 * ```typescript
 * const service = UserEncryptionService.create();
 * const encrypted = await service.encryptWithUserKey(data, password, userId);
 * const decrypted = await service.decryptWithUserKey(encrypted, password, userId);
 * ```
 */
export class UserEncryptionService implements IEncryptionService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly VERSION = 'user-v1';
  private static readonly KEY_DERIVATION_ITERATIONS = process.env.NODE_ENV === 'test' ? 1000 : 100000;
  private static readonly SALT_LENGTH = 32;
  private static readonly IV_LENGTH = 16;
  private static readonly KEY_LENGTH = 32; // 256-bit key
  private static readonly MIN_PASSWORD_LENGTH = 8;
  private static readonly ENCRYPTED_DATA_PARTS = 5;
  private performanceTracker = new EncryptionPerformanceTracker();

  /**
   * Factory method to create a new UserEncryptionService instance
   */
  static create(): UserEncryptionService {
    return new UserEncryptionService();
  }

  /**
   * Encrypt data using a user-specific key derived from their password
   * @param plaintext - Data to encrypt
   * @param userPassword - User's password for key derivation
   * @param userId - User's unique identifier for additional entropy
   * @returns Promise resolving to encrypted data string (format: version:salt:iv:authTag:encrypted)
   * @throws {EncryptionError} When encryption fails or inputs are invalid
   */
  async encryptWithUserKey(plaintext: string, userPassword: string, userId: string): Promise<string> {
    this.performanceTracker.startTimer();
    try {
      EncryptionValidator.validatePlaintext(plaintext);
      this.validateUserCredentials(userPassword, userId);

      // Generate a unique salt for this encryption operation
      const salt = crypto.randomBytes(UserEncryptionService.SALT_LENGTH);
      
      // Derive user-specific encryption key
      const userKey = await this.deriveUserKey(userPassword, userId, salt);
      
      // Generate IV for this encryption
      const iv = crypto.randomBytes(UserEncryptionService.IV_LENGTH);
      const cipher = crypto.createCipheriv(UserEncryptionService.ALGORITHM, userKey, iv);
      
      cipher.setAAD(Buffer.from(UserEncryptionService.VERSION));
      
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      // Format: version:salt:iv:authTag:encrypted
      const result = `${UserEncryptionService.VERSION}:${salt.toString('hex')}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
      
      // Clear sensitive data from memory
      userKey.fill(0);
      
      this.performanceTracker.endTimer('encrypt');
      return result;
    } catch (error) {
      if (error instanceof EncryptionError) {
        throw error;
      }
      
      throw new EncryptionError(
        'Failed to encrypt data with user key',
        EncryptionErrorCodes.ENCRYPTION_FAILED,
        { 
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: userId.substring(0, 8) + '...' // Partial ID for logging
        }
      );
    }
  }

  /**
   * Decrypt data using a user-specific key derived from their password
   * @param encryptedData - Encrypted data string from encryptWithUserKey
   * @param userPassword - User's password for key derivation
   * @param userId - User's unique identifier for additional entropy
   * @returns Promise resolving to decrypted plaintext
   * @throws {EncryptionError} When decryption fails or inputs are invalid
   */
  async decryptWithUserKey(encryptedData: string, userPassword: string, userId: string): Promise<string> {
    this.performanceTracker.startTimer();
    try {
      EncryptionValidator.validateEncryptedData(encryptedData);
      this.validateUserCredentials(userPassword, userId);

      const parts = encryptedData.split(':');
      if (parts.length !== UserEncryptionService.ENCRYPTED_DATA_PARTS) {
        throw new EncryptionError(
          'Invalid user-encrypted data format',
          EncryptionErrorCodes.DECRYPTION_FAILED,
          { 
            partsCount: parts.length, 
            expectedParts: UserEncryptionService.ENCRYPTED_DATA_PARTS 
          }
        );
      }

      const [version, saltHex, ivHex, authTagHex, encrypted] = parts;
      
      if (version !== UserEncryptionService.VERSION) {
        throw new EncryptionError(
          'Unsupported user encryption version',
          EncryptionErrorCodes.DECRYPTION_FAILED,
          { version }
        );
      }

      // Extract components
      const salt = Buffer.from(saltHex!, 'hex');
      const iv = Buffer.from(ivHex!, 'hex');
      const authTag = Buffer.from(authTagHex!, 'hex');
      
      // Derive the same user key using the stored salt
      const userKey = await this.deriveUserKey(userPassword, userId, salt);
      
      const decipher = crypto.createDecipheriv(UserEncryptionService.ALGORITHM, userKey, iv);
      decipher.setAAD(Buffer.from(version!));
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted!, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      // Clear sensitive data from memory
      userKey.fill(0);
      
      this.performanceTracker.endTimer('decrypt');
      return decrypted;
    } catch (error) {
      if (error instanceof EncryptionError) {
        throw error;
      }
      
      throw new EncryptionError(
        'Failed to decrypt data with user key',
        EncryptionErrorCodes.DECRYPTION_FAILED,
        { 
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: userId.substring(0, 8) + '...' // Partial ID for logging
        }
      );
    }
  }

  /**
   * Check if encrypted data was encrypted with user-specific encryption
   */
  static isUserEncrypted(encryptedData: string): boolean {
    try {
      const parts = encryptedData.split(':');
      return parts.length === UserEncryptionService.ENCRYPTED_DATA_PARTS && 
             parts[0] === UserEncryptionService.VERSION;
    } catch {
      return false;
    }
  }


  /**
   * Migrate existing global-encrypted data to user-specific encryption
   */
  async migrateToUserEncryption(
    globalEncryptedData: string, 
    userPassword: string, 
    userId: string,
    globalDecryptFunction: (data: string) => string
  ): Promise<string> {
    try {
      // First decrypt with global key
      const plaintext = globalDecryptFunction(globalEncryptedData);
      
      // Re-encrypt with user-specific key
      return await this.encryptWithUserKey(plaintext, userPassword, userId);
    } catch (error) {
      throw new EncryptionError(
        'Failed to migrate encryption to user-specific key',
        EncryptionErrorCodes.ENCRYPTION_FAILED,
        { 
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: userId.substring(0, 8) + '...'
        }
      );
    }
  }

  /**
   * Derive a user-specific encryption key from password and user ID
   */
  private async deriveUserKey(userPassword: string, userId: string, salt: Buffer): Promise<Buffer> {
    try {
      // Combine user password with user ID for additional entropy
      const keyMaterial = `${userPassword}:${userId}`;
      
      // Use async PBKDF2 to avoid blocking the event loop
      return new Promise<Buffer>((resolve, reject) => {
        crypto.pbkdf2(
          keyMaterial,
          salt,
          UserEncryptionService.KEY_DERIVATION_ITERATIONS,
          UserEncryptionService.KEY_LENGTH,
          'sha256',
          (err, derivedKey) => {
            if (err) {
              reject(err);
            } else {
              resolve(derivedKey);
            }
          }
        );
      });
    } catch (error) {
      throw new EncryptionError(
        'Failed to derive user encryption key',
        EncryptionErrorCodes.INVALID_KEY,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Validate user credentials for encryption operations
   * @param userPassword - User's password (minimum 8 characters)
   * @param userId - User's unique identifier
   * @throws {EncryptionError} When credentials are invalid
   */
  private validateUserCredentials(userPassword: string, userId: string): void {
    if (!userPassword || typeof userPassword !== 'string' || userPassword.length < UserEncryptionService.MIN_PASSWORD_LENGTH) {
      throw new EncryptionError(
        `Invalid user password for encryption. Minimum length: ${UserEncryptionService.MIN_PASSWORD_LENGTH} characters.`,
        EncryptionErrorCodes.INVALID_KEY
      );
    }

    if (!userId || typeof userId !== 'string' || userId.length < 1) {
      throw new EncryptionError(
        'Invalid user ID for encryption',
        EncryptionErrorCodes.INVALID_KEY
      );
    }
  }



  // Standard IEncryptionService methods (not used for user encryption)
  encrypt(_plaintext: string): string {
    throw new EncryptionError(
      'UserEncryptionService requires user credentials. Use encryptWithUserKey(plaintext, userPassword, userId) instead.',
      EncryptionErrorCodes.ENCRYPTION_FAILED
    );
  }

  async encryptAsync(_plaintext: string): Promise<string> {
    throw new EncryptionError(
      'UserEncryptionService requires user credentials. Use encryptWithUserKey(plaintext, userPassword, userId) instead.',
      EncryptionErrorCodes.ENCRYPTION_FAILED
    );
  }

  decrypt(_encryptedData: string): string {
    throw new EncryptionError(
      'UserEncryptionService requires user credentials. Use decryptWithUserKey(encryptedData, userPassword, userId) instead.',
      EncryptionErrorCodes.DECRYPTION_FAILED
    );
  }

  async decryptAsync(_encryptedData: string): Promise<string> {
    throw new EncryptionError(
      'UserEncryptionService requires user credentials. Use decryptWithUserKey(encryptedData, userPassword, userId) instead.',
      EncryptionErrorCodes.DECRYPTION_FAILED
    );
  }

  hashSensitiveData(data: string, salt?: string): string {
    // Delegate to existing hashing service
    const { HashingService } = require('./hashingService');
    return HashingService.hashSensitiveData(data, salt);
  }

  verifyHashedData(data: string, hashedData: string): boolean {
    // Delegate to existing hashing service
    const { HashingService } = require('./hashingService');
    return HashingService.verifyHashedData(data, hashedData);
  }

  getPerformanceMetrics() {
    return this.performanceTracker.getMetrics();
  }

  resetPerformanceMetrics() {
    this.performanceTracker.reset();
  }
}

// Named export helper for easier mocking in tests
export const isUserEncrypted = (encryptedData: string) => UserEncryptionService.isUserEncrypted(encryptedData);
