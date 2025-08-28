/**
 * Monitoring and performance constants
 */

// System monitoring thresholds
export const MONITORING_THRESHOLDS = {
  // Performance thresholds
  SLOW_OPERATION_THRESHOLD: 500, // 500ms
  VERY_SLOW_OPERATION_THRESHOLD: 1000, // 1 second
  
  // System health thresholds
  HIGH_CPU_THRESHOLD: 80, // 80%
  HIGH_MEMORY_THRESHOLD: 85, // 85%
  HIGH_DISK_THRESHOLD: 90, // 90%
  
  // Alert thresholds
  ALERT_DELIVERY_SUCCESS_THRESHOLD: 95, // 95%
  API_ERROR_RATE_THRESHOLD: 5, // 5%
} as const;

// Monitoring intervals and retention
export const MONITORING_CONFIG = {
  // Check intervals
  HEALTH_CHECK_INTERVAL: 60000, // 1 minute
  METRICS_COLLECTION_INTERVAL: 30000, // 30 seconds
  ALERT_CHECK_INTERVAL: 30000, // 30 seconds
  
  // Retention periods
  METRICS_RETENTION_HOURS: 24,
  ALERT_HISTORY_RETENTION_DAYS: 90,
  
  // Batch sizes
  METRICS_BATCH_SIZE: 100,
  ALERT_BATCH_SIZE: 50,
} as const;

// Performance tracking
export const PERFORMANCE_CONFIG = {
  // Precision and formatting
  PRECISION_DIGITS: 2,
  PERCENTAGE_MULTIPLIER: 100,
  
  // Retry configuration for performance-critical operations
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY_BASE: 100, // 100ms base delay
  
  // Concurrency limits
  MAX_CONCURRENT_OPERATIONS: 10,
  MAX_CONCURRENT_DELIVERIES: 10,
} as const;

// Placeholder values (to be replaced with actual implementations)
export const PLACEHOLDER_VALUES = {
  DISK_USAGE_PERCENTAGE: 45.2, // TODO: Replace with actual disk usage calculation
} as const;