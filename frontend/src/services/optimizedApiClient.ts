import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { ErrorHandler } from '../utils/errorHandler';
import { logger } from '../utils/logger';

interface RequestCache {
  [key: string]: {
    data: unknown;
    timestamp: number;
    ttl: number;
  };
}

interface RetryConfig {
  retries: number;
  retryDelay: number;
  retryCondition?: (error: unknown) => boolean;
}

class OptimizedApiClient {
  private client: AxiosInstance;
  private cache: RequestCache = {};
  private requestQueue: Map<string, Promise<AxiosResponse<any>>> = new Map();
  private readonly defaultCacheTTL = 5 * 60 * 1000; // 5 minutes
  private readonly defaultRetryConfig: RetryConfig = {
    retries: 3,
    retryDelay: 1000,
    retryCondition: (error) => {
      if (error && typeof error === 'object' && 'response' in error && error.response && typeof error.response === 'object' && 'status' in error.response) {
        return (error.response.status as number) >= 500;
      }
      if (error && typeof error === 'object' && 'code' in error) {
        return error.code === 'NETWORK_ERROR';
      }
      return false;
    }
  };

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_URL || '/api',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    this.setupInterceptors();
    
    // Clean expired cache entries every 5 minutes
    setInterval(() => this.cleanExpiredCache(), 5 * 60 * 1000);
  }

  /**
   * Setup request and response interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add auth token if available
        const token = this.getStoredToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Add request ID for tracking
        config.headers['X-Request-ID'] = this.generateRequestId();

        logger.debug('API Request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          requestId: config.headers['X-Request-ID']
        });

        return config;
      },
      (error) => {
        logger.error('Request interceptor error', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('API Response', {
          status: response.status,
          url: response.config.url,
          requestId: response.config.headers['X-Request-ID']
        });

        return response;
      },
      (error) => {
        const appError = ErrorHandler.handleApiError(error);
        
        // Trigger auth error event for 401s
        if (error.response?.status === 401) {
          window.dispatchEvent(new CustomEvent('auth-error'));
        }

        logger.error('API Error', {
          error: appError,
          url: error.config?.url,
          requestId: error.config?.headers['X-Request-ID']
        });

        return Promise.reject(appError);
      }
    );
  }

  /**
   * GET request with caching and deduplication
   */
  async get<T = unknown>(
    url: string, 
    config?: AxiosRequestConfig & { 
      cache?: boolean; 
      cacheTTL?: number;
      retry?: Partial<RetryConfig>;
    }
  ): Promise<AxiosResponse<T>> {
    const cacheKey = this.getCacheKey('GET', url, config?.params);
    
    // Check cache first
    if (config?.cache !== false) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        logger.debug('Cache hit', { url, cacheKey });
        return { data: cached } as AxiosResponse<T>;
      }
    }

    // Check if request is already in flight (deduplication)
    const existingRequest = this.requestQueue.get(cacheKey);
    if (existingRequest) {
      logger.debug('Request deduplication', { url, cacheKey });
      return existingRequest;
    }

    // Make request with retry logic
    const requestPromise = this.executeWithRetry(
      () => this.client.get<T>(url, config),
      { ...this.defaultRetryConfig, ...config?.retry }
    );

    // Store in request queue
    this.requestQueue.set(cacheKey, requestPromise);

    try {
      const response = await requestPromise;
      
      // Cache successful responses
      if (config?.cache !== false && response.status === 200) {
        this.setCache(
          cacheKey, 
          response.data, 
          config?.cacheTTL || this.defaultCacheTTL
        );
      }

      return response;
    } finally {
      // Remove from request queue
      this.requestQueue.delete(cacheKey);
    }
  }

  /**
   * POST request with retry logic
   */
  async post<T = any>(
    url: string, 
    data?: any, 
    config?: AxiosRequestConfig & { retry?: Partial<RetryConfig> }
  ): Promise<AxiosResponse<T>> {
    return this.executeWithRetry(
      () => this.client.post<T>(url, data, config),
      { ...this.defaultRetryConfig, ...config?.retry }
    );
  }

  /**
   * PUT request with retry logic
   */
  async put<T = any>(
    url: string, 
    data?: any, 
    config?: AxiosRequestConfig & { retry?: Partial<RetryConfig> }
  ): Promise<AxiosResponse<T>> {
    return this.executeWithRetry(
      () => this.client.put<T>(url, data, config),
      { ...this.defaultRetryConfig, ...config?.retry }
    );
  }

  /**
   * DELETE request with retry logic
   */
  async delete<T = any>(
    url: string, 
    config?: AxiosRequestConfig & { retry?: Partial<RetryConfig> }
  ): Promise<AxiosResponse<T>> {
    return this.executeWithRetry(
      () => this.client.delete<T>(url, config),
      { ...this.defaultRetryConfig, ...config?.retry }
    );
  }

  /**
   * Execute request with retry logic
   */
  private async executeWithRetry<T>(
    requestFn: () => Promise<T>,
    retryConfig: RetryConfig
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= retryConfig.retries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error;

        // Don't retry on last attempt or if retry condition fails
        if (
          attempt === retryConfig.retries || 
          !retryConfig.retryCondition?.(error)
        ) {
          break;
        }

        // Wait before retry with exponential backoff
        const delay = retryConfig.retryDelay * Math.pow(2, attempt);
        await this.sleep(delay);

        logger.debug('Retrying request', {
          attempt: attempt + 1,
          maxRetries: retryConfig.retries,
          delay
        });
      }
    }

    throw lastError;
  }

  /**
   * Set authentication token
   */
  setAuthToken(token: string, remember: boolean = false): void {
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem('auth_token', token);
  }

  /**
   * Clear authentication token
   */
  clearAuthToken(): void {
    localStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_token');
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.getStoredToken();
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache = {};
    logger.debug('API cache cleared');
  }

  /**
   * Clean expired cache entries to prevent memory leaks
   */
  private cleanExpiredCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, cached] of Object.entries(this.cache)) {
      if (now > cached.timestamp + cached.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => delete this.cache[key]);
    
    if (keysToDelete.length > 0) {
      logger.debug('Cleaned expired cache entries', { count: keysToDelete.length });
    }
  }

  /**
   * Get stored token
   */
  private getStoredToken(): string | null {
    return localStorage.getItem('auth_token') || 
           sessionStorage.getItem('auth_token');
  }

  /**
   * Generate cache key
   */
  private getCacheKey(method: string, url: string, params?: Record<string, unknown>): string {
    const paramString = params ? JSON.stringify(params) : '';
    return `${method}:${url}:${paramString}`;
  }

  /**
   * Get data from cache
   */
  private getFromCache(key: string): unknown | null {
    const cached = this.cache[key];
    if (!cached) return null;

    if (Date.now() > cached.timestamp + cached.ttl) {
      delete this.cache[key];
      return null;
    }

    return cached.data;
  }

  /**
   * Set data in cache
   */
  private setCache(key: string, data: unknown, ttl: number): void {
    this.cache[key] = {
      data,
      timestamp: Date.now(),
      ttl
    };
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const apiClient = new OptimizedApiClient();
