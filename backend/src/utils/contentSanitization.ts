import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import type { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

// Create a JSDOM window for server-side DOMPurify
const window = new JSDOM('').window;
const purify = DOMPurify(window as any);

/**
 * Common security-related attributes and tags to forbid
 */
const FORBIDDEN_ATTRIBUTES = [
  'style', 'onerror', 'onload', 'onclick', 'onmouseover', 
  'onfocus', 'onblur', 'onchange', 'onsubmit'
] as const;

const FORBIDDEN_TAGS = [
  'script', 'object', 'embed', 'form', 'input', 
  'textarea', 'select', 'button', 'iframe'
] as const;

const DANGEROUS_PATTERNS = [
  /javascript:/gi,
  /data:/gi,
  /vbscript:/gi,
  /on\w+\s*=/gi,
  /alert\s*\(/gi,
  /eval\s*\(/gi,
  /confirm\s*\(/gi,
  /prompt\s*\(/gi
] as const;

/**
 * Configuration for different types of content sanitization
 */
interface SanitizationConfig {
  allowedTags?: string[];
  allowedAttributes?: { [key: string]: string[] };
  stripTags?: boolean;
  maxLength?: number;
  preserveLineBreaks?: boolean;
}

/**
 * Predefined sanitization configurations for different content types
 */
export const SANITIZATION_CONFIGS = {
  // Plain text only - strips all HTML
  PLAIN_TEXT: {
    allowedTags: [],
    allowedAttributes: {},
    stripTags: true,
    maxLength: 1000,
    preserveLineBreaks: false
  } as SanitizationConfig,

  // Basic rich text - allows safe formatting tags
  BASIC_RICH_TEXT: {
    allowedTags: ['p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li'],
    allowedAttributes: {},
    stripTags: false,
    maxLength: 5000,
    preserveLineBreaks: true
  } as SanitizationConfig,

  // User descriptions - allows basic formatting but no links
  USER_DESCRIPTION: {
    allowedTags: ['p', 'br', 'strong', 'em'],
    allowedAttributes: {},
    stripTags: false,
    maxLength: 2000,
    preserveLineBreaks: true
  } as SanitizationConfig,

  // Product descriptions - allows more formatting for admin content
  PRODUCT_DESCRIPTION: {
    allowedTags: ['p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li', 'h3', 'h4'],
    allowedAttributes: {},
    stripTags: false,
    maxLength: 10000,
    preserveLineBreaks: true
  } as SanitizationConfig,

  // Admin notes - allows basic formatting for internal use
  ADMIN_NOTES: {
    allowedTags: ['p', 'br', 'strong', 'em', 'ul', 'li'],
    allowedAttributes: {},
    stripTags: false,
    maxLength: 5000,
    preserveLineBreaks: true
  } as SanitizationConfig,

  // Search queries - very restrictive
  SEARCH_QUERY: {
    allowedTags: [],
    allowedAttributes: {},
    stripTags: true,
    maxLength: 200,
    preserveLineBreaks: false
  } as SanitizationConfig
};

/**
 * Sanitize HTML content using DOMPurify with custom configuration
 */
export function sanitizeHTML(
  content: string, 
  config: SanitizationConfig = SANITIZATION_CONFIGS.PLAIN_TEXT
): string {
  if (!content || typeof content !== 'string') {
    return '';
  }

  try {
    const sanitized = config.stripTags 
      ? sanitizeToPlainText(content, config)
      : sanitizeToRichText(content, config);

    return applyPostProcessing(sanitized, config);

  } catch (error) {
    logger.error('Content sanitization error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      contentLength: content.length,
      config: config
    });
    
    // Fallback to basic text sanitization
    return sanitizeBasicText(content, config.maxLength || 1000);
  }
}

/**
 * Sanitize content to plain text, removing all HTML
 */
function sanitizeToPlainText(content: string, config: SanitizationConfig): string {
  let processedContent = content;
  
  // Handle line breaks before sanitization if preserving them
  if (config.preserveLineBreaks) {
    processedContent = convertHtmlLineBreaksToText(processedContent);
  }
  
  // Configure DOMPurify for text-only output
  const purifyConfig = createPurifyConfig([], {}, true);
  let sanitized = String(purify.sanitize(processedContent, purifyConfig));
  
  // Remove any remaining HTML tags manually as a safety measure
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  
  // Remove dangerous protocols and patterns
  sanitized = removeDangerousPatterns(sanitized);
  
  return sanitized;
}

/**
 * Sanitize content while preserving allowed HTML tags
 */
function sanitizeToRichText(content: string, config: SanitizationConfig): string {
  const purifyConfig = createPurifyConfig(
    config.allowedTags || [], 
    config.allowedAttributes || {},
    false
  );

  return String(purify.sanitize(content, purifyConfig));
}

/**
 * Create DOMPurify configuration object
 */
function createPurifyConfig(
  allowedTags: string[], 
  allowedAttributes: Record<string, string[]>,
  isTextOnly: boolean
): any {
  const forbiddenTags: string[] = [...FORBIDDEN_TAGS];
  
  if (isTextOnly) {
    forbiddenTags.push('svg', 'math');
  }

  return {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: allowedAttributes,
    KEEP_CONTENT: true,
    FORBID_ATTR: [...FORBIDDEN_ATTRIBUTES],
    FORBID_TAGS: forbiddenTags
  };
}

/**
 * Convert HTML line breaks to plain text equivalents
 */
function convertHtmlLineBreaksToText(content: string): string {
  return content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '');
}

/**
 * Remove dangerous JavaScript patterns and protocols
 */
function removeDangerousPatterns(content: string): string {
  let cleaned = content;
  
  for (const pattern of DANGEROUS_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }
  
  return cleaned;
}

/**
 * Apply post-processing steps like length limiting and whitespace cleanup
 */
function applyPostProcessing(content: string, config: SanitizationConfig): string {
  let processed = content.trim();

  // Apply length limit
  if (config.maxLength && processed.length > config.maxLength) {
    processed = truncateContent(processed, config);
  }

  // Final cleanup based on content type
  processed = cleanupWhitespace(processed, config);

  return processed;
}

/**
 * Truncate content to specified length, handling HTML gracefully
 */
function truncateContent(content: string, config: SanitizationConfig): string {
  let truncated = content.substring(0, config.maxLength!);
  
  // If we're dealing with HTML, re-sanitize to ensure valid markup after truncation
  if (!config.stripTags) {
    const purifyConfig = createPurifyConfig(
      config.allowedTags || [], 
      config.allowedAttributes || {},
      false
    );
    truncated = String(purify.sanitize(truncated, purifyConfig));
  }
  
  return truncated;
}

/**
 * Clean up whitespace based on configuration
 */
function cleanupWhitespace(content: string, config: SanitizationConfig): string {
  if (!config.stripTags) {
    return content;
  }

  if (config.preserveLineBreaks) {
    // Preserve line breaks but clean up excessive whitespace
    return content
      .replace(/[ \t]+/g, ' ') // Replace multiple spaces/tabs with single space
      .replace(/\n\s*\n/g, '\n') // Remove excessive line breaks
      .trim();
  } else {
    // Remove excessive whitespace including line breaks
    return content
      .replace(/\s+/g, ' ')
      .trim();
  }
}

/**
 * Basic text sanitization fallback that removes all HTML and dangerous characters
 */
export function sanitizeBasicText(text: string, maxLength: number = 1000): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  // Remove all HTML tags
  let sanitized = text.replace(/<[^>]*>/g, '');
  
  // Remove dangerous characters
  sanitized = sanitized
    .replace(/[<>]/g, '') // Remove any remaining brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/data:/gi, '') // Remove data: protocol
    .replace(/vbscript:/gi, '') // Remove vbscript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .replace(/\0/g, '') // Remove null bytes
    .replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters

  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  // Apply length limit
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Sanitize user-generated content based on content type
 */
export function sanitizeUserContent(content: string, contentType: string): string {
  const config = getConfigForContentType(contentType);
  return sanitizeHTML(content, config);
}

/**
 * Content type mapping for better maintainability
 */
const CONTENT_TYPE_MAPPINGS: Record<string, SanitizationConfig> = {
  // Product-related content
  'product_description': SANITIZATION_CONFIGS.PRODUCT_DESCRIPTION,
  
  // User-generated content
  'user_description': SANITIZATION_CONFIGS.USER_DESCRIPTION,
  'custom_description': SANITIZATION_CONFIGS.USER_DESCRIPTION,
  'bio': SANITIZATION_CONFIGS.USER_DESCRIPTION,
  'about': SANITIZATION_CONFIGS.USER_DESCRIPTION,
  
  // Administrative content
  'admin_notes': SANITIZATION_CONFIGS.ADMIN_NOTES,
  'training_notes': SANITIZATION_CONFIGS.ADMIN_NOTES,
  'review_notes': SANITIZATION_CONFIGS.ADMIN_NOTES,
  'moderation_notes': SANITIZATION_CONFIGS.ADMIN_NOTES,
  
  // Search-related content
  'search_query': SANITIZATION_CONFIGS.SEARCH_QUERY,
  'search': SANITIZATION_CONFIGS.SEARCH_QUERY,
  
  // Rich text content
  'rich_text': SANITIZATION_CONFIGS.BASIC_RICH_TEXT,
  'comment': SANITIZATION_CONFIGS.BASIC_RICH_TEXT,
  'post_content': SANITIZATION_CONFIGS.BASIC_RICH_TEXT,
};

/**
 * Get sanitization configuration based on content type
 */
function getConfigForContentType(contentType: string): SanitizationConfig {
  const normalizedType = contentType.toLowerCase();
  return CONTENT_TYPE_MAPPINGS[normalizedType] || SANITIZATION_CONFIGS.PLAIN_TEXT;
}

/**
 * Sanitize JSON object recursively, sanitizing string values
 */
export function sanitizeJSONContent(
  obj: any, 
  contentType: string = 'plain_text'
): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeUserContent(obj, contentType);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeJSONContent(item, contentType));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const keyContentType = determineContentTypeForKey(key, contentType);
      sanitized[key] = sanitizeJSONContent(value, keyContentType);
    }
    return sanitized;
  }

  return obj;
}

