/**
 * Key Management Service (KMS) Types and Interfaces
 * 
 * This module defines the interfaces and types for integrating with various
 * Key Management Services like AWS KMS, Google Cloud KMS, and HashiCorp Vault.
 */

export interface IKeyManagementService {
  /**
   * Retrieve an encryption key from the KMS
   * @param keyId - The identifier for the key in the KMS
   * @param version - Optional key version (for versioned keys)
   * @returns Promise<Buffer> - The encryption key as a Buffer
   */
  getKey(keyId: string, version?: string): Promise<Buffer>;

  /**
   * Create a new encryption key in the KMS
   * @param keyId - The identifier for the new key
   * @param description - Optional description for the key
   * @param keySpec - Key specification (e.g., 'AES_256', 'RSA_2048')
   * @returns Promise<string> - The key ID or ARN of the created key
   */
  createKey(keyId: string, description?: string, keySpec?: string): Promise<string>;

  /**
   * Rotate an existing key in the KMS
   * @param keyId - The identifier for the key to rotate
   * @returns Promise<string> - The new key version or ID
   */
  rotateKey(keyId: string): Promise<string>;

  /**
   * Enable or disable a key (optional for lightweight providers)
   * @param keyId - The identifier for the key
   * @param enabled - Whether to enable or disable the key
   * @returns Promise<void>
   */
  setKeyEnabled?(keyId: string, enabled: boolean): Promise<void>;

  /**
   * Delete a key (schedule for deletion) - optional
   * @param keyId - The identifier for the key to delete
   * @param pendingWindowInDays - Days to wait before deletion (7-30)
   * @returns Promise<Date> - The scheduled deletion date
   */
  scheduleKeyDeletion?(keyId: string, pendingWindowInDays?: number): Promise<Date>;

  /**
   * Cancel a scheduled key deletion - optional
   * @param keyId - The identifier for the key
   * @returns Promise<void>
   */
  cancelKeyDeletion?(keyId: string): Promise<void>;

  /**
   * List all keys accessible to the service - optional
   * @param limit - Maximum number of keys to return
   * @param marker - Pagination marker for large result sets
   * @returns Promise<KeyListResult> - List of keys with pagination info
   */
  listKeys?(limit?: number, marker?: string): Promise<KeyListResult>;

  /**
   * Check if the KMS service is available and accessible
   * @returns Promise<boolean> - True if the service is healthy
   */
  healthCheck(): Promise<boolean>;

  /**
   * Get metadata about a key without retrieving the key material
   * @param keyId - The identifier for the key
   * @returns Promise<KeyMetadata> - Metadata about the key
   */
  getKeyMetadata(keyId: string): Promise<KeyMetadata>;
}

export interface KeyMetadata {
  keyId: string;
  arn?: string; // AWS ARN or equivalent identifier
  description?: string;
  createdAt: Date;
  lastRotated?: Date;
  enabled: boolean;
  keyUsage: 'ENCRYPT_DECRYPT' | 'SIGN_VERIFY';
  keySpec: string;
  keyState: KeyState;
  deletionDate?: Date;
  validTo?: Date; // Key expiration date
  origin: 'AWS_KMS' | 'EXTERNAL' | 'AWS_CLOUDHSM' | 'GCP_KMS' | 'VAULT' | 'ENV';
  tags?: Record<string, string>;
}

export interface KeyListResult {
  keys: KeySummary[];
  nextMarker?: string;
  truncated: boolean;
}

export interface KeySummary {
  keyId: string;
  arn?: string;
  description?: string;
  enabled: boolean;
  keyUsage: 'ENCRYPT_DECRYPT' | 'SIGN_VERIFY';
  keyState: KeyState;
  createdAt: Date;
}

export enum KeyState {
  CREATING = 'Creating',
  ENABLED = 'Enabled',
  DISABLED = 'Disabled',
  PENDING_DELETION = 'PendingDeletion',
  PENDING_IMPORT = 'PendingImport',
  UNAVAILABLE = 'Unavailable',
  UPDATING = 'Updating'
}

