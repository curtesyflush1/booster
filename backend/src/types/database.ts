// Core database interface definitions for BoosterBeacon
import { SubscriptionTier } from './subscription';

export interface IUser {
  id: string;
  email: string;
  password_hash: string;
  subscription_tier: SubscriptionTier;
  role: 'user' | 'admin' | 'super_admin' | 'user_manager' | 'content_manager' | 'ml_engineer' | 'analyst' | 'support_agent' | 'billing_manager' | 'security_officer';
  first_name?: string;
  last_name?: string;
  email_verified: boolean;
  verification_token?: string | null;
  reset_token?: string | null;
  reset_token_expires?: Date | null;
  failed_login_attempts: number;
  locked_until?: Date | null;
  last_login?: Date;
  last_admin_login?: Date;
  admin_permissions: string[] | string;
  direct_permissions?: string[];
  role_last_updated?: Date;
  role_updated_by?: string;
  permission_metadata?: Record<string, any>;
  shipping_addresses: IAddress[];
  payment_methods: IPaymentMethod[];
  retailer_credentials: Record<string, IRetailerCredential>;
  notification_settings: INotificationSettings;
  quiet_hours: IQuietHours;
  push_subscriptions?: IPushSubscription[];
  timezone: string;
  zip_code?: string;
  preferences: Record<string, any>;
  // Subscription billing fields
  stripe_customer_id?: string;
  subscription_id?: string;
  subscription_status?: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing';
  subscription_start_date?: Date;
  subscription_end_date?: Date;
  trial_end_date?: Date;
  cancel_at_period_end?: boolean;
  // Stripe/local plan identifier (e.g., 'pro-monthly', 'premium-monthly' or price id)
  subscription_plan_id?: string;
  usage_stats?: IUsageStats;
  billing_address?: IAddress;
  created_at: Date;
  updated_at: Date;
}

export interface IUsageStats {
  watches_used: number;
  alerts_sent: number;
  api_calls: number;
  last_reset: string | null;
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

export interface IPushSubscription {
  id?: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  createdAt?: Date;
  lastUsed?: Date;
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

// Admin-related interfaces
export interface IAdminAuditLog {
  id: string;
  admin_user_id: string;
  action: string;
  target_type?: string;
  target_id?: string;
  details: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
  updated_at: Date;
}

export interface IMLModel {
  id: string;
  name: string;
  version: string;
  status: 'training' | 'active' | 'deprecated' | 'failed';
  config: Record<string, any>;
  metrics: Record<string, any>;
  model_path?: string;
  training_started_at?: Date;
  training_completed_at?: Date;
  deployed_at?: Date;
  trained_by?: string;
  training_notes?: string;
  created_at: Date;
  updated_at: Date;
}

export interface IMLTrainingData {
  id: string;
  dataset_name: string;
  data_type: string;
  data: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string;
  reviewed_at?: Date;
  review_notes?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ISystemMetric {
  id: string;
  metric_name: string;
  metric_type: 'gauge' | 'counter' | 'histogram';
  value: number;
  labels: Record<string, any>;
  recorded_at: Date;
}

// Admin dashboard data types
export interface IAdminDashboardStats {
  users: {
    total: number;
    active: number;
    new_today: number;
    new_this_week: number;
    pro_subscribers: number;
    conversion_rate: number;
  };
  alerts: {
    total_sent: number;
    sent_today: number;
    pending: number;
    failed: number;
    success_rate: number;
    avg_delivery_time: number;
  };
  system: {
    uptime: number;
    cpu_usage: number;
    memory_usage: number;
    disk_usage: number;
    api_response_time: number;
    error_rate: number;
  };
  ml_models: {
    active_models: number;
    training_models: number;
    last_training: Date | null;
    prediction_accuracy: number;
  };
}

export interface IUserManagementFilters {
  search?: string;
  role?: 'user' | 'admin' | 'super_admin';
  subscription_tier?: SubscriptionTier;
  email_verified?: boolean;
  is_active?: boolean;
  created_after?: Date;
  created_before?: Date;
}

export interface IAdminUserDetails extends Omit<IUser, 'password_hash'> {
  watch_count: number;
  alert_count: number;
  last_activity?: Date;
  total_spent?: number;
}

export interface ISystemHealthMetrics {
  service_name: string;
  status: 'healthy' | 'degraded' | 'down';
  response_time?: number;
  error_rate?: number;
  uptime_percentage?: number;
  last_check: Date;
  details?: Record<string, any>;
}

// Email delivery statistics interfaces
export interface IEmailDeliveryStats {
  totalSent: number;
  totalDelivered: number;
  totalBounced: number;
  totalComplained: number;
  deliveryRate: number;
  lastEmailSent?: Date;
}

export interface IEmailDeliveryStatsQueryResult {
  total_sent: string | number;
  total_delivered: string | number;
  total_bounced: string | number;
  total_complained: string | number;
  last_email_sent: string | Date | null;
}
