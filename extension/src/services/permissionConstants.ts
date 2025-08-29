// Constants for permission management
export const PERMISSION_CONSTANTS = {
  // Storage keys
  STORAGE_KEYS: {
    BOOSTER_SETTINGS: 'booster_settings',
    PERMISSION_CACHE: 'permission_cache'
  },

  // Required permissions for extension functionality
  REQUIRED_PERMISSIONS: [
    'storage',
    'activeTab', 
    'notifications',
    'alarms'
  ] as const,

  // Required origins for API access
  REQUIRED_ORIGINS: [
    'https://api.boosterbeacon.com/*'
  ] as const,

  // Default settings for new retailers
  DEFAULT_RETAILER_SETTINGS: {
    enabled: true,
    autoLogin: false,
    autoFill: true
  },

  // Cache configuration
  CACHE: {
    DEFAULT_TTL: 5 * 60 * 1000, // 5 minutes
    PERMISSION_CHECK_TTL: 2 * 60 * 1000, // 2 minutes for permission checks
    SETTINGS_TTL: 10 * 60 * 1000 // 10 minutes for settings
  },

  // Message types for permission events
  MESSAGE_TYPES: {
    PERMISSION_GRANTED: 'PERMISSION_GRANTED',
    PERMISSION_REMOVED: 'PERMISSION_REMOVED',
    PERMISSION_CHECK: 'PERMISSION_CHECK'
  },

  // Error codes
  ERROR_CODES: {
    UNSUPPORTED_RETAILER: 'UNSUPPORTED_RETAILER',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    STORAGE_ERROR: 'STORAGE_ERROR',
    CHROME_API_ERROR: 'CHROME_API_ERROR'
  }
} as const;

// Type-safe permission features
export const PERMISSION_FEATURES = {
  PRODUCT_MONITORING: 'Monitor product availability',
  PAGE_DETECTION: 'Detect products on pages you visit', 
  CHECKOUT_ASSISTANCE: 'Assist with checkout processes',
  ADD_TO_CART: 'Provide add-to-cart functionality',
  PRICE_TRACKING: 'Price tracking'
} as const;

export type PermissionFeature = keyof typeof PERMISSION_FEATURES;