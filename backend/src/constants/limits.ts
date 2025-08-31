/**
 * Limits and constraints used throughout the application
 * 
 * This file contains all validation limits, rate limits, and system constraints
 * organized by domain for better maintainability and type safety.
 */

// Type definitions for validation results
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
  value?: any;
  suggestion?: string;
}

export interface LengthValidationOptions {
  min?: number;
  max?: number;
  fieldName?: string;
}

// Validation error codes for consistent error handling
export const VALIDATION_ERROR_CODES = {
  REQUIRED_FIELD: 'REQUIRED_FIELD',
  LENGTH_TOO_SHORT: 'LENGTH_TOO_SHORT',
  LENGTH_TOO_LONG: 'LENGTH_TOO_LONG',
  INVALID_FORMAT: 'INVALID_FORMAT',
  OUT_OF_RANGE: 'OUT_OF_RANGE',
  INVALID_UPC: 'INVALID_UPC',
  INVALID_PRICE: 'INVALID_PRICE',
} as const;

// Pagination limits
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_PAGE: 1000,
  MAX_LIMIT: 100,
  EXPORT_LIMIT: 10000, // Large limit for CSV exports
} as const;

// Rate limiting
export const RATE_LIMITS = {
  // General API limits
  GENERAL_MAX_REQUESTS: 110, // +10% to reduce accidental throttling during browsing
  
  // Authentication limits
  AUTH_MAX_ATTEMPTS: 5,
  PASSWORD_RESET_MAX_ATTEMPTS: 3,
  REGISTRATION_MAX_ATTEMPTS: 3,
  
  // Dashboard limits
  DASHBOARD_MAX_REQUESTS: 30,
  
  // ML endpoint limits (more restrictive due to computational cost)
  ML_MAX_REQUESTS: 20,
  
  // Notification limits
  NOTIFICATION_MAX_REQUESTS: 50,
  
  // Price comparison limits
  PRICE_COMPARISON_MAX_REQUESTS: 100,
  PRICE_COMPARISON_BATCH_MAX_REQUESTS: 20,
  PRICE_COMPARISON_HISTORY_MAX_REQUESTS: 50,
  PRICE_COMPARISON_DEALS_MAX_REQUESTS: 30,
  PRICE_COMPARISON_TRENDS_MAX_REQUESTS: 50,
  PRICE_COMPARISON_USER_DEALS_MAX_REQUESTS: 60,
  
  // Retailer API limits
  RETAILER_MAX_REQUESTS: 100,
} as const;

// File upload limits
export const FILE_LIMITS = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  CSV_MAX_ROWS: 10000,
  CSV_MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
} as const;

/**
 * Product validation limits
 * Used for validating Pokémon TCG product data including names, descriptions, and metadata
 * 
 * @example
 * ```typescript
 * const validation = ValidationUtils.validateLength(
 *   productName, 
 *   { max: PRODUCT_LIMITS.MAX_NAME_LENGTH, fieldName: 'product_name' }
 * );
 * ```
 */
export const PRODUCT_LIMITS = {
  /** Maximum length for product names (e.g., "Pokémon TCG: Scarlet & Violet Booster Pack") */
  MAX_NAME_LENGTH: 255,
  /** Maximum length for URL-friendly product slugs */
  MAX_SLUG_LENGTH: 255,
  /** Maximum length for TCG set names (e.g., "Scarlet & Violet") */
  MAX_SET_NAME_LENGTH: 255,
  /** Maximum length for TCG series names (e.g., "Sword & Shield Series") */
  MAX_SERIES_LENGTH: 255,
  /** Maximum length for product descriptions */
  MAX_DESCRIPTION_LENGTH: 1000,
  /** Maximum length for product image URLs */
  MAX_IMAGE_URL_LENGTH: 500,
  /** Maximum popularity score (0-1000 scale) */
  MAX_POPULARITY_SCORE: 1000,
  /** Minimum popularity score */
  MIN_POPULARITY_SCORE: 0,
  /** Maximum sort order value for product display */
  MAX_SORT_ORDER: 9999,
  /** Minimum sort order value */
  MIN_SORT_ORDER: 0,
  /** Minimum UPC barcode length (8 digits for UPC-E) */
  MIN_UPC_LENGTH: 8,
  /** Maximum UPC barcode length (14 digits for GTIN-14) */
  MAX_UPC_LENGTH: 14,
} as const;

// User validation limits
export const USER_LIMITS = {
  MAX_FIRST_NAME_LENGTH: 50,
  MAX_LAST_NAME_LENGTH: 50,
  MAX_TIMEZONE_LENGTH: 50,
  MIN_ZIP_CODE_LENGTH: 5,
  MAX_ZIP_CODE_LENGTH: 10,
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 128,
  MAX_FAILED_LOGIN_ATTEMPTS: 5,
  BCRYPT_SALT_ROUNDS: 12,
} as const;

