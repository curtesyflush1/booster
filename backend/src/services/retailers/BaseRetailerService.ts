import axios, { AxiosInstance, AxiosResponse, AxiosRequestConfig } from 'axios';
import { HttpFetcherService } from '../HttpFetcherService';
import { BaseRetailerService as IBaseRetailerService, RetailerConfig, ProductAvailabilityRequest, ProductAvailabilityResponse, RetailerHealthStatus, StoreLocation, RetailerError } from '../../types/retailer';
import { logger } from '../../utils/logger';
import { RETAILER_RATE_LIMITS } from '../../constants';

/**
 * Enhanced BaseRetailerService implementation that provides common functionality
 * for all retailer integrations, reducing code duplication and standardizing behavior.
 */
export abstract class BaseRetailerService extends IBaseRetailerService {
  protected httpClient: AxiosInstance;
  protected httpFetcher: HttpFetcherService;
  protected lastRequestTime: number = 0;
  protected readonly minRequestInterval: number;
  private readonly scrapeUserAgent: string;

  constructor(config: RetailerConfig) {
    super(config);
    
    // Set minimum request interval based on retailer type
    this.minRequestInterval = this.calculateMinRequestInterval();
    
    // Choose a stable User-Agent per instance for scraping retailers
    this.scrapeUserAgent = this.pickScrapingUserAgent();
    
    // Initialize fetcher before HTTP client (headers may depend on session key)
    this.httpFetcher = new HttpFetcherService();
    // Initialize HTTP client with common configuration
    this.httpClient = this.createHttpClient();
    
    // Setup common interceptors
    this.setupRequestInterceptors();
    this.setupResponseInterceptors();
  }

  /**
   * Calculate minimum request interval based on retailer type and rate limits
   */
  protected calculateMinRequestInterval(): number {
    const baseInterval = RETAILER_RATE_LIMITS.BASE_REQUEST_INTERVAL / this.config.rateLimit.requestsPerMinute;
    
    // Add extra delay for scraping-based retailers to be more polite
    if (this.config.type === 'scraping') {
      return Math.max(baseInterval, RETAILER_RATE_LIMITS.SCRAPING_MIN_INTERVAL);
    }
    
    return baseInterval;
  }

