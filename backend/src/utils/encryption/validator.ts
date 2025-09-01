import { EncryptionError, EncryptionErrorCodes, EncryptionConstants } from './types';

export class EncryptionValidator {
  static validatePlaintext(plaintext: unknown): asserts plaintext is string {
    if (typeof plaintext !== 'string') {
      throw new EncryptionError(
        'Plaintext must be a string',
        EncryptionErrorCodes.INVALID_INPUT,
        { type: typeof plaintext }
      );
    }
    
    // Disallow empty plaintext to avoid creating meaningless ciphertext
    if (plaintext.length === 0) {
      throw new EncryptionError(
        'Plaintext must be a non-empty string',
        EncryptionErrorCodes.INVALID_INPUT,
        { length: 0 }
      );
    }
    
    if (plaintext.length > EncryptionConstants.MAX_PLAINTEXT_SIZE) {
      throw new EncryptionError(
        `Plaintext too large for encryption (max ${EncryptionConstants.MAX_PLAINTEXT_SIZE} bytes)`,
        EncryptionErrorCodes.INVALID_INPUT,
        { length: plaintext.length, maxSize: EncryptionConstants.MAX_PLAINTEXT_SIZE }
      );
    }
  }

  static validateEncryptedData(encryptedData: unknown): asserts encryptedData is string {
    if (typeof encryptedData !== 'string' || encryptedData.length === 0) {
      throw new EncryptionError(
        'Invalid encrypted data: must be a non-empty string',
        EncryptionErrorCodes.INVALID_INPUT,
        { type: typeof encryptedData, length: typeof encryptedData === 'string' ? encryptedData.length : 0 }
      );
    }
  }

  static validateHashData(data: unknown): asserts data is string {
    if (typeof data !== 'string') {
      throw new EncryptionError(
        'Hash data must be a string',
        EncryptionErrorCodes.INVALID_INPUT,
        { type: typeof data }
      );
    }
  }

  static validateSalt(salt: unknown): asserts salt is string {
    if (typeof salt !== 'string' || salt.length === 0) {
      throw new EncryptionError(
        'Salt must be a non-empty string',
        EncryptionErrorCodes.INVALID_INPUT,
        { type: typeof salt, length: typeof salt === 'string' ? salt.length : 0 }
      );
    }
  }
}
