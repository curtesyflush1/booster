import { EncryptionError, EncryptionErrorCodes } from './types';

export class EncryptionErrorHandler {
  static handleEncryptionError(error: unknown, operation: 'encrypt' | 'decrypt', context?: Record<string, unknown>): never {
    // Re-throw existing EncryptionErrors
    if (error instanceof EncryptionError) {
      throw error;
    }

    // Handle key-related errors specifically
    if (error instanceof Error && error.message.includes('ENCRYPTION_KEY')) {
      throw new EncryptionError(
        error.message,
        EncryptionErrorCodes.INVALID_KEY,
        { originalError: error.message, ...context }
      );
    }

    // Handle operation-specific errors
    const errorCode = operation === 'encrypt' 
      ? EncryptionErrorCodes.ENCRYPTION_FAILED 
      : EncryptionErrorCodes.DECRYPTION_FAILED;
    
    const message = operation === 'encrypt' 
      ? 'Failed to encrypt data' 
      : 'Failed to decrypt data';

    throw new EncryptionError(
      message,
      errorCode,
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        ...context
      }
    );
  }
}