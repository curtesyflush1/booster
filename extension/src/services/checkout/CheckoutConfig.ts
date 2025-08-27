// Configuration constants for checkout automation
export const CHECKOUT_CONFIG = {
  TIMEOUTS: {
    ELEMENT_FIND: 5000,
    PAGE_LOAD: 10000,
    LOGIN_COMPLETION: 3000,
    CART_UPDATE: 2000,
    ORDER_CONFIRMATION: 5000,
  },
  DELAYS: {
    FIELD_FILL: 100,
    BETWEEN_ACTIONS: 500,
  },
  SAFETY_LIMITS: {
    MAX_ORDER_TOTAL: 1000,
    MAX_QUANTITY: 10,
  },
  RETRY: {
    MAX_ATTEMPTS: 3,
    BACKOFF_MS: 1000,
  }
} as const;

export type CheckoutConfigType = typeof CHECKOUT_CONFIG;