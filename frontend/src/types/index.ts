// Core application types for BoosterBeacon frontend

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  subscriptionTier: 'free' | 'pro';
  role: 'user' | 'admin' | 'super_admin';
  profile: UserProfile;
  preferences: UserPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  firstName?: string;
  lastName?: string;
  avatar?: string;
  shippingAddresses: Address[];
  paymentMethods: PaymentMethod[];
  retailerCredentials: RetailerCredential[];
}

export interface UserPreferences {
  notificationChannels: NotificationChannel[];
  quietHours: QuietHours;
  alertFilters: AlertFilters;
  locationSettings: LocationSettings;
  theme: 'light' | 'dark' | 'system';
  language: string;
}

export interface Address {
  id: string;
  type: 'shipping' | 'billing';
  firstName: string;
  lastName: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone?: string;
  isDefault: boolean;
}

export interface PaymentMethod {
  id: string;
  type: 'credit_card' | 'debit_card' | 'paypal';
  last4: string;
  brand: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
  billingAddress: Address;
}

export interface RetailerCredential {
  id: string;
  retailerId: string;
  retailerName: string;
  username: string;
  isActive: boolean;
  lastVerified: string;
  createdAt: string;
}

export interface NotificationChannel {
  type: 'web_push' | 'email' | 'sms' | 'discord';
  enabled: boolean;
  settings: Record<string, unknown>;
}

export interface QuietHours {
  enabled: boolean;
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  timezone: string;
  days: number[]; // 0-6, Sunday = 0
}

export interface AlertFilters {
  maxPrice?: number;
  minPrice?: number;
  retailers: string[];
  categories: string[];
  inStockOnly: boolean;
  preOrderEnabled: boolean;
}

export interface LocationSettings {
  zipCode?: string;
  radius: number; // miles
  storeIds: string[];
  onlineOnly: boolean;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  upc: string;
  category: ProductCategory;
  set: string;
  series: string;
  releaseDate: string;
  msrp: number;
  imageUrl: string;
  thumbnailUrl: string;
  description?: string;
  metadata: ProductMetadata;
  availability?: ProductAvailability[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
  imageUrl?: string;
}

export interface ProductMetadata {
  cardCount?: number;
  packType: 'booster' | 'theme' | 'starter' | 'collection' | 'tin' | 'box';
  rarity?: string;
  language: string;
  region: string;
  tags: string[];
}

export interface ProductAvailability {
  id: string;
  productId: string;
  retailerId: string;
  retailerName: string;
  inStock: boolean;
  price: number;
  originalPrice?: number;
  url: string;
  cartUrl?: string;
  lastChecked: string;
  storeLocations?: StoreLocation[];
}

export interface StoreLocation {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone?: string;
  inStock: boolean;
  quantity?: number;
}

export interface Watch {
  id: string;
  userId: string;
  productId: string;
  product: Product;
  filters: WatchFilters;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastAlertSent?: string;
  alertCount: number;
}

export interface WatchFilters {
  maxPrice?: number;
  retailers: string[];
  onlineOnly: boolean;
  storeIds: string[];
  notifyOnPreOrder: boolean;
  notifyOnPriceChange: boolean;
}

export interface WatchPack {
  id: string;
  name: string;
  description: string;
  productIds: string[];
  products: Product[];
  isActive: boolean;
  subscriberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Alert {
  id: string;
  userId: string;
  productId: string;
  product: Product;
  retailerId: string;
  retailerName: string;
  type: AlertType;
  priority: AlertPriority;
  data: AlertData;
  isRead: boolean;
  createdAt: string;
  deliveredAt?: string;
  clickedAt?: string;
  status: AlertStatus;
}

export type AlertType = 'restock' | 'price_drop' | 'pre_order' | 'low_stock' | 'back_in_stock';
export type AlertPriority = 'low' | 'medium' | 'high' | 'urgent';
export type AlertStatus = 'pending' | 'sent' | 'delivered' | 'clicked' | 'expired' | 'failed';

export interface AlertData {
  productName: string;
  retailerName: string;
  price: number;
  originalPrice?: number;
  availability: 'in_stock' | 'low_stock' | 'pre_order';
  cartUrl?: string;
  productUrl: string;
  imageUrl?: string;
  expiresAt?: string;
  priceChange?: {
    oldPrice: number;
    newPrice: number;
    percentChange: number;
  };
}

export interface Retailer {
  id: string;
  name: string;
  slug: string;
  website: string;
  logoUrl: string;
  isActive: boolean;
  supportsApi: boolean;
  supportsCart: boolean;
  healthStatus: RetailerHealthStatus;
  lastChecked: string;
}

export interface RetailerHealthStatus {
  status: 'healthy' | 'degraded' | 'down';
  responseTime: number;
  errorRate: number;
  lastError?: string;
  uptime: number;
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  tokenType: 'Bearer';
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  acceptTerms: boolean;
  subscribeNewsletter?: boolean;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordReset {
  token: string;
  password: string;
}

export interface ApiError {
  code: string;
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface SearchFilters {
  query?: string;
  category?: string;
  retailer?: string;
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  sortBy?: 'name' | 'price' | 'releaseDate' | 'popularity';
  sortOrder?: 'asc' | 'desc';
}

export interface DashboardStats {
  totalWatches: number;
  activeWatches: number;
  totalAlerts: number;
  unreadAlerts: number;
  successfulPurchases: number;
  savedAmount: number;
  recentAlerts: number;
  clickThroughRate: number;
}

export interface MLPrediction {
  productId: string;
  productName?: string;
  priceForcast: {
    nextWeek: number;
    nextMonth: number;
    confidence: number;
  };
  basicTrend?: {
    direction: 'up' | 'down' | 'flat';
    percent: number;
    window?: string;
  };
  selloutRisk: {
    score: number; // 0-100
    timeframe: string;
    confidence: number;
  };
  roiEstimate: {
    shortTerm: number; // 3 months
    longTerm: number; // 1 year
    confidence: number;
  };
  hypeScore: number; // 0-100
  updatedAt: string;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'down';
  services: {
    api: ServiceStatus;
    database: ServiceStatus;
    cache: ServiceStatus;
    notifications: ServiceStatus;
    retailers: ServiceStatus;
  };
  metrics: {
    responseTime: number;
    errorRate: number;
    uptime: number;
  };
  lastUpdated: string;
}

export interface ServiceStatus {
  status: 'healthy' | 'degraded' | 'down';
  responseTime?: number;
  errorRate?: number;
  lastError?: string;
}

// Route types
export interface RouteConfig {
  path: string;
  component: React.ComponentType;
  protected?: boolean;
  title?: string;
  description?: string;
}

// Theme types
export interface ThemeConfig {
  mode: 'light' | 'dark' | 'system';
  primaryColor: string;
  accentColor: string;
  pokemonTheme: boolean;
}

// PWA types
export interface PWAInstallPrompt {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Notification types
export interface NotificationPermissionState {
  permission: NotificationPermission;
  isSupported: boolean;
  isServiceWorkerSupported: boolean;
  canRequestPermission: boolean;
}

export interface PushNotificationStats {
  subscriptionCount: number;
  notificationsSent: number;
  lastNotificationSent?: Date;
}

// Form types
export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'select' | 'checkbox' | 'textarea';
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
}

export interface FormState {
  values: Record<string, unknown>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
}

// Analytics types
export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, unknown>;
  timestamp?: string;
  userId?: string;
  sessionId?: string;
}

export interface UserAnalytics {
  pageViews: number;
  sessionDuration: number;
  alertsClicked: number;
  purchasesCompleted: number;
  lastActive: string;
}