// Watch pack validation limits
export const WATCH_PACK_LIMITS = {
  MAX_NAME_LENGTH: 100,
  MAX_SLUG_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 1000,
} as const;

// Price validation limits
export const PRICE_LIMITS = {
  MAX_PRICE: 999999.99,
  MIN_PRICE: 0,
} as const;

// System operation limits
export const SYSTEM_LIMITS = {
  MAX_RADIUS_MILES: 500,
  MIN_RADIUS_MILES: 1,
  MAX_RETRY_COUNT: 10,
  MIN_RETRY_COUNT: 0,
} as const;

// SMS validation limits
export const SMS_LIMITS = {
  MAX_SMS_LENGTH: 160,
  MAX_SMS_PRODUCT_NAME_LENGTH: 40,
} as const;

// Backward compatibility aliases for WatchPack limits
const BACKCOMPAT_WATCH_PACK_LIMITS = {
  MAX_WATCH_PACK_NAME_LENGTH: WATCH_PACK_LIMITS.MAX_NAME_LENGTH,
  MAX_WATCH_PACK_SLUG_LENGTH: WATCH_PACK_LIMITS.MAX_SLUG_LENGTH, 
  MAX_WATCH_PACK_DESCRIPTION_LENGTH: WATCH_PACK_LIMITS.MAX_DESCRIPTION_LENGTH,
} as const;

// Legacy export for backward compatibility - TODO: Remove after migration
export const VALIDATION_LIMITS = {
  ...PRODUCT_LIMITS,
  ...USER_LIMITS,
  ...WATCH_PACK_LIMITS,
  ...BACKCOMPAT_WATCH_PACK_LIMITS,
  ...PRICE_LIMITS,
  ...SYSTEM_LIMITS,
  ...SMS_LIMITS,
} as const;

// Cache limits
export const CACHE_LIMITS = {
  DEFAULT_HISTORY_LIMIT: 100,
} as const;

// Analytics limits
export const ANALYTICS_LIMITS = {
  DEFAULT_BATCH_SIZE: 10,
  DEFAULT_MAX_QUEUE_SIZE: 1000,
  METRICS_RETENTION_HOURS: 24,
} as const;

// Social media limits
export const SOCIAL_MEDIA_LIMITS = {
  TWITTER_CHARACTER_LIMIT: 280,
  INSTAGRAM_CHARACTER_LIMIT: 2200,
  DISCORD_CHARACTER_LIMIT: 2000,
  TELEGRAM_CHARACTER_LIMIT: 4096,
  LINKEDIN_CHARACTER_LIMIT: 3000,
} as const;

// Retailer rate limiting
export const RETAILER_RATE_LIMITS = {
  // Minimum intervals between requests (milliseconds)
  BASE_REQUEST_INTERVAL: 60000, // 1 minute base
  SCRAPING_MIN_INTERVAL: 2000,  // 2 seconds minimum for scraping
} as const;

/**
 * Environment-specific limit overrides
 * Allows customization of limits based on NODE_ENV or specific environment variables
 */
export const EnvironmentLimits = {
  /**
   * Get environment-adjusted limits for rate limiting
   */
  getRateLimits(): any {
    const env = process.env.NODE_ENV;
    const baseLimits = { ...RATE_LIMITS };
    
    // Increase limits for development/testing
    if (env === 'development' || env === 'test') {
      return {
        ...baseLimits,
        GENERAL_MAX_REQUESTS: baseLimits.GENERAL_MAX_REQUESTS * 2,
        ML_MAX_REQUESTS: baseLimits.ML_MAX_REQUESTS * 3,
      };
    }
    
    // Custom overrides from environment variables
    if (process.env.RATE_LIMIT_MULTIPLIER) {
      const multiplier = parseFloat(process.env.RATE_LIMIT_MULTIPLIER);
      if (!isNaN(multiplier) && multiplier > 0) {
        Object.keys(baseLimits).forEach(key => {
          (baseLimits as any)[key] = Math.floor((baseLimits as any)[key] * multiplier);
        });
      }
    }
    
    return baseLimits;
  },

  /**
   * Get environment-adjusted file limits
   */
  getFileLimits(): typeof FILE_LIMITS {
    const baseLimits = { ...FILE_LIMITS };
    
    // Allow larger files in development
    if (process.env.NODE_ENV === 'development') {
      return {
        ...baseLimits,
        MAX_FILE_SIZE: baseLimits.MAX_FILE_SIZE * 2,
        CSV_MAX_FILE_SIZE: baseLimits.CSV_MAX_FILE_SIZE * 2,
      };
    }
    
    return baseLimits;
  }
} as const;

