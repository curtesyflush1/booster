// Retailer integration types and interfaces

export interface RetailerConfig {
  id: string;
  name: string;
  slug: string;
  type: 'api' | 'affiliate' | 'scraping';
  baseUrl: string;
  apiKey?: string | undefined;
  rateLimit: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
  timeout: number;
  retryConfig: {
    maxRetries: number;
    retryDelay: number;
  };
  headers?: Record<string, string>;
  isActive: boolean;
}

export interface ProductAvailabilityRequest {
  productId: string;
  sku?: string | undefined;
  upc?: string | undefined;
  zipCode?: string | undefined;
  radiusMiles?: number | undefined;
}

export interface ProductAvailabilityResponse {
  productId: string;
  retailerId: string;
  inStock: boolean;
  price?: number | undefined;
  originalPrice?: number | undefined;
  availabilityStatus: 'in_stock' | 'low_stock' | 'out_of_stock' | 'pre_order' | 'discontinued';
  productUrl: string;
  cartUrl?: string | undefined;
  stockLevel?: number | undefined;
  storeLocations?: StoreLocation[] | undefined;
  lastUpdated: Date;
  metadata?: Record<string, any> | undefined;
}

export interface StoreLocation {
  storeId: string;
  storeName: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone?: string | undefined;
  distanceMiles?: number | undefined;
  inStock: boolean;
  stockLevel?: number | undefined;
  price?: number | undefined;
}

export interface RetailerHealthStatus {
  retailerId: string;
  isHealthy: boolean;
  responseTime: number;
  successRate: number;
  lastChecked: Date;
  errors: string[];
  circuitBreakerState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

export interface RetailerMetrics {
  retailerId: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  rateLimitHits: number;
  circuitBreakerTrips: number;
  lastRequestTime: Date;
}

export interface RateLimitState {
  requestCount: number;
  windowStart: Date;
  isLimited: boolean;
}

export class RetailerError extends Error {
  retailerId: string;
  errorType: 'NETWORK' | 'RATE_LIMIT' | 'AUTH' | 'PARSING' | 'NOT_FOUND' | 'SERVER_ERROR';
  statusCode?: number | undefined;
  retryable: boolean;

  constructor(
    message: string,
    retailerId: string,
    errorType: RetailerError['errorType'],
    statusCode?: number,
    retryable: boolean = false
  ) {
    super(message);
    this.name = 'RetailerError';
    this.retailerId = retailerId;
    this.errorType = errorType;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

export abstract class BaseRetailerService {
  protected config: RetailerConfig;
  protected metrics: RetailerMetrics;
  protected rateLimitState: RateLimitState;

  constructor(config: RetailerConfig) {
    this.config = config;
    this.metrics = {
      retailerId: config.id,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      rateLimitHits: 0,
      circuitBreakerTrips: 0,
      lastRequestTime: new Date()
    };
    this.rateLimitState = {
      requestCount: 0,
      windowStart: new Date(),
      isLimited: false
    };
  }

  abstract checkAvailability(request: ProductAvailabilityRequest): Promise<ProductAvailabilityResponse>;
  abstract searchProducts(query: string): Promise<ProductAvailabilityResponse[]>;
  abstract getHealthStatus(): Promise<RetailerHealthStatus>;

  protected abstract makeRequest(url: string, options?: any): Promise<any>;
  protected abstract parseResponse(response: any, request: ProductAvailabilityRequest): ProductAvailabilityResponse;

  public getMetrics(): RetailerMetrics {
    return { ...this.metrics };
  }

  public getConfig(): RetailerConfig {
    return { ...this.config };
  }

  protected updateMetrics(success: boolean, responseTime: number): void {
    this.metrics.totalRequests++;
    this.metrics.lastRequestTime = new Date();
    
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    // Update average response time
    const totalTime = this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + responseTime;
    this.metrics.averageResponseTime = totalTime / this.metrics.totalRequests;
  }

  protected checkRateLimit(): boolean {
    const now = new Date();
    const windowDuration = 60 * 1000; // 1 minute

    // Reset window if needed
    if (now.getTime() - this.rateLimitState.windowStart.getTime() >= windowDuration) {
      this.rateLimitState.requestCount = 0;
      this.rateLimitState.windowStart = now;
      this.rateLimitState.isLimited = false;
    }

    // Check if we're at the limit
    if (this.rateLimitState.requestCount >= this.config.rateLimit.requestsPerMinute) {
      this.rateLimitState.isLimited = true;
      this.metrics.rateLimitHits++;
      return false;
    }

    this.rateLimitState.requestCount++;
    return true;
  }

  protected createRetailerError(
    message: string,
    errorType: RetailerError['errorType'],
    statusCode?: number,
    retryable: boolean = false
  ): RetailerError {
    return new RetailerError(message, this.config.id, errorType, statusCode, retryable);
  }
}