export interface KMSConfig {
  provider: KMSProvider;
  region?: string;
  endpoint?: string;
  credentials?: KMSCredentials;
  keyId: string;
  timeout?: number; // Timeout in milliseconds (default: 30000)
  retryAttempts?: number; // Number of retry attempts (default: 3)
  retryDelay?: number; // Base delay between retries in ms (default: 1000)
  maxRetryDelay?: number; // Maximum retry delay in ms (default: 30000)
  enableLogging?: boolean; // Enable debug logging (default: false)
  cacheKeys?: boolean; // Cache retrieved keys in memory (default: false)
  cacheTTL?: number; // Cache TTL in milliseconds (default: 300000 - 5 minutes)
}

export type KMSProvider = 'aws' | 'gcp' | 'vault' | 'env';

export interface KMSCredentials {
  // AWS credentials
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  
  // GCP credentials
  projectId?: string;
  keyFile?: string;
  clientEmail?: string;
  privateKey?: string;
  
  // HashiCorp Vault credentials
  token?: string;
  roleId?: string;
  secretId?: string;
  
  // Environment-based credentials
  envPrefix?: string; // Prefix for environment variables (default: 'KMS_')
}

export interface KMSConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface KMSError extends Error {
  code: string;
  provider: string;
  keyId?: string;
  retryable: boolean;
  context?: Record<string, any>;
  timestamp: Date;
  correlationId?: string;
}

export enum KMSErrorCodes {
  // Key-related errors
  KEY_NOT_FOUND = 'KEY_NOT_FOUND',
  KEY_DISABLED = 'KEY_DISABLED',
  KEY_PENDING_DELETION = 'KEY_PENDING_DELETION',
  KEY_UNAVAILABLE = 'KEY_UNAVAILABLE',
  INVALID_KEY_FORMAT = 'INVALID_KEY_FORMAT',
  KEY_USAGE_MISMATCH = 'KEY_USAGE_MISMATCH',
  
  // Authentication and authorization errors
  ACCESS_DENIED = 'ACCESS_DENIED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  
  // Service and network errors
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMITED = 'RATE_LIMITED',
  
  // Configuration errors
  INVALID_CONFIGURATION = 'INVALID_CONFIGURATION',
  MISSING_CONFIGURATION = 'MISSING_CONFIGURATION',
  UNSUPPORTED_PROVIDER = 'UNSUPPORTED_PROVIDER',
  UNSUPPORTED_OPERATION = 'UNSUPPORTED_OPERATION',
  
  // Validation errors
  INVALID_PARAMETER = 'INVALID_PARAMETER',
  PARAMETER_OUT_OF_RANGE = 'PARAMETER_OUT_OF_RANGE',
  
  // Internal errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',
  DECRYPTION_FAILED = 'DECRYPTION_FAILED'
}

export class KMSServiceError extends Error implements KMSError {
  public readonly code: string;
  public readonly provider: string;
  public readonly keyId?: string;
  public readonly retryable: boolean;
  public readonly context?: Record<string, any>;
  public readonly timestamp: Date;
  public readonly correlationId?: string;

  constructor(
    message: string,
    code: KMSErrorCodes,
    provider: string,
    options: {
      retryable?: boolean;
      keyId?: string;
      context?: Record<string, any>;
      correlationId?: string;
      cause?: Error;
    } = {}
  ) {
    super(message);
    this.name = 'KMSServiceError';
    this.code = code;
    this.provider = provider;
    this.keyId = options.keyId;
    this.retryable = options.retryable ?? KMSServiceError.isRetryableByDefault(code);
    this.context = options.context;
    this.timestamp = new Date();
    this.correlationId = options.correlationId;
    
    // Preserve the original error stack if provided
    if (options.cause) {
      this.stack = `${this.stack}\nCaused by: ${options.cause.stack}`;
    }
  }

  /**
   * Determine if an error code is retryable by default
   */
  private static isRetryableByDefault(code: KMSErrorCodes): boolean {
    const retryableCodes = [
      KMSErrorCodes.SERVICE_UNAVAILABLE,
      KMSErrorCodes.NETWORK_ERROR,
      KMSErrorCodes.TIMEOUT,
      KMSErrorCodes.RATE_LIMITED,
      KMSErrorCodes.INTERNAL_ERROR
    ];
    return retryableCodes.includes(code);
  }

