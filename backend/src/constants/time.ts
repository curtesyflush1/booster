/**
 * Time-related constants for consistent time calculations across the application
 */

// Base time units in milliseconds
export const TIME_UNITS = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
} as const;

// Common time intervals
export const INTERVALS = {
  // Cache intervals
  CACHE_DEFAULT_TTL: 5 * TIME_UNITS.MINUTE,
  CACHE_CLEANUP_INTERVAL: 10 * TIME_UNITS.MINUTE,
  
  // Rate limiting windows
  RATE_LIMIT_WINDOW_SHORT: 1 * TIME_UNITS.MINUTE,
  RATE_LIMIT_WINDOW_MEDIUM: 15 * TIME_UNITS.MINUTE,
  RATE_LIMIT_WINDOW_LONG: 1 * TIME_UNITS.HOUR,
  
  // Authentication timeouts
  ACCOUNT_LOCKOUT_DURATION: 30 * TIME_UNITS.MINUTE,
  
  // Data retention periods
  RECENT_ALERTS_PERIOD: 7 * TIME_UNITS.DAY,
  DASHBOARD_UPDATES_MAX_AGE: 30 * TIME_UNITS.DAY,
  METRICS_RETENTION_PERIOD: 24 * TIME_UNITS.HOUR, // Will be multiplied by retention hours config
  ALERT_CLEANUP_DEFAULT_DAYS: 90 * TIME_UNITS.DAY,
  WATCH_INACTIVITY_THRESHOLD: 30 * TIME_UNITS.DAY,
  
  // Monitoring intervals
  MONITORING_DEFAULT_WINDOW: 1 * TIME_UNITS.HOUR,
  
  // Backup intervals
  BACKUP_INITIAL_DELAY: 5 * TIME_UNITS.MINUTE,
  
  // Service delays
  ANALYTICS_PROCESSING_DELAY: 100, // milliseconds
  SMS_SIMULATION_DELAY: 300, // milliseconds
  DISCORD_SIMULATION_DELAY: 200, // milliseconds
  WEBSOCKET_MESSAGE_DELAY: 1000, // milliseconds
  DISCORD_RATE_LIMIT_DELAY: 1000, // milliseconds between messages
  ALERT_DELIVERY_BATCH_DELAY: 1000, // milliseconds between alert batches
  
  // Monitoring intervals
  ALERT_CHECK_INTERVAL: 30000, // 30 seconds
  METRICS_CLEANUP_INTERVAL: 3600000, // 1 hour
  MONITORING_SYSTEM_INTERVAL: 60000, // 1 minute
  
  // Analytics intervals
  ANALYTICS_PROCESS_INTERVAL: 5000, // 5 seconds
  ANALYTICS_SLOW_OPERATION_THRESHOLD: 500, // 500ms
  
  // Data collection intervals
  AVAILABILITY_SNAPSHOT_INTERVAL: 30, // minutes
  ENGAGEMENT_METRICS_INTERVAL: 6, // hours
  PRICE_HISTORY_COLLECTION_INTERVAL: 24, // hours
  
  // Retailer health check intervals
  RETAILER_HEALTH_CHECK_INTERVAL: 5 * TIME_UNITS.MINUTE,
  
  // Sitemap crawl delay
  SITEMAP_CRAWL_DELAY: 1000, // 1 second
} as const;

// Time periods for calculations
export const TIME_PERIODS = {
  DEFAULT_HISTORY_DAYS: 30,
  MAX_TIMEFRAME_DAYS: 1825, // 5 years
  MIN_TIMEFRAME_DAYS: 1,
  DEFAULT_PREDICTION_TIMEFRAME: 365, // 1 year
  MAX_PREDICTION_TIMEFRAME: 1095, // 3 years
  ALERT_CLEANUP_DEFAULT_DAYS: 90,
  PRICE_HISTORY_RETENTION_DAYS: 365,
  ALERT_DELIVERY_RETENTION_DAYS: 90,
  SYSTEM_HEALTH_RETENTION_DAYS: 30,
  VERIFICATION_CODE_EXPIRY_MINUTES: 10,
} as const;

// Default values for various operations
export const DEFAULT_VALUES = {
  // Pagination defaults
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  
  // Monitoring defaults
  DEFAULT_MONITORING_LIMIT: 100,
  DEFAULT_FAILED_ALERTS_LIMIT: 50,
  DEFAULT_RECENT_ALERTS_LIMIT: 100,
  DEFAULT_TOP_PRODUCTS_LIMIT: 10,
  DEFAULT_TOP_WATCHES_LIMIT: 5,
  
  // Database pool defaults
  DB_POOL_MIN_CONNECTIONS: 2,
  DB_POOL_MAX_CONNECTIONS: 10,
  DB_POOL_MIN_CONNECTIONS_TEST: 1,
  DB_POOL_MAX_CONNECTIONS_TEST: 5,
  DB_POOL_MIN_CONNECTIONS_PROD: 5,
  DB_POOL_MAX_CONNECTIONS_PROD: 20,
  
  // Retry defaults
  DEFAULT_MAX_RETRIES: 5,
  DEFAULT_MAX_FAILED_RETRIES: 3,
  
  // Rate limiting window
  RATE_LIMIT_WINDOW_DURATION: 60 * 1000, // 1 minute in milliseconds
  
  // Quiet hours defaults
  DEFAULT_QUIET_START_TIME: '22:00',
  DEFAULT_QUIET_END_TIME: '08:00',
  
  // Percentage calculation precision
  PERCENTAGE_PRECISION: 100,
  
  // SMS monthly limit for Pro users
  SMS_MONTHLY_LIMIT_PRO: 100,
} as const;