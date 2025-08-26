// Core database interface definitions for BoosterBeacon
import { SubscriptionTier } from './subscription';

export interface IUser {
  id: string;
  email: string;
  password_hash: string;
  subscription_tier: SubscriptionTier;
  first_name?: string;
  last_name?: string;
  email_verified: boolean;
  verification_token?: string | null;
  reset_token?: string | null;
  reset_token_expires?: Date | null;
  failed_login_attempts: number;
  locked_until?: Date | null;
  last_login?: Date;
  shipping_addresses: IAddress[];
  payment_methods: IPaymentMethod[];
  retailer_credentials: Record<string, IRetailerCredential>;
  notification_settings: INotificationSettings;
  quiet_hours: IQuietHours;
  timezone: string;
  zip_code?: string;
  preferences: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface IAddress {
  id: string;
  type: 'shipping' | 'billing';
  first_name: string;
  last_name: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  phone?: string;
  is_default: boolean;
}

export interface IPaymentMethod {
  id: string;
  type: 'credit_card' | 'debit_card' | 'paypal';
  last_four: string;
  brand: string;
  expires_month: number;
  expires_year: number;
  is_default: boolean;
  billing_address_id: string;
}

export interface IRetailerCredential {
  username: string;
  encrypted_password: string;
  two_factor_enabled: boolean;
  last_verified: Date;
  is_active: boolean;
}

export interface INotificationSettings {
  web_push: boolean;
  email: boolean;
  sms: boolean;
  discord: boolean;
  webhook_url?: string;
  discord_webhook?: string;
}

export interface IQuietHours {
  enabled: boolean;
  start_time: string; // HH:MM format
  end_time: string; // HH:MM format
  timezone: string;
  days: number[]; // 0-6, Sunday = 0
}

export interface IRetailer {
  id: string;
  name: string;
  slug: string;
  website_url: string;
  api_type: 'official' | 'affiliate' | 'scraping';
  api_config: Record<string, any>;
  is_active: boolean;
  rate_limit_per_minute: number;
  health_score: number;
  last_health_check?: Date;
  supported_features: string[];
  created_at: Date;
  updated_at: Date;
}

export interface IProductCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parent_id?: string;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface IProduct {
  id: string;
  name: string;
  slug: string;
  sku?: string;
  upc?: string;
  category_id?: string;
  set_name?: string;
  series?: string;
  release_date?: Date;
  msrp?: number;
  image_url?: string;
  description?: string;
  metadata: Record<string, any>;
  is_active: boolean;
  popularity_score: number;
  created_at: Date;
  updated_at: Date;
}

export interface IProductAvailability {
  id: string;
  product_id: string;
  retailer_id: string;
  in_stock: boolean;
  price?: number;
  original_price?: number;
  availability_status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'pre_order';
  product_url: string;
  cart_url?: string;
  stock_level?: number;
  store_locations: IStoreLocation[];
  last_checked: Date;
  last_in_stock?: Date;
  last_price_change?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface IStoreLocation {
  store_id: string;
  store_name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  distance_miles?: number;
  in_stock: boolean;
  stock_level?: number;
}

export interface IWatch {
  id: string;
  user_id: string;
  product_id: string;
  retailer_ids: string[];
  max_price?: number;
  availability_type: 'online' | 'in_store' | 'both';
  zip_code?: string;
  radius_miles?: number;
  is_active: boolean;
  alert_preferences: Record<string, any>;
  last_alerted?: Date;
  alert_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface IWatchPack {
  id: string;
  name: string;
  slug: string;
  description?: string;
  product_ids: string[];
  is_active: boolean;
  auto_update: boolean;
  update_criteria?: string;
  subscriber_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface IUserWatchPack {
  id: string;
  user_id: string;
  watch_pack_id: string;
  customizations: Record<string, any>;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface IAlert {
  id: string;
  user_id: string;
  product_id: string;
  retailer_id: string;
  watch_id?: string;
  type: 'restock' | 'price_drop' | 'low_stock' | 'pre_order';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  data: IAlertData;
  status: 'pending' | 'sent' | 'failed' | 'read';
  delivery_channels: string[];
  scheduled_for?: Date;
  sent_at?: Date;
  read_at?: Date;
  clicked_at?: Date;
  failure_reason?: string;
  retry_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface IAlertData {
  product_name: string;
  retailer_name: string;
  price?: number;
  original_price?: number;
  availability_status: string;
  product_url: string;
  cart_url?: string;
  expires_at?: Date;
  stock_level?: number;
  store_locations?: IStoreLocation[];
}

export interface IAlertDelivery {
  id: string;
  alert_id: string;
  channel: 'web_push' | 'email' | 'sms' | 'discord';
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';
  external_id?: string;
  metadata: Record<string, any>;
  sent_at?: Date;
  delivered_at?: Date;
  failure_reason?: string;
  retry_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface IPriceHistory {
  id: string;
  product_id: string;
  retailer_id: string;
  price: number;
  original_price?: number;
  in_stock: boolean;
  availability_status?: string;
  recorded_at: Date;
}

export interface IUserSession {
  id: string;
  user_id: string;
  refresh_token: string;
  device_info?: string;
  ip_address?: string;
  user_agent?: string;
  expires_at: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ISystemHealth {
  id: string;
  service_name: string;
  status: 'healthy' | 'degraded' | 'down';
  metrics: Record<string, any>;
  message?: string;
  checked_at: Date;
}

// Input/Output types for API operations
export interface IUserRegistration {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

export interface ILoginCredentials {
  email: string;
  password: string;
}

export interface IAuthToken {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: 'Bearer';
}

export interface IWatchFilters {
  retailer_ids?: string[];
  max_price?: number;
  availability_type?: 'online' | 'in_store' | 'both';
  zip_code?: string;
  radius_miles?: number;
}

export interface IAvailabilityStatus {
  in_stock: boolean;
  price?: number;
  availability_status: string;
  last_checked: Date;
  store_locations?: IStoreLocation[];
}

export interface IWatchStatus {
  is_active: boolean;
  last_checked?: Date;
  alert_count: number;
  last_alerted?: Date;
}

// Validation schemas and error types
export interface IValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface IDatabaseError {
  code: string;
  message: string;
  constraint?: string;
  table?: string;
  column?: string;
}

// Database query result types for type safety
export interface ICountResult {
  count: string | number;
}

export interface IStatResult {
  [key: string]: string | number | undefined;
  count: string | number;
}

export interface ISumResult {
  [key: string]: string | number | null | undefined;
}

// Utility types for paginated results
export interface IPaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// Statistics result types
export interface IUserStats {
  total: number;
  active: number;
  totalAlerts: number;
  recentAlerts: number;
}

export interface ISystemStats {
  totalAlerts: number;
  pendingAlerts: number;
  failedAlerts: number;
  avgDeliveryTime: number;
}