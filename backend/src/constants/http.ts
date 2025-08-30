/**
 * HTTP-related constants including status codes, timeouts, and cache settings
 */

// HTTP Status Codes
export const HTTP_STATUS = {
  // Success codes
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  
  // Client error codes
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  
  // Server error codes
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

// HTTP Timeouts (in milliseconds)
export const HTTP_TIMEOUTS = {
  // API timeouts
  BEST_BUY_API: 10000,      // 10 seconds
  WALMART_API: 10000,       // 10 seconds
  
  // Scraping timeouts (longer for web scraping)
  COSTCO_SCRAPING: 15000,   // 15 seconds
  SAMS_CLUB_SCRAPING: 15000, // 15 seconds
  
  // Webhook timeouts
  WEBHOOK_REQUEST: 10000,   // 10 seconds
  DISCORD_WEBHOOK: 10000,   // 10 seconds
  
  // General request timeout
  DEFAULT_REQUEST: 10000,   // 10 seconds
  
  // Alert delivery timeout
  ALERT_DELIVERY: 30000,    // 30 seconds
  
  // Database timeouts
  DB_ACQUIRE_TIMEOUT: 30000,    // 30 seconds
  DB_CREATE_TIMEOUT: 30000,     // 30 seconds
  DB_DESTROY_TIMEOUT: 5000,     // 5 seconds
  DB_IDLE_TIMEOUT: 30000,       // 30 seconds
  DB_REAP_INTERVAL: 1000,       // 1 second
  DB_CREATE_RETRY_INTERVAL: 200, // 200ms
  
  // Redis timeouts
  REDIS_CONNECT_TIMEOUT: 10000, // 10 seconds
  REDIS_KEEPALIVE: 30000,       // 30 seconds
} as const;

// Express middleware limits
export const EXPRESS_LIMITS = {
  JSON_BODY_LIMIT: '10mb',
} as const;

// Cache Control Headers (in seconds)
export const CACHE_CONTROL = {
  // Sitemap caching
  SITEMAP_MAIN: 86400,      // 24 hours
  SITEMAP_PRODUCTS: 3600,   // 1 hour (products change more frequently)
  SITEMAP_CATEGORIES: 86400, // 24 hours
  SITEMAP_LOCATIONS: 604800, // 1 week (locations change rarely)
  SITEMAP_PAGES: 86400,     // 24 hours
  SITEMAP_DEFAULT: 86400,   // 24 hours (default for sitemaps)
  ROBOTS_TXT: 86400,        // 24 hours
  
  // API response caching
  SHORT_CACHE: 300,         // 5 minutes
  MEDIUM_CACHE: 3600,       // 1 hour
  LONG_CACHE: 86400,        // 24 hours
} as const;

// Retry Configuration
export const RETRY_CONFIG = {
  // API retries
  API_MAX_RETRIES: 3,
  API_RETRY_DELAY: 1000,    // 1 second
  
  // Scraping retries (more conservative)
  SCRAPING_MAX_RETRIES: 2,
  SCRAPING_RETRY_DELAY: 2000, // 2 seconds
  
  // Webhook retries
  WEBHOOK_RETRY_DELAY_MIN: 100, // 100ms minimum
  WEBHOOK_DEFAULT_MAX_RETRIES: 3,
  WEBHOOK_DEFAULT_RETRY_DELAY: 1000, // 1 second
  WEBHOOK_DEFAULT_BACKOFF_MULTIPLIER: 2,
  
  // Analytics retries
  ANALYTICS_RETRY_ATTEMPTS: 3,
  ANALYTICS_RETRY_DELAY: 1000, // 1 second
  
  // Database connection retries
  DB_CONNECTION_RETRY_DELAY_BASE: 1000, // 1 second base for exponential backoff
} as const;

// Rate Limiting Configuration
export const RATE_LIMITING = {
  // API rate limits (requests per minute/hour)
  BEST_BUY_RPM: 5,
  BEST_BUY_RPH: 100,
  
  WALMART_RPM: 5,
  WALMART_RPH: 100,
  
  // Scraping rate limits (more conservative)
  COSTCO_RPM: 2,
  COSTCO_RPH: 50,
  
  SAMS_CLUB_RPM: 2,
  SAMS_CLUB_RPH: 50,
} as const;

// Circuit Breaker Configuration
export const CIRCUIT_BREAKER = {
  FAILURE_THRESHOLD: 5,
  RECOVERY_TIMEOUT: 60000,    // 1 minute
  MONITORING_PERIOD: 300000,  // 5 minutes
  SUCCESS_THRESHOLD: 3,
  HEALTH_CHECK_INTERVAL: 300000, // 5 minutes
} as const;

// Content Type Headers
export const CONTENT_TYPES = {
  JSON: 'application/json',
  XML: 'application/xml',
  TEXT: 'text/plain',
  HTML: 'text/html',
} as const;