  /**
   * Create a user-friendly error message
   */
  public toUserMessage(): string {
    switch (this.code) {
      case KMSErrorCodes.KEY_NOT_FOUND:
        return 'The requested encryption key was not found.';
      case KMSErrorCodes.ACCESS_DENIED:
        return 'Access denied. Please check your credentials and permissions.';
      case KMSErrorCodes.SERVICE_UNAVAILABLE:
        return 'The key management service is temporarily unavailable. Please try again later.';
      case KMSErrorCodes.RATE_LIMITED:
        return 'Too many requests. Please wait a moment before trying again.';
      default:
        return 'An error occurred while accessing the key management service.';
    }
  }

  /**
   * Get retry delay based on error type
   */
  public getRetryDelay(attempt: number): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    
    switch (this.code) {
      case KMSErrorCodes.RATE_LIMITED:
        return Math.min(baseDelay * Math.pow(2, attempt) * 2, maxDelay); // Longer delay for rate limiting
      case KMSErrorCodes.SERVICE_UNAVAILABLE:
      case KMSErrorCodes.NETWORK_ERROR:
        return Math.min(baseDelay * Math.pow(2, attempt), maxDelay); // Exponential backoff
      default:
        return baseDelay;
    }
  }
}

// Utility types for better type safety
export type KMSOperation = 
  | 'getKey'
  | 'createKey'
  | 'rotateKey'
  | 'setKeyEnabled'
  | 'scheduleKeyDeletion'
  | 'cancelKeyDeletion'
  | 'listKeys'
  | 'getKeyMetadata'
  | 'healthCheck';

export type KeyUsage = 'ENCRYPT_DECRYPT' | 'SIGN_VERIFY';

export type KeyOrigin = 'AWS_KMS' | 'EXTERNAL' | 'AWS_CLOUDHSM' | 'GCP_KMS' | 'VAULT' | 'ENV';

// Constants for configuration validation and defaults
export const KMS_CONSTANTS = {
  DEFAULT_TIMEOUT: 30000, // 30 seconds
  DEFAULT_RETRY_ATTEMPTS: 3,
  DEFAULT_RETRY_DELAY: 1000, // 1 second
  MAX_RETRY_DELAY: 30000, // 30 seconds
  DEFAULT_CACHE_TTL: 300000, // 5 minutes
  MIN_DELETION_WINDOW: 7, // days
  MAX_DELETION_WINDOW: 30, // days
  MAX_KEY_LIST_LIMIT: 1000,
  DEFAULT_KEY_LIST_LIMIT: 100,
  
  // Key specifications
  SUPPORTED_KEY_SPECS: [
    'AES_128',
    'AES_256',
    'RSA_2048',
    'RSA_3072',
    'RSA_4096',
    'ECC_NIST_P256',
    'ECC_NIST_P384',
    'ECC_NIST_P521',
    'ECC_SECG_P256K1'
  ] as const,
  
  // Environment variable names
  ENV_VARS: {
    AWS_ACCESS_KEY_ID: 'AWS_ACCESS_KEY_ID',
    AWS_SECRET_ACCESS_KEY: 'AWS_SECRET_ACCESS_KEY',
    AWS_SESSION_TOKEN: 'AWS_SESSION_TOKEN',
    AWS_REGION: 'AWS_REGION',
    GCP_PROJECT_ID: 'GCP_PROJECT_ID',
    GCP_KEY_FILE: 'GCP_KEY_FILE',
    VAULT_TOKEN: 'VAULT_TOKEN',
    VAULT_ADDR: 'VAULT_ADDR'
  } as const
} as const;

// Type for supported key specifications
export type KeySpec = typeof KMS_CONSTANTS.SUPPORTED_KEY_SPECS[number];

// Helper type for KMS operation results
export type KMSOperationResult<T> = {
  success: true;
  data: T;
  metadata?: {
    provider: KMSProvider;
    operation: KMSOperation;
    duration: number;
    timestamp: Date;
    correlationId?: string;
  };
} | {
  success: false;
  error: KMSServiceError;
  metadata?: {
    provider: KMSProvider;
    operation: KMSOperation;
    duration: number;
    timestamp: Date;
    correlationId?: string;
  };
};

// Interface for KMS metrics and monitoring
export interface KMSMetrics {
  operationCount: Record<KMSOperation, number>;
  errorCount: Record<KMSErrorCodes, number>;
  averageResponseTime: Record<KMSOperation, number>;
  lastHealthCheck: Date;
  isHealthy: boolean;
  uptime: number;
  cacheHitRate?: number;
  activeConnections?: number;
}