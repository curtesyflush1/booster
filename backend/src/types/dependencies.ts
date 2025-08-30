import { Knex } from 'knex';

/**
 * Core dependency interfaces for dependency injection
 */

// System metrics types for better type safety
export interface ISystemMetrics {
  cpuMetric: ICPUMetric;
  memoryMetric: IMemoryMetric;
  diskMetric: IDiskMetric;
  responseTimeMetric: IResponseTimeMetric;
  errorRateMetric: IErrorRateMetric;
}

export interface ICPUMetric {
  usage: number;
  loadAverage: number[];
  timestamp: Date;
}

export interface IMemoryMetric {
  used: number;
  total: number;
  percentage: number;
  heapUsed: number;
  heapTotal: number;
}

export interface IDiskMetric {
  used: number;
  total: number;
  percentage: number;
  available: number;
}

export interface IResponseTimeMetric {
  average: number;
  p95: number;
  p99: number;
  count: number;
}

export interface IErrorRateMetric {
  rate: number;
  count: number;
  total: number;
}

export interface IUserStatistics {
  totalUsers: number;
  activeUsers: number;
  newToday: number;
  newThisWeek: number;
  proUsers: number;
}

export interface IAlertStatistics {
  totalAlerts: number;
  alertsToday: number;
  pendingAlerts: number;
  failedAlerts: number;
  avgDeliveryTime: number;
}

export interface IMLModelStatistics {
  activeModels: number;
  trainingModels: number;
  lastTraining: Date | null;
}

// Additional supporting interfaces
export interface IPaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface IPaginatedResult<T> {
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

export interface IUserCreationData {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  timezone?: string;
}

export interface IUserPreferences {
  notifications?: boolean;
  quiet_hours?: {
    enabled: boolean;
    start_time: string;
    end_time: string;
    timezone: string;
    days: number[];
  };
  theme?: 'light' | 'dark' | 'auto';
}

export interface INotificationSettings {
  email: boolean;
  push: boolean;
  sms: boolean;
  discord: boolean;
}

export interface IShippingAddress {
  id?: string;
  name: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  is_default?: boolean;
}

export interface IUserStats {
  totalWatches: number;
  activeWatches: number;
  totalAlerts: number;
  alertsThisMonth: number;
  joinDate: Date;
  lastLogin: Date;
}

export interface IDatabaseConnection {
  getKnex(): Knex;
}

export interface ILogger {
  info(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
}

export interface IUserRepository {
  findById<T = any>(id: string): Promise<T | null>;
  findByEmail<T = any>(email: string): Promise<T | null>;
  findOneBy<T = any>(criteria: Partial<T>): Promise<T | null>;
  findAll<T = any>(options?: IPaginationOptions): Promise<IPaginatedResult<T>>;
  createUser<T = any>(userData: IUserCreationData): Promise<T>;
  updateById<T = any>(id: string, data: Partial<T>): Promise<T | null>;
  updatePreferences(userId: string, preferences: IUserPreferences): Promise<boolean>;
  updateNotificationSettings(userId: string, settings: INotificationSettings): Promise<boolean>;
  addShippingAddress(userId: string, address: IShippingAddress): Promise<boolean>;
  removeShippingAddress(userId: string, addressId: string): Promise<boolean>;
  getUserStats(userId: string): Promise<IUserStats>;
  verifyPassword(password: string, hash: string): Promise<boolean>;
  updatePassword(userId: string, newPassword: string): Promise<boolean>;
  handleFailedLogin(userId: string): Promise<void>;
  handleSuccessfulLogin(userId: string): Promise<void>;
  isAccountLocked(userId: string): Promise<boolean>;
  setResetToken(userId: string, token: string, expiresAt: Date): Promise<boolean>;
  verifyEmail(userId: string): Promise<boolean>;
}

export interface IAlertRepository {
  findById<T = any>(id: string): Promise<T | null>;
  findBy<T = any>(criteria: Partial<T>): Promise<T[]>;
  createAlert<T = any>(alertData: IAlertCreationData): Promise<T>;
  updateById<T = any>(id: string, data: Partial<T>): Promise<T | null>;
  markAsSent(alertId: string, channels: string[]): Promise<boolean>;
  markAsFailed(alertId: string, reason: string): Promise<boolean>;
  getPendingAlerts(limit: number): Promise<IAlert[]>;
  getFailedAlertsForRetry(maxRetries: number): Promise<IAlert[]>;
  getAlertsByUser(userId: string, options?: IPaginationOptions): Promise<IPaginatedResult<IAlert>>;
  getAlertsByType(type: string, options?: IPaginationOptions): Promise<IPaginatedResult<IAlert>>;
  deleteExpiredAlerts(olderThan: Date): Promise<number>;
  // Additional methods from AlertRepository implementation
  findByUserId(userId: string, limit?: number): Promise<IAlert[]>;
  getStats(): Promise<{
    pending: number;
    failed: number;
    sent: number;
    total: number;
  }>;
  bulkCreate(alerts: Partial<IAlert>[]): Promise<IAlert[]>;
  deleteOldAlerts(olderThanDays: number): Promise<number>;
}

export interface IAlert {
  id: string;
  user_id: string;
  product_id: string;
  retailer_id: string;
  watch_id?: string;
  type: 'restock' | 'price_drop' | 'low_stock' | 'pre_order';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  data: Record<string, any>;
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

export interface IAlertCreationData {
  user_id: string;
  product_id: string;
  retailer_id: string;
  watch_id?: string;
  type: IAlert['type'];
  priority?: IAlert['priority'];
  data: Record<string, any>;
  delivery_channels: string[];
}

export interface IProductRepository {
  findById<T>(id: string): Promise<T | null>;
  findBy<T>(criteria: Partial<T>): Promise<T[]>;
}

export interface IWatchRepository {
  findById<T>(id: string): Promise<T | null>;
  updateById<T>(id: string, data: Partial<T>): Promise<T | null>;
}

export interface ISystemRepository {
  recordHealthCheck(serviceName: string, status: string, metrics: Record<string, any>, message?: string): Promise<void>;
  getSystemHealth(): Promise<any[]>;
  recordMetric(metricName: string, metricType: string, value: number, labels: Record<string, any>): Promise<void>;
  getSystemMetrics(startTime: Date): Promise<ISystemMetrics>;
  getUserStatistics(today: Date, weekAgo: Date, now: Date): Promise<IUserStatistics>;
  getAlertStatistics(today: Date): Promise<IAlertStatistics>;
  getMLModelStatistics(): Promise<IMLModelStatistics>;
}

/**
 * Service dependencies container
 */
export interface IServiceDependencies {
  userRepository: IUserRepository;
  alertRepository: IAlertRepository;
  productRepository: IProductRepository;
  watchRepository: IWatchRepository;
  systemRepository: ISystemRepository;
  logger: ILogger;
  database: IDatabaseConnection;
}

/**
 * Factory interface for creating service instances
 */
export interface IServiceFactory {
  createAuthService(dependencies: Partial<IServiceDependencies>): any;
  createAlertProcessingService(dependencies: Partial<IServiceDependencies>): any;
  createCredentialService(dependencies: Partial<IServiceDependencies>): any;
  createQuietHoursService(dependencies: Partial<IServiceDependencies>): any;
  createAdminSystemService(dependencies: Partial<IServiceDependencies>): any;
}