// Legacy encryption.ts file - now delegates to the new modular structure
// This file maintains backward compatibility while using the improved implementation

export {
  encrypt,
  decrypt,
  hashSensitiveData,
  verifyHashedData,
  sanitizeForLogging,
  generateEncryptionKey,
  clearKeyCache,
  createEncryptionService,
  AESEncryptionService,
  HashingService,
  DataSanitizer,
  EncryptionKeyManager,
  resetEncryptionManager,
  EncryptionValidator,
  EncryptionError,
  EncryptionErrorCodes,
  type IEncryptionService,
  type EncryptionErrorCode
} from './encryption/index';