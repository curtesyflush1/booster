export interface RetailerConfig {
  id: string;
  name: string;
  slug: string;
  type: 'api' | 'scraping';
  baseUrl: string;
  apiKey?: string;
  rateLimit: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
  timeout: number;
  retryConfig: {
    maxRetries: number;
    retryDelay: number;
  };
  isActive: boolean;
}

export interface ProductAvailabilityRequest {
  productId: string;
  sku?: string;
  upc?: string;
}

export interface ProductAvailabilityResponse {
  productId: string;
  inStock: boolean;
  price?: number;
  url: string;
}
