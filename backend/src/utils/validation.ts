/**
 * Validation utility functions
 */

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates if a string is a valid UUID
 */
export function validateUUID(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  return UUID_REGEX.test(value);
}

/**
 * Type guard for UUID validation with better error messages
 */
export function assertValidUUID(value: unknown, fieldName = 'value'): asserts value is string {
  if (!validateUUID(value)) {
    throw new Error(`${fieldName} must be a valid UUID format`);
  }
}

/**
 * Validates if a string is a valid email address
 */
export function validateEmail(email: string): boolean {
  if (typeof email !== 'string') {
    return false;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates if a string is a valid ZIP code (US format)
 */
export function validateZipCode(zipCode: string): boolean {
  if (typeof zipCode !== 'string') {
    return false;
  }
  const zipRegex = /^\d{5}(-\d{4})?$/;
  return zipRegex.test(zipCode);
}

/**
 * Validates if a string is a valid slug (lowercase, alphanumeric, hyphens)
 */
export function validateSlug(slug: string): boolean {
  if (typeof slug !== 'string') {
    return false;
  }
  const slugRegex = /^[a-z0-9-]+$/;
  return slugRegex.test(slug);
}

/**
 * Validates if a value is a positive number
 */
export function validatePositiveNumber(value: any): boolean {
  const num = Number(value);
  return !isNaN(num) && num > 0;
}

/**
 * Validates if a value is a non-negative number
 */
export function validateNonNegativeNumber(value: any): boolean {
  const num = Number(value);
  return !isNaN(num) && num >= 0;
}

/**
 * Validates if a string meets minimum and maximum length requirements
 */
export function validateStringLength(value: string, minLength: number = 0, maxLength: number = Infinity): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  return value.length >= minLength && value.length <= maxLength;
}

/**
 * Validates if an array contains only valid UUIDs
 */
export function validateUUIDArray(values: any[]): boolean {
  if (!Array.isArray(values)) {
    return false;
  }
  return values.every(value => validateUUID(value));
}

/**
 * Validates if a value is one of the allowed enum values
 */
export function validateEnum<T extends string | number>(value: unknown, allowedValues: readonly T[]): value is T {
  return allowedValues.includes(value as T);
}

/**
 * Validates request parameters with proper error handling
 */
export function validateRequestParam(
  paramValue: string | undefined,
  paramName: string,
  validator: (value: string) => boolean = (value) => Boolean(value)
): { isValid: boolean; value?: string; error?: string } {
  if (!paramValue) {
    return {
      isValid: false,
      error: `${paramName} is required`
    };
  }

  if (!validator(paramValue)) {
    return {
      isValid: false,
      error: `Invalid ${paramName} format`
    };
  }

  return {
    isValid: true,
    value: paramValue
  };
}

/**
 * Validates if a phone number is in a valid format
 */
export function validatePhoneNumber(phone: string): boolean {
  if (typeof phone !== 'string') {
    return false;
  }
  // Basic phone number validation (US format)
  const phoneRegex = /^\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/;
  return phoneRegex.test(phone);
}

/**
 * Validates if a URL is in a valid format
 */
export function validateURL(url: string): boolean {
  if (typeof url !== 'string') {
    return false;
  }
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitizes a string by trimming whitespace and removing null bytes
 */
export function sanitizeString(value: string): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().replace(/\0/g, '');
}

/**
 * Validates and sanitizes an object for JSON storage
 */
export function validateAndSanitizeJSON(value: any): any {
  try {
    // Ensure it's serializable
    const serialized = JSON.stringify(value);
    return JSON.parse(serialized);
  } catch {
    return {};
  }
}