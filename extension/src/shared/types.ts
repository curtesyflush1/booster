// Shared types for the BoosterBeacon browser extension

// Enums for better type safety
export enum SubscriptionTier {
  FREE = 'free',
  PRO = 'pro'
}

export enum PaymentMethodType {
  CREDIT = 'credit',
  DEBIT = 'debit',
  PAYPAL = 'paypal'
}

/**
 * Represents a user in the BoosterBeacon extension
 */
export interface User {
  /** Unique user identifier */
  id: string;
  /** User's email address */
  email: string;
  /** Current subscription tier */
  subscriptionTier: SubscriptionTier;
  /** Whether the user is currently authenticated */
  isAuthenticated: boolean;
}

export interface Product {
  id: string;
  name: string;
  sku?: string; // Optional as not all products have SKUs
  upc?: string; // Optional as not all products have UPCs
  category: string;
  set?: string; // Optional for non-TCG products
  price: number; // Should be positive
  imageUrl?: string; // Optional as images might not always be available
}

export interface RetailerInfo {
  id: string;
  name: string;
  domain: string;
  isSupported: boolean;
  hasCartIntegration: boolean;
}

export interface Watch {
  id: string;
  userId: string;
  productId: string;
  retailerId: string;
  isActive: boolean;
  createdAt: string;
}

export interface Alert {
  id: string;
  productId: string;
  retailerId: string;
  productName: string;
  retailerName: string;
  price: number;
  cartUrl?: string;
  productUrl: string;
  timestamp: string;
}

/**
 * Extension-wide settings configuration
 */
export interface ExtensionSettings {
  /** Whether the extension is globally enabled */
  isEnabled: boolean;
  /** Whether auto-fill functionality is enabled */
  autoFillEnabled: boolean;
  /** Whether notifications are enabled */
  notificationsEnabled: boolean;
  /** Whether quick actions are enabled */
  quickActionsEnabled: boolean;
  /** Per-retailer settings configuration */
  retailerSettings: Record<RetailerId, RetailerSettings>;
}

export interface RetailerSettings {
  enabled: boolean;
  autoLogin: boolean;
  autoFill: boolean;
  credentials?: {
    username: string;
    // Note: Password will be stored securely, not in plain text
    hasStoredPassword: boolean;
  };
}

export interface UserPreferences {
  shippingAddress?: Address;
  paymentMethod?: PaymentMethod;
  defaultRetailer?: string;
  quickCheckoutEnabled: boolean;
}

export interface Address {
  firstName: string;
  lastName: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface PaymentMethod {
  type: PaymentMethodType;
  lastFour?: string; // Should be exactly 4 digits
  expiryMonth?: number; // 1-12
  expiryYear?: number; // 4-digit year
  brand?: string; // Visa, Mastercard, etc.
  isDefault?: boolean;
}

// Message types for communication between extension components
export enum MessageType {
  GET_USER_STATUS = 'GET_USER_STATUS',
  UPDATE_SETTINGS = 'UPDATE_SETTINGS',
  ADD_TO_CART = 'ADD_TO_CART',
  FILL_CHECKOUT_FORM = 'FILL_CHECKOUT_FORM',
  GET_PRODUCT_INFO = 'GET_PRODUCT_INFO',
  TRACK_PAGE_VIEW = 'TRACK_PAGE_VIEW',
  SHOW_NOTIFICATION = 'SHOW_NOTIFICATION',
  SYNC_DATA = 'SYNC_DATA',
  PING = 'PING',
  EXECUTE_ADD_TO_CART = 'EXECUTE_ADD_TO_CART',
  EXECUTE_AUTOMATED_CHECKOUT = 'EXECUTE_AUTOMATED_CHECKOUT',
  FILL_ALL_FORMS = 'FILL_ALL_FORMS',
  STORE_CREDENTIALS = 'STORE_CREDENTIALS',
  GET_CREDENTIALS = 'GET_CREDENTIALS',
  SAVE_AUTOFILL_DATA = 'SAVE_AUTOFILL_DATA',
  GET_PURCHASE_ANALYTICS = 'GET_PURCHASE_ANALYTICS'
}

export interface ExtensionMessage<T = unknown> {
  type: MessageType;
  payload?: T;
  tabId?: number;
  timestamp: number;
  requestId?: string; // For tracking request/response pairs
}

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ExtensionError;
  requestId?: string;
}

export interface ExtensionError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// Storage keys for extension data
export const STORAGE_KEYS = {
  USER: 'booster_user',
  SETTINGS: 'booster_settings',
  PREFERENCES: 'booster_preferences',
  WATCHES: 'booster_watches',
  ALERTS: 'booster_alerts',
  AUTH_TOKEN: 'booster_auth_token',
  LAST_SYNC: 'booster_last_sync'
} as const;

// Utility types
export type RetailerId = 'bestbuy' | 'walmart' | 'costco' | 'samsclub';

// Supported retailers configuration
export const SUPPORTED_RETAILERS: Record<RetailerId, RetailerInfo> = {
  bestbuy: {
    id: 'bestbuy',
    name: 'Best Buy',
    domain: 'bestbuy.com',
    isSupported: true,
    hasCartIntegration: true
  },
  walmart: {
    id: 'walmart',
    name: 'Walmart',
    domain: 'walmart.com',
    isSupported: true,
    hasCartIntegration: true
  },
  costco: {
    id: 'costco',
    name: 'Costco',
    domain: 'costco.com',
    isSupported: true,
    hasCartIntegration: false
  },
  samsclub: {
    id: 'samsclub',
    name: "Sam's Club",
    domain: 'samsclub.com',
    isSupported: true,
    hasCartIntegration: false
  }
} as const;

// Helper functions for type safety
export const isValidRetailerId = (id: string): id is RetailerId => {
  return id in SUPPORTED_RETAILERS;
};

export const getRetailerInfo = (id: RetailerId): RetailerInfo => {
  return SUPPORTED_RETAILERS[id];
};

// Type guards for runtime validation
export const isUser = (obj: unknown): obj is User => {
  return typeof obj === 'object' && obj !== null &&
    'id' in obj && typeof (obj as any).id === 'string' &&
    'email' in obj && typeof (obj as any).email === 'string' &&
    'subscriptionTier' in obj && Object.values(SubscriptionTier).includes((obj as any).subscriptionTier) &&
    'isAuthenticated' in obj && typeof (obj as any).isAuthenticated === 'boolean';
};

export const isExtensionMessage = (obj: unknown): obj is ExtensionMessage => {
  return typeof obj === 'object' && obj !== null &&
    'type' in obj && Object.values(MessageType).includes((obj as any).type) &&
    'timestamp' in obj && typeof (obj as any).timestamp === 'number';
};

// Validation helpers
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePrice = (price: number): boolean => {
  return typeof price === 'number' && price >= 0 && isFinite(price);
};