// Validation utility functions
export const ValidationUtils = {
  /**
   * Validate string length against limits with detailed error information
   */
  validateLength(
    value: string | null | undefined,
    options: LengthValidationOptions
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const fieldName = options.fieldName || 'field';
    
    if (!value) {
      if (options.min && options.min > 0) {
        errors.push({
          code: VALIDATION_ERROR_CODES.REQUIRED_FIELD,
          message: `${fieldName} is required`,
          field: fieldName,
          value,
          suggestion: `Please provide a value for ${fieldName}`
        });
      }
      return { isValid: errors.length === 0, errors };
    }
    
    if (options.min !== undefined && value.length < options.min) {
      errors.push({
        code: VALIDATION_ERROR_CODES.LENGTH_TOO_SHORT,
        message: `${fieldName} must be at least ${options.min} characters`,
        field: fieldName,
        value,
        suggestion: `Current length: ${value.length}. Add ${options.min - value.length} more characters.`
      });
    }
    
    if (options.max !== undefined && value.length > options.max) {
      errors.push({
        code: VALIDATION_ERROR_CODES.LENGTH_TOO_LONG,
        message: `${fieldName} must not exceed ${options.max} characters`,
        field: fieldName,
        value,
        suggestion: `Current length: ${value.length}. Remove ${value.length - options.max} characters.`
      });
    }
    
    return { isValid: errors.length === 0, errors };
  },

  /**
   * Validate numeric value against range
   */
  validateRange(
    value: number | null | undefined,
    min: number,
    max: number,
    fieldName = 'value'
  ): ValidationResult {
    const errors: ValidationError[] = [];
    
    if (value === null || value === undefined) {
      errors.push({
        code: 'REQUIRED_FIELD',
        message: `${fieldName} is required`,
        field: fieldName,
        value
      });
      return { isValid: false, errors };
    }
    
    if (value < min) {
      errors.push({
        code: 'VALUE_TOO_LOW',
        message: `${fieldName} must be at least ${min}`,
        field: fieldName,
        value
      });
    }
    
    if (value > max) {
      errors.push({
        code: 'VALUE_TOO_HIGH',
        message: `${fieldName} must not exceed ${max}`,
        field: fieldName,
        value
      });
    }
    
    return { isValid: errors.length === 0, errors };
  },

  /**
   * Validate UPC code format and length
   */
  validateUPC(upc: string | null | undefined): ValidationResult {
    const errors: ValidationError[] = [];
    
    if (!upc) {
      errors.push({
        code: 'REQUIRED_FIELD',
        message: 'UPC is required',
        field: 'upc',
        value: upc
      });
      return { isValid: false, errors };
    }
    
    // Remove any non-digit characters for validation
    const cleanUPC = upc.replace(/\D/g, '');
    
    if (cleanUPC.length < PRODUCT_LIMITS.MIN_UPC_LENGTH) {
      errors.push({
        code: 'UPC_TOO_SHORT',
        message: `UPC must be at least ${PRODUCT_LIMITS.MIN_UPC_LENGTH} digits`,
        field: 'upc',
        value: upc
      });
    }
    
    if (cleanUPC.length > PRODUCT_LIMITS.MAX_UPC_LENGTH) {
      errors.push({
        code: 'UPC_TOO_LONG',
        message: `UPC must not exceed ${PRODUCT_LIMITS.MAX_UPC_LENGTH} digits`,
        field: 'upc',
        value: upc
      });
    }
    
    return { isValid: errors.length === 0, errors };
  },

  /**
   * Validate price value
   */
  validatePrice(price: number | null | undefined): ValidationResult {
    return this.validateRange(
      price,
      PRICE_LIMITS.MIN_PRICE,
      PRICE_LIMITS.MAX_PRICE,
      'price'
    );
  },

  /**
   * Create a cached validator function for repeated validations
   * Useful for validating many items with the same constraints
   */
  createCachedValidator<T>(
    validatorFn: (value: T) => ValidationResult
  ): (value: T) => ValidationResult {
    const cache = new Map<string, ValidationResult>();
    
    return (value: T): ValidationResult => {
      const key = JSON.stringify(value);
      
      if (cache.has(key)) {
        return cache.get(key)!;
      }
      
      const result = validatorFn(value);
      
      // Only cache successful validations to avoid memory leaks with invalid data
      if (result.isValid) {
        cache.set(key, result);
      }
      
      return result;
    };
  },

  /**
   * Batch validate multiple values with the same constraints
   */
  batchValidate<T>(
    values: T[],
    validatorFn: (value: T) => ValidationResult
  ): { isValid: boolean; results: Array<{ value: T; validation: ValidationResult }> } {
    const results = values.map(value => ({
      value,
      validation: validatorFn(value)
    }));
    
    const isValid = results.every(result => result.validation.isValid);
    
    return { isValid, results };
  }
} as const;