  /**
   * Create and configure the HTTP client with common settings
   */
  protected createHttpClient(): AxiosInstance {
    const defaultHeaders: Record<string, string> = this.buildDefaultHeaders();

    return axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        ...defaultHeaders,
        ...this.config.headers
      }
    });
  }

  /**
   * Build default headers for outbound requests. For scraping retailers, use
   * a realistic browser-like profile to reduce 403/anti-bot responses.
   */
  protected buildDefaultHeaders(): Record<string, string> {
    if (this.config.type === 'scraping') {
      return {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': this.getSessionUserAgent()
      };
    }

    return {
      'Accept': 'application/json',
      'User-Agent': 'BoosterBeacon/1.0'
    };
  }

  // Pick a realistic Chrome UA string; stable per service instance
  private pickScrapingUserAgent(): string {
    if (this.config.type !== 'scraping') return 'BoosterBeacon/1.0';
    const pool = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
    ];
    const hash = Array.from(this.config.id).reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 997, 7);
    return pool[hash % pool.length]!;
  }

  // Slight UA variance per session while staying realistic
  private getSessionUserAgent(): string {
    if (this.config.type !== 'scraping') return 'BoosterBeacon/1.0';
    const pool = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
    ];
    const sessionKey = this.httpFetcher?.getSessionKey?.() || '';
    const seed = `${this.config.id}:${sessionKey}`;
    const hash = Array.from(seed).reduce((h, c) => (h * 33 + c.charCodeAt(0)) % 4099, 13);
    return pool[hash % pool.length]!;
  }

  /**
   * Setup common request interceptors for rate limiting and polite delays
   */
  protected setupRequestInterceptors(): void {
    this.httpClient.interceptors.request.use(async (config) => {
      // Check rate limiting
      if (!this.checkRateLimit()) {
        throw this.createRetailerError(
          'Rate limit exceeded',
          'RATE_LIMIT',
          429,
          true
        );
      }

      // Implement polite delay between requests
      await this.enforcePoliteDelay();

      // Add retailer-specific authentication if needed
      this.addAuthenticationHeaders(config);

      return config;
    });
  }

  /**
   * Setup common response interceptors for error handling
   */
  protected setupResponseInterceptors(): void {
    this.httpClient.interceptors.response.use(
      (response) => response,
      (error) => {
        // Handle common HTTP errors
        if (error.response?.status === 429) {
          throw this.createRetailerError(
            'Rate limit exceeded',
            'RATE_LIMIT',
            429,
            true
          );
        }
        
        if (error.response?.status === 401 || error.response?.status === 403) {
          const message = this.config.type === 'scraping' 
            ? 'Access forbidden - possible bot detection'
            : 'Authentication failed';
          throw this.createRetailerError(
            message,
            'AUTH',
            error.response.status,
            false
          );
        }
        
        if (error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND') {
          throw this.createRetailerError(
            'Network error',
            'NETWORK',
            undefined,
            true
          );
        }
        
        throw error;
      }
    );
  }

  /**
   * Enforce polite delay between requests, especially for scraping
   */
  protected async enforcePoliteDelay(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      const delay = this.minRequestInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Add authentication headers based on retailer configuration
   */
  protected addAuthenticationHeaders(config: AxiosRequestConfig): void {
    if (this.config.apiKey) {
      // Different retailers use different authentication methods
      switch (this.config.id) {
        case 'best-buy':
        case 'bestbuy':
          if (config.params) {
            (config.params as any).apiKey = this.config.apiKey;
          } else {
            config.params = { apiKey: this.config.apiKey } as any;
          }
          break;
        case 'walmart':
          if (config.headers) {
            config.headers['WM_SVC.NAME'] = 'Walmart Open API';
            config.headers['WM_CONSUMER.ID'] = this.config.apiKey;
          }
          break;
        default:
          // Generic API key header
          if (config.headers) {
            config.headers['Authorization'] = `Bearer ${this.config.apiKey}`;
          }
          break;
      }
    }
  }

  /**
   * Common implementation for making HTTP requests with error handling
   */
  protected async makeRequest(url: string, options: any = {}): Promise<AxiosResponse> {
    try {
      // Enforce polite delay and rate limits (interceptors also handle, but we double-guard here)
      if (!this.checkRateLimit()) {
        throw this.createRetailerError('Rate limit exceeded', 'RATE_LIMIT', 429, true);
      }
      await this.enforcePoliteDelay();

      // Build absolute URL when relative path provided
      const fullUrl = url.startsWith('http') ? url : `${this.config.baseUrl || ''}${url}`;

      // Apply auth/headers
      const reqConfig: AxiosRequestConfig = {
        headers: { ...(options.headers || {}) },
        params: options.params || {}
      };
      this.addAuthenticationHeaders(reqConfig);

      // For API-type integrations without rendering needs, use axios client to match unit test expectations
      if (this.config.type === 'api' && options.render !== true) {
        // Translate fullUrl back to path when baseURL is set to avoid double base
        const path = fullUrl.startsWith(String(this.config.baseUrl))
          ? fullUrl.substring(String(this.config.baseUrl).length) || '/'
          : fullUrl;
        const res = await this.httpClient.get(path, reqConfig);
        return res;
      }

      // Otherwise use the fetcher (proxy/browser) which supports rendering/unblockers.
      // Important: Include realistic default headers for scraping retailers since the
      // axios client defaults are not applied via the fetcher path.
      const fetchHeaders: Record<string, string> = {
        ...this.buildDefaultHeaders(),
        ...(this.config.headers || {}),
        ...(reqConfig.headers as Record<string, string>)
      };

      const res = await this.httpFetcher.get(fullUrl, {
        params: reqConfig.params as any,
        headers: fetchHeaders,
        timeout: this.config.timeout,
        render: options.render === true,
        retailerId: this.config.id,
      });

      // Emulate AxiosResponse shape minimally for callers
      const fakeAxiosResponse: AxiosResponse = {
        data: res.data,
        status: res.status,
        statusText: String(res.status),
        headers: res.headers as any,
        config: reqConfig,
        request: {}
      } as any;
      return fakeAxiosResponse;
    } catch (error: any) {
      const status = error?.response?.status;
      if (this.config.type === 'scraping' && (status === 403 || status === 429)) {
        // Attempt: rotate forward proxy session and retry once
        try {
          this.httpFetcher.rotateForwardProxySession?.();
          const fullUrl2 = url.startsWith('http') ? url : `${this.config.baseUrl || ''}${url}`;
          const retryRes = await this.httpFetcher.get(fullUrl2, {
            params: options.params || {},
            headers: {
              ...this.buildDefaultHeaders(),
              ...(this.config.headers || {}),
              ...(options.headers || {})
            },
            timeout: this.config.timeout,
            retailerId: this.config.id,
          });
          const fakeAxiosResponse: AxiosResponse = {
            data: retryRes.data,
            status: retryRes.status,
            statusText: String(retryRes.status),
            headers: retryRes.headers as any,
            config: {},
            request: {}
          } as any;
          return fakeAxiosResponse;
        } catch (e1) {
          // Fallback: attempt browser API if configured
          try {
            const fullUrl3 = url.startsWith('http') ? url : `${this.config.baseUrl || ''}${url}`;
            const browserRes = await this.httpFetcher.getWithBrowser(fullUrl3, {
              params: options.params || {},
              headers: {
                ...this.buildDefaultHeaders(),
                ...(this.config.headers || {}),
                ...(options.headers || {})
              },
              timeout: Math.max(this.config.timeout, 30000),
              retailerId: this.config.id,
            });
            const fakeAxiosResponse: AxiosResponse = {
              data: browserRes.data,
              status: browserRes.status,
              statusText: String(browserRes.status),
              headers: browserRes.headers as any,
              config: {},
              request: {}
            } as any;
            return fakeAxiosResponse;
          } catch (e2) {
            // fallthrough to error log below
          }
        }
      }

      logger.error(`HTTP request failed for ${this.config.id}:`, {
        url,
        error: error instanceof Error ? error.message : 'Unknown error',
        retailerId: this.config.id
      });
      throw error;
    }
  }

  /**
   * Common health check implementation
   */
  async getHealthStatus(): Promise<RetailerHealthStatus> {
    const startTime = Date.now();
    const errors: string[] = [];
    let isHealthy = true;

    try {
      // Perform a simple health check request
      await this.performHealthCheck();
      
      const responseTime = Date.now() - startTime;
      const successRate = this.calculateSuccessRate();

      // Determine health thresholds based on retailer type
      const { successThreshold, responseTimeThreshold } = this.getHealthThresholds();

      if (successRate < successThreshold) {
        isHealthy = false;
        errors.push(`Low success rate: ${successRate.toFixed(1)}%`);
      }
      
      if (responseTime > responseTimeThreshold) {
        isHealthy = false;
        errors.push(`High response time: ${responseTime}ms`);
      }

      return {
        retailerId: this.config.id,
        isHealthy,
        responseTime,
        successRate,
        lastChecked: new Date(),
        errors,
        circuitBreakerState: 'CLOSED'
      };
      
    } catch (error) {
      errors.push(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        retailerId: this.config.id,
        isHealthy: false,
        responseTime: Date.now() - startTime,
        successRate: this.calculateSuccessRate(),
        lastChecked: new Date(),
        errors,
        circuitBreakerState: 'OPEN'
      };
    }
  }

  /**
   * Perform retailer-specific health check - can be overridden by subclasses
   */
  protected async performHealthCheck(): Promise<void> {
    // Default implementation - simple request to base URL or search endpoint
    if (this.config.type === 'api') {
      await this.makeRequest('/search', {
        params: { q: 'test', limit: 1 }
      });
    } else {
      await this.makeRequest('/', {});
    }
  }

  /**
   * Calculate current success rate
   */
  protected calculateSuccessRate(): number {
    return this.metrics.totalRequests > 0 
      ? (this.metrics.successfulRequests / this.metrics.totalRequests) * 100 
      : 100;
  }

  /**
   * Get health check thresholds based on retailer type
   */
  protected getHealthThresholds(): { successThreshold: number; responseTimeThreshold: number } {
    if (this.config.type === 'scraping') {
      return {
        successThreshold: 80, // Lower threshold for scraping
        responseTimeThreshold: 10000 // 10 seconds for scraping
      };
    }
    
    return {
      successThreshold: 90, // Higher threshold for APIs
      responseTimeThreshold: 5000 // 5 seconds for APIs
    };
  }

  /**
   * Common utility to check if a product is Pokemon TCG related
   */
  protected isPokemonTcgProduct(name: string, additionalText: string = ''): boolean {
    const text = `${name} ${additionalText}`.toLowerCase();

    // Must mention Pokémon and a TCG-specific term
    const mustHaveAll = [
      ['pokemon', 'pokémon'],
      ['tcg', 'trading card', 'booster', 'elite trainer', 'etb', 'deck', 'collection', 'collection box', 'tin', 'box']
    ];

    const excluded = [
      // Generic non-TCG merchandise
      'gift card', 'popsocket', 'popgrip', 'phone grip', 'magSafe', 'mouse pad', 'keyboard', 'headset', 'controller',
      'case', 'charger', 'cable', 'screen protector', 'bag', 'backpack', 'lunch box', 'wallet', 'mug', 'bottle',
      'plush', 'figure', 'funko', 'lego', 'construction set', 'mega ', 'megablocks', 'nanoblock',
      // Completely irrelevant items that can appear on fuzzy search
      'water flosser', 'toothbrush', 'aquasonic', 'appliance'
    ];

    const hasAllMust = mustHaveAll.every(group => group.some(k => text.includes(k)));
    if (!hasAllMust) return false;

    const hitExcluded = excluded.some(k => text.includes(k));
    return !hitExcluded;
  }

  /**
   * Common utility to parse price from various text formats
   */
  protected parsePrice(priceText: string): number {
    if (!priceText) return 0;
    
    // Handle various price formats: "$29.99", "29.99", "$29.99 - $39.99", "Member's Mark $29.99"
    const match = priceText.match(/\$?(\d+\.?\d*)/);
    return match && match[1] ? parseFloat(match[1]) : 0;
  }

  /**
   * Common utility to determine availability status from various indicators
   */
  protected determineAvailabilityStatus(
    inStock: boolean,
    availabilityText?: string,
    stockLevel?: number
  ): ProductAvailabilityResponse['availabilityStatus'] {
    if (!inStock) {
      return 'out_of_stock';
    }
    
    if (availabilityText) {
      const text = availabilityText.toLowerCase();
      if (text.includes('pre-order') || text.includes('preorder')) {
        return 'pre_order';
      }
      if (text.includes('limited') || text.includes('low stock')) {
        return 'low_stock';
      }
      if (text.includes('discontinued')) {
        return 'discontinued';
      }
    }
    
    if (stockLevel !== undefined && stockLevel > 0 && stockLevel <= 5) {
      return 'low_stock';
    }
    
    return 'in_stock';
  }

  // -------- Shipping/Delivery Helpers (shared) --------
  protected parseShippingDate(text: string): string | null {
    if (!text) return null;
    const t = text.toLowerCase();
    const now = new Date();

    // Relative terms
    if (/\btoday\b/.test(t)) {
      const d = new Date(); d.setHours(0,0,0,0);
      return d.toISOString();
    }
    if (/\btomorrow\b/.test(t)) {
      const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(0,0,0,0);
      return d.toISOString();
    }

    // Day-of-week (with optional prefixes "this"/"next")
    const dowNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const mDow = t.match(/\b(?:this|next)?\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
    if (mDow) {
      const want = dowNames.indexOf(mDow[1]);
      if (want >= 0) {
        const current = now.getDay();
        let offset = (want - current + 7) % 7;
        if (offset === 0 && /\bnext\b/.test(t)) offset = 7; // "next <dow>" means following week
        const d = new Date(now); d.setDate(now.getDate() + offset); d.setHours(0,0,0,0);
        return d.toISOString();
      }
    }

    // Numeric date: MM/DD or M/D
    const mNum = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
    if (mNum) {
      const mm = parseInt(mNum[1], 10) - 1; // 0-based
      const dd = parseInt(mNum[2], 10);
      let yy = now.getFullYear();
      if (mNum[3]) {
        const y = parseInt(mNum[3], 10);
        yy = y < 100 ? 2000 + y : y;
      }
      const candidate = new Date(yy, mm, dd);
      if (!mNum[3] && candidate.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) {
        candidate.setFullYear(yy + 1);
      }
      candidate.setHours(0,0,0,0);
      return candidate.toISOString();
    }

    // Month name + day (e.g., Arrives Fri, Oct 4)
    const monthMap: Record<string, number> = {
      jan: 0, january: 0,
      feb: 1, february: 1,
      mar: 2, march: 2,
      apr: 3, april: 3,
      may: 4,
      jun: 5, june: 5,
      jul: 6, july: 6,
      aug: 7, august: 7,
      sep: 8, sept: 8, september: 8,
      oct: 9, october: 9,
      nov: 10, november: 10,
      dec: 11, december: 11
    };
    const m = t.match(/\b(?:arrives|get it by|get it on|ships by|shipping arrives|delivery by|delivers by|estimated (?:delivery|ship)s?)\b[^A-Za-z0-9]*?(?:[a-z]+,\s*)?([a-z]{3,9})\s+(\d{1,2})/i);
    if (m) {
      const monName = m[1].toLowerCase();
      const dayNum = parseInt(m[2], 10);
      const mon = monthMap[monName];
      if (mon !== undefined && !isNaN(dayNum)) {
        let year = now.getFullYear();
        const candidate = new Date(year, mon, dayNum);
        const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (candidate.getTime() < todayMid.getTime()) year += 1;
        const finalDate = new Date(year, mon, dayNum);
        finalDate.setHours(0,0,0,0);
        return finalDate.toISOString();
      }
    }

    return null;
  }

  protected findShippingInfoInElement($: any, $el: any): { text?: string; dateIso?: string } {
    try {
      const sel = [
        '[data-test*="fulfillment"], [data-test*="shipping"], [data-test*="delivery"]',
        '.availability, .fulfillment, .shipping, .delivery',
        '.a-color-success, .a-text-bold, .a-color-base',
        ':contains("Arrives"), :contains("arrives"), :contains("Get it by"), :contains("get it by"), :contains("Get it on"), :contains("get it on"), :contains("delivery"), :contains("Delivery"), :contains("Ships"), :contains("ships"), :contains("Release Date"), :contains("release date")'
      ].join(',');
      const node = $el.find(sel).first();
      const text = (node.text() || '').trim();
      if (!text) return {};
      const dateIso = this.parseShippingDate(text) || undefined;
      return { text, dateIso };
    } catch {
      return {};
    }
  }

  /**
   * Common utility to build cart URL from product URL
   */
  protected buildCartUrl(productUrl: string, retailerId: string): string | undefined {
    if (!productUrl) return undefined;
    
    switch (retailerId) {
      case 'walmart':
        return `${productUrl}?athbdg=L1600`;
      case 'bestbuy':
        // Best Buy provides direct cart URLs in their API
        return undefined;
      case 'costco':
      case 'samsclub':
        // These retailers don't provide direct cart URLs
        return undefined;
      default:
        return undefined;
    }
  }

  /**
   * Common method to handle request/response logging
   */
  protected logRequest(method: string, url: string, success: boolean, responseTime: number): void {
    const logData = {
      retailerId: this.config.id,
      method,
      url,
      success,
      responseTime,
      timestamp: new Date().toISOString()
    };

    if (success) {
      logger.info(`${this.config.name} request successful`, logData);
    } else {
      logger.warn(`${this.config.name} request failed`, logData);
    }
  }

  /**
   * Enhanced updateMetrics with additional logging
   */
  protected override updateMetrics(success: boolean, responseTime: number): void {
    super.updateMetrics(success, responseTime);
    
    // Log metrics periodically
    if (this.metrics.totalRequests % 10 === 0) {
      logger.info(`${this.config.name} metrics update`, {
        retailerId: this.config.id,
        totalRequests: this.metrics.totalRequests,
        successRate: this.calculateSuccessRate(),
        averageResponseTime: this.metrics.averageResponseTime,
        rateLimitHits: this.metrics.rateLimitHits
      });
    }
  }
}
