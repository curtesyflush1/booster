/**
 * Centralized constants export
 * 
 * This file provides a single entry point for all application constants,
 * making it easier to import and maintain consistency across the codebase.
 */

// Re-export all limit constants
export * from './limits';

// Legacy constants (to be migrated to limits.ts)
export * from './auth';
export * from './http';
export * from './ml';
export * from './monitoring';
export * from './time';
export * from './validation';
export * from './webhooks';

// Default values and intervals
export const DEFAULT_VALUES = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  SMS_MONTHLY_LIMIT_PRO: 100,
  DEFAULT_QUIET_START_TIME: '22:00',
  DEFAULT_QUIET_END_TIME: '08:00',
  DEFAULT_MONITORING_LIMIT: 100,
  DEFAULT_MAX_FAILED_RETRIES: 3,
  DEFAULT_FAILED_ALERTS_LIMIT: 50,
  PERCENTAGE_PRECISION: 100,
  DEFAULT_RECENT_ALERTS_LIMIT: 100,
  POPULAR_PRODUCTS_LIMIT: 10,
  RECENT_PRODUCTS_LIMIT: 20,
  UPCOMING_PRODUCTS_LIMIT: 15,
  DEFAULT_TOP_WATCHES_LIMIT: 5,
  DEFAULT_TOP_PRODUCTS_LIMIT: 10,
} as const;

export const PORTS = {
  API_PORT: 3000,
  REDIS_PORT: 6379,
  POSTGRES_PORT: 5432,
} as const;

export const EXPRESS_LIMITS = {
  JSON_BODY_LIMIT: '10mb',
  URL_ENCODED_LIMIT: '10mb',
} as const;

export const NUMERIC_LIMITS = {
  PRICE_HISTORY_DEFAULT_DAYS: 30,
} as const;

export const INTERVALS = {
  RATE_LIMIT_WINDOW_SHORT: 60 * 1000, // 1 minute
  RATE_LIMIT_WINDOW_MEDIUM: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_WINDOW_LONG: 60 * 60 * 1000, // 1 hour
  RATE_LIMIT_WINDOW_DURATION: 60 * 1000, // 1 minute - for retailer rate limiting
  AVAILABILITY_SNAPSHOT_INTERVAL: 30, // 30 minutes
  ENGAGEMENT_METRICS_INTERVAL: 6, // 6 hours
  RECENT_ALERTS_PERIOD: 7 * 24 * 60 * 60 * 1000, // 7 days
  SMS_SIMULATION_DELAY: 500, // 500ms
  ACCOUNT_LOCKOUT_DURATION: 30 * 60 * 1000, // 30 minutes
  CACHE_DEFAULT_TTL: 5 * 60 * 1000, // 5 minutes
  DAY: 24 * 60 * 60 * 1000, // 1 day in milliseconds
} as const;

export const TIME_PERIODS = {
  VERIFICATION_CODE_EXPIRY_MINUTES: 10,
  ALERT_CLEANUP_DEFAULT_DAYS: 90,
  DEFAULT_HISTORY_DAYS: 30,
} as const;

export const HTTP_TIMEOUTS = {
  WEBHOOK_REQUEST: 10000, // 10 seconds
  REDIS_CONNECT_TIMEOUT: 5000, // 5 seconds
  REDIS_KEEPALIVE: 30000, // 30 seconds
  DB_ACQUIRE_TIMEOUT: 60000, // 60 seconds
  DB_CREATE_TIMEOUT: 30000, // 30 seconds
  DB_DESTROY_TIMEOUT: 5000, // 5 seconds
  DB_IDLE_TIMEOUT: 300000, // 5 minutes
  DB_REAP_INTERVAL: 1000, // 1 second
  DB_CREATE_RETRY_INTERVAL: 200, // 200ms
} as const;

export const RETRY_CONFIG = {
  WEBHOOK_DEFAULT_MAX_RETRIES: 3,
  WEBHOOK_DEFAULT_RETRY_DELAY: 1000, // 1 second
  WEBHOOK_DEFAULT_BACKOFF_MULTIPLIER: 2,
  WEBHOOK_RETRY_DELAY_MIN: 100, // 100ms
  DB_CONNECTION_RETRY_DELAY_BASE: 1000, // 1 second
} as const;

export const MONITORING_THRESHOLDS = {
  SLOW_OPERATION_THRESHOLD: 1000, // 1 second
  VERY_SLOW_OPERATION_THRESHOLD: 5000, // 5 seconds
  HIGH_MEMORY_THRESHOLD: 85, // 85% memory usage
  HIGH_DISK_THRESHOLD: 90, // 90% disk usage
  HIGH_CPU_THRESHOLD: 80, // 80% CPU usage
  ERROR_RATE_THRESHOLD: 5, // 5% error rate
} as const;