/**
 * Determine the appropriate content type for a given key
 */
function determineContentTypeForKey(key: string, defaultContentType: string): string {
  // If a default is explicitly provided, use it as-is, including plain_text
  if (defaultContentType) {
    return defaultContentType;
  }
  // Otherwise auto-detect based on key name
  return getContentTypeFromKey(key);
}

/**
 * Cache for key-based content type detection to improve performance
 */
const keyContentTypeCache = new Map<string, string>();

/**
 * Content type detection rules for object keys
 */
const KEY_CONTENT_TYPE_RULES: Array<{ test: (key: string) => boolean; type: string }> = [
  { test: (key) => key.includes('description'), type: 'user_description' },
  { test: (key) => key.includes('notes') || key === 'admin_notes', type: 'admin_notes' },
  { test: (key) => key.includes('comment'), type: 'rich_text' },
  { test: (key) => key.includes('bio') || key.includes('about'), type: 'user_description' },
  { test: (key) => key.includes('search') || key.includes('query'), type: 'search_query' },
  { test: (key) => key.includes('name') || key.includes('title'), type: 'plain_text' },
];

/**
 * Determine content type based on object key name with caching
 */
function getContentTypeFromKey(key: string): string {
  // Check cache first
  if (keyContentTypeCache.has(key)) {
    return keyContentTypeCache.get(key)!;
  }

  const lowerKey = key.toLowerCase();
  
  // Apply rules in order
  for (const rule of KEY_CONTENT_TYPE_RULES) {
    if (rule.test(lowerKey)) {
      keyContentTypeCache.set(key, rule.type);
      return rule.type;
    }
  }
  
  // Default case
  const defaultType = 'plain_text';
  keyContentTypeCache.set(key, defaultType);
  return defaultType;
}

