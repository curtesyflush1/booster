import { EncryptionErrorHandler } from '../../src/utils/encryption/errorHandler';
import { EncryptionError, EncryptionErrorCodes } from '../../src/utils/encryption/types';

describe('EncryptionErrorHandler', () => {
  describe('handleEncryptionError', () => {
    it('should re-throw existing EncryptionError', () => {
      const originalError = new EncryptionError(
        'Original error',
        EncryptionErrorCodes.INVALID_INPUT
      );

      expect(() => {
        EncryptionErrorHandler.handleEncryptionError(originalError, 'encrypt');
      }).toThrow(originalError);
    });

    it('should handle key-related errors specifically', () => {
      const keyError = new Error('ENCRYPTION_KEY environment variable is required');

      expect(() => {
        EncryptionErrorHandler.handleEncryptionError(keyError, 'encrypt');
      }).toThrow(EncryptionError);

      try {
        EncryptionErrorHandler.handleEncryptionError(keyError, 'encrypt');
      } catch (error) {
        expect(error).toBeInstanceOf(EncryptionError);
        expect((error as EncryptionError).code).toBe(EncryptionErrorCodes.INVALID_KEY);
        expect((error as EncryptionError).message).toBe(keyError.message);
      }
    });

    it('should handle encryption operation errors', () => {
      const genericError = new Error('Some crypto error');

      expect(() => {
        EncryptionErrorHandler.handleEncryptionError(genericError, 'encrypt', { test: 'context' });
      }).toThrow(EncryptionError);

      try {
        EncryptionErrorHandler.handleEncryptionError(genericError, 'encrypt', { test: 'context' });
      } catch (error) {
        expect(error).toBeInstanceOf(EncryptionError);
        expect((error as EncryptionError).code).toBe(EncryptionErrorCodes.ENCRYPTION_FAILED);
        expect((error as EncryptionError).message).toBe('Failed to encrypt data');
        expect((error as EncryptionError).context).toEqual({
          error: 'Some crypto error',
          test: 'context'
        });
      }
    });

    it('should handle decryption operation errors', () => {
      const genericError = new Error('Decryption failed');

      expect(() => {
        EncryptionErrorHandler.handleEncryptionError(genericError, 'decrypt');
      }).toThrow(EncryptionError);

      try {
        EncryptionErrorHandler.handleEncryptionError(genericError, 'decrypt');
      } catch (error) {
        expect(error).toBeInstanceOf(EncryptionError);
        expect((error as EncryptionError).code).toBe(EncryptionErrorCodes.DECRYPTION_FAILED);
        expect((error as EncryptionError).message).toBe('Failed to decrypt data');
      }
    });

    it('should handle unknown error types', () => {
      const unknownError = 'string error';

      expect(() => {
        EncryptionErrorHandler.handleEncryptionError(unknownError, 'encrypt');
      }).toThrow(EncryptionError);

      try {
        EncryptionErrorHandler.handleEncryptionError(unknownError, 'encrypt');
      } catch (error) {
        expect(error).toBeInstanceOf(EncryptionError);
        expect((error as EncryptionError).context?.error).toBe('Unknown error');
      }
    });
  });
});