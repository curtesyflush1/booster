// Main exports for the encryption module
export { AESEncryptionService } from './aesEncryption';
export { HashingService } from './hashingService';
export { DataSanitizer } from './dataSanitizer';
export { EncryptionKeyManager, generateEncryptionKey, resetEncryptionManager } from './keyManager';
export { EncryptionValidator } from './validator';
export { EncryptionErrorHandler } from './errorHandler';
export { EncryptionPerformanceTracker } from './performanceTracker';
export { 
  IEncryptionService, 
  EncryptionError, 
  EncryptionErrorCodes,
  EncryptionConstants,
  type EncryptionErrorCode 
} from './types';

import { AESEncryptionService } from './aesEncryption';
import { DataSanitizer } from './dataSanitizer';
import { EncryptionKeyManager } from './keyManager';
import { IEncryptionService } from './types';

// Factory function for creating encryption service
export function createEncryptionService(): IEncryptionService {
  return new AESEncryptionService();
}

// Convenience functions that maintain backward compatibility
export function encrypt(plaintext: string): string {
  const service = new AESEncryptionService();
  return service.encrypt(plaintext);
}

export function decrypt(encryptedData: string): string {
  const service = new AESEncryptionService();
  return service.decrypt(encryptedData);
}

export function hashSensitiveData(data: string, salt?: string): string {
  const service = new AESEncryptionService();
  return service.hashSensitiveData(data, salt);
}

export function verifyHashedData(data: string, hashedData: string): boolean {
  const service = new AESEncryptionService();
  return service.verifyHashedData(data, hashedData);
}

export function sanitizeForLogging(data: any): any {
  return DataSanitizer.sanitizeForLogging(data);
}

export function clearKeyCache(): void {
  const manager = EncryptionKeyManager.getInstance();
  manager.clearCache();
  // Also reset the singleton instance to force re-creation
  EncryptionKeyManager.resetInstance();
}