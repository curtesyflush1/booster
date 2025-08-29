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
 * Comprehensive URL parameter sanitization to prevent SQL injection and other attacks
 */
export function sanitizeUrlParameter(value: string): string {
  if (typeof value !== 'string') {
    return '';
  }
  
  // Decode URL encoding first
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch (error) {
    // If decoding fails, use the original string
    decoded = value;
  }
  
  // Remove null bytes, control characters, and potentially dangerous characters
  let sanitized = decoded
    .replace(/\0/g, '') // Remove null bytes
    .replace(/%00/g, '') // Remove URL-encoded null bytes
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/[<>]/g, '') // Remove HTML brackets (but keep quotes for search)
    .replace(/[;\\]/g, '') // Remove SQL injection characters
    .replace(/--/g, '') // Remove SQL comment markers
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/\.\.\//g, '') // Remove path traversal sequences
    .replace(/\.\.\\/g, '') // Remove Windows path traversal sequences
    .replace(/\.\.%2f/gi, '') // Remove URL-encoded path traversal
    .replace(/\.\.%5c/gi, '') // Remove URL-encoded Windows path traversal
    .trim();
  
  // Limit length to prevent buffer overflow attacks
  if (sanitized.length > 200) {
    sanitized = sanitized.substring(0, 200);
  }
  
  return sanitized;
}

/**
 * Sanitizes a set name parameter with specific rules for Pokemon TCG sets
 */
export function sanitizeSetName(setName: string): string {
  if (typeof setName !== 'string') {
    return '';
  }
  
  // Decode URI component safely
  let decoded: string;
  try {
    decoded = decodeURIComponent(setName);
  } catch (error) {
    // If decoding fails, use the original string
    decoded = setName;
  }
  
  // Remove dangerous characters but keep Pokemon set name characters
  let sanitized = decoded
    .replace(/\0/g, '') // Remove null bytes
    .replace(/%00/g, '') // Remove URL-encoded null bytes
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/[<>]/g, '') // Remove HTML brackets
    .replace(/[;\\]/g, '') // Remove SQL injection characters
    .replace(/--/g, '') // Remove SQL comment markers
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .trim();
  
  // Allow alphanumeric, spaces, hyphens, ampersands, apostrophes, colons, periods, and parentheses
  // This covers most Pokemon set names like "Scarlet & Violet", "Sun & Moon: Team Up", etc.
  sanitized = sanitized.replace(/[^a-zA-Z0-9\s\-&':.()éèàùâêîôûç]/g, '');
  
  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  // Limit length
  if (sanitized.length > 100) {
    sanitized = sanitized.substring(0, 100);
  }
  
  return sanitized;
}

/**
 * Sanitizes a slug parameter (lowercase, alphanumeric, hyphens only)
 */
export function sanitizeSlug(slug: string): string {
  if (typeof slug !== 'string') {
    return '';
  }
  
  // Apply general sanitization first
  let sanitized = sanitizeUrlParameter(slug);
  
  // Convert to lowercase and keep only valid slug characters
  sanitized = sanitized.toLowerCase().replace(/[^a-z0-9\-]/g, '');
  
  // Remove multiple consecutive hyphens
  sanitized = sanitized.replace(/-+/g, '-');
  
  // Remove leading/trailing hyphens
  sanitized = sanitized.replace(/^-+|-+$/g, '');
  
  return sanitized;
}

/**
 * Sanitizes a UUID parameter
 */
export function sanitizeUUID(uuid: string): string {
  if (typeof uuid !== 'string') {
    return '';
  }
  
  // Apply general sanitization
  let sanitized = sanitizeUrlParameter(uuid);
  
  // Keep only valid UUID characters (alphanumeric and hyphens)
  sanitized = sanitized.replace(/[^a-fA-F0-9\-]/g, '');
  
  // Validate UUID format
  if (!validateUUID(sanitized)) {
    return '';
  }
  
  return sanitized.toLowerCase();
}

/**
 * Sanitizes a UPC/barcode parameter
 */
export function sanitizeUPC(upc: string): string {
  if (typeof upc !== 'string') {
    return '';
  }
  
  // Apply general sanitization
  let sanitized = sanitizeUrlParameter(upc);
  
  // Keep only digits
  sanitized = sanitized.replace(/[^0-9]/g, '');
  
  // Validate length (UPC should be 8-14 digits)
  if (sanitized.length < 8 || sanitized.length > 14) {
    return '';
  }
  
  return sanitized;
}

/**
 * Sanitizes search query parameters
 */
export function sanitizeSearchQuery(query: string): string {
  if (typeof query !== 'string') {
    return '';
  }
  
  // Remove dangerous characters but keep search-friendly ones
  let sanitized = query
    .replace(/\0/g, '') // Remove null bytes
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/[<>]/g, '') // Remove HTML brackets
    .replace(/[;\\]/g, '') // Remove SQL injection characters
    .replace(/--/g, '') // Remove SQL comment markers
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .trim();
  
  // Allow alphanumeric, spaces, and common punctuation for search
  // Include quotes, colons, periods, commas, exclamation marks, question marks, hyphens, ampersands, apostrophes
  sanitized = sanitized.replace(/[^a-zA-Z0-9\s\-&'":.,!?()]/g, '');
  
  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  // Limit search query length
  if (sanitized.length > 200) {
    sanitized = sanitized.substring(0, 200);
  }
  
  return sanitized;
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