/**
 * Middleware to sanitize request body content
 */
export function sanitizeRequestBody(contentTypeMap: Record<string, string> = {}) {
  // Loosen parameter typing to improve test ergonomics while preserving runtime behavior
  return (req: any, _res: any, next: any) => {
    if (req.body && typeof req.body === 'object') {
      try {
        req.body = sanitizeObjectFields(req.body, contentTypeMap);
      } catch (error) {
        logger.error('Request body sanitization error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          path: req.path,
          method: req.method,
          correlationId: req.headers['x-correlation-id']
        });
        // Continue processing even if sanitization fails - better to have unsanitized data than break the request
      }
    }
    next();
  };
}

/**
 * Sanitize specific fields in an object based on field mapping
 */
export function sanitizeObjectFields(
  obj: any, 
  fieldTypeMap: Record<string, string>
): any {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return obj;
  }

  const sanitized = { ...obj };

  for (const [field, contentType] of Object.entries(fieldTypeMap)) {
    const fieldValue = sanitized[field];
    
    if (fieldValue === undefined || fieldValue === null) {
      continue;
    }

    try {
      if (typeof fieldValue === 'string') {
        sanitized[field] = sanitizeUserContent(fieldValue, contentType);
      } else if (typeof fieldValue === 'object') {
        sanitized[field] = sanitizeJSONContent(fieldValue, contentType);
      }
      // Skip non-string, non-object values (numbers, booleans, etc.)
    } catch (error) {
      logger.warn('Failed to sanitize field', {
        field,
        contentType,
        error: error instanceof Error ? error.message : 'Unknown error',
        fieldType: typeof fieldValue
      });
      // Keep original value if sanitization fails
    }
  }

  return sanitized;
}

