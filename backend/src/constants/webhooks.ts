/**
 * Webhook and retry configuration constants
 */

export const WEBHOOK_CONFIG = {
  DEFAULT_MAX_RETRIES: 3,
  DEFAULT_RETRY_DELAY: 1000, // milliseconds
  DEFAULT_BACKOFF_MULTIPLIER: 2,
} as const;