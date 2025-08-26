export interface IEncryptionService {
  encrypt(plaintext: string): string;
  decrypt(encryptedData: string): string;
  hashSensitiveData(data: string, salt?: string): string;
  verifyHashedData(data: string, hashedData: string): boolean;
}

export interface IAsyncEncryptionService {
  encryptAsync(plaintext: string): Promise<string>;
  decryptAsync(encryptedData: string): Promise<string>;
  hashSensitiveDataAsync(data: string, salt?: string): Promise<string>;
  verifyHashedDataAsync(data: string, hashedData: string): Promise<boolean>;
}

export interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  iterations: number;
  version: string;
}

export class EncryptionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'EncryptionError';
  }
}

export const EncryptionErrorCodes = {
  INVALID_KEY: 'INVALID_KEY',
  KEY_DERIVATION_FAILED: 'KEY_DERIVATION_FAILED',
  ENCRYPTION_FAILED: 'ENCRYPTION_FAILED',
  DECRYPTION_FAILED: 'DECRYPTION_FAILED',
  INVALID_INPUT: 'INVALID_INPUT',
  INVALID_FORMAT: 'INVALID_FORMAT',
  UNSUPPORTED_VERSION: 'UNSUPPORTED_VERSION',
  HASH_VERIFICATION_FAILED: 'HASH_VERIFICATION_FAILED',
  AUTH_TAG_VERIFICATION_FAILED: 'AUTH_TAG_VERIFICATION_FAILED',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR'
} as const;

export type EncryptionErrorCode = typeof EncryptionErrorCodes[keyof typeof EncryptionErrorCodes];

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface EncryptionMetrics {
  encryptionTime: number;
  decryptionTime: number;
  keyDerivationTime: number;
  hashTime: number;
  verifyTime: number;
  operationCount: number;
  lastOperation: Date;
  averageEncryptionTime: number;
  averageDecryptionTime: number;
  averageHashTime: number;
  averageVerifyTime: number;
  slowestOperation: { type: EncryptionOperation; duration: number } | null;
  fastestOperation: { type: EncryptionOperation; duration: number } | null;
}

export type EncryptionOperation = 'encrypt' | 'decrypt' | 'keyDerivation' | 'hash' | 'verify';

export interface PerformanceTracker {
  startTimer(): void;
  endTimer(operation: EncryptionOperation): number;
  getMetrics(): EncryptionMetrics;
  reset(): void;
}

export interface KeyRotationConfig {
  rotationInterval: number;
  maxKeyAge: number;
  gracePeriod: number;
}

export const EncryptionConstants = {
  AES_256_GCM: 'aes-256-gcm',
  IV_LENGTH: 16,
  KEY_LENGTH: 32,
  AUTH_TAG_LENGTH: 16,
  MAX_PLAINTEXT_SIZE: 10000,
  PBKDF2_ITERATIONS: 100000,
  HASH_LENGTH: 64,
  SALT_LENGTH: 32,
  KEY_CACHE_TTL: 5 * 60 * 1000, // 5 minutes
  VERSION_PREFIX: 'v1',
  HASH_ALGORITHM: 'sha512',
  KEY_DERIVATION_SALT: 'booster-beacon-salt'
} as const;