/**
 * Validate that content is safe after sanitization
 */
export function validateSanitizedContent(
  original: string, 
  sanitized: string, 
  fieldName: string
): { isValid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  
  // Check if content was significantly modified
  if (original.length > 0 && sanitized.length === 0) {
    warnings.push(`${fieldName}: Content was completely removed during sanitization`);
  }
  
  const changeRatio = original.length > 0 ? 1 - (sanitized.length / original.length) : 0;
  if (changeRatio > 0.3) {
    warnings.push(`${fieldName}: Content was significantly modified during sanitization (${Math.round(changeRatio * 100)}% removed)`);
  }
  
  // Check for potential XSS attempts
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i
  ];
  
  const hasSuspiciousContent = suspiciousPatterns.some(pattern => pattern.test(original));
  if (hasSuspiciousContent) {
    warnings.push(`${fieldName}: Potentially malicious content detected and removed`);
  }
  
  return {
    isValid: sanitized.length > 0 || original.length === 0,
    warnings
  };
}

/**
 * Content sanitization middleware for specific routes
 */
export const contentSanitizationMiddleware = {
  // Product content sanitization
  products: sanitizeRequestBody({
    'name': 'plain_text',
    'description': 'product_description',
    'set_name': 'plain_text',
    'series': 'plain_text'
  }),

  // User content sanitization
  users: sanitizeRequestBody({
    'first_name': 'plain_text',
    'last_name': 'plain_text',
    'bio': 'user_description',
    'about': 'user_description'
  }),

  // Watch pack content sanitization
  watchPacks: sanitizeRequestBody({
    'name': 'plain_text',
    'description': 'user_description',
    'custom_name': 'plain_text',
    'custom_description': 'user_description'
  }),

  // Admin content sanitization
  admin: sanitizeRequestBody({
    'training_notes': 'admin_notes',
    'review_notes': 'admin_notes',
    'moderation_notes': 'admin_notes',
    'notes': 'admin_notes'
  }),

  // Community content sanitization
  community: sanitizeRequestBody({
    'content': 'rich_text',
    'title': 'plain_text',
    'comment': 'rich_text',
    'testimonial': 'user_description'
  }),

  // Search sanitization
  search: sanitizeRequestBody({
    'q': 'search_query',
    'query': 'search_query',
    'search': 'search_query',
    'searchTerm': 'search_query'
  })
};
