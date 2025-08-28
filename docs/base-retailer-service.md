# BaseRetailerService Architecture

## Overview

The `BaseRetailerService` is a comprehensive base class that provides common functionality for all retailer integrations in BoosterBeacon. This architecture eliminates code duplication, standardizes behavior, and simplifies the addition of new retailers.

## Recent Refactoring (August 28, 2025)

### Code Reduction Achieved
- **Total lines removed**: ~325 lines of duplicated code
- **Files refactored**: 4 retailer services (BestBuy, Walmart, Costco, Sam's Club)
- **New test coverage**: 21 comprehensive tests for base functionality
- **Maintainability**: Single source of truth for common retailer logic

## Architecture Benefits

### Before Refactoring
```
BestBuyService ──┐
WalmartService ──┼── Each service duplicated:
CostcoService ───┤   • HTTP client setup (~80 lines each)
SamsClubService ─┘   • Rate limiting logic (~70 lines each)
                     • Error handling (~90 lines each)
                     • Authentication (~85 lines each)
                     • Utility methods
```

### After Refactoring
```
BaseRetailerService ──┬── Common logic:
                      │   • HTTP client management
                      │   • Rate limiting & delays
                      │   • Error handling
                      │   • Authentication
                      │   • Utility methods
                      │   • Health checks
                      │
BestBuyService ───────┼── Retailer-specific:
WalmartService ───────┤   • API endpoints
CostcoService ────────┤   • Response parsing
SamsClubService ──────┘   • Product mapping
```

## Core Features

### HTTP Client Management
- **Automatic Setup**: Creates configured HTTP clients with retailer-specific headers
- **Type-Specific Configuration**: Different headers for API vs scraping retailers
- **Connection Pooling**: Efficient connection reuse with keep-alive
- **Timeout Management**: Configurable timeouts per retailer type

```typescript
// API retailers get JSON headers
{
  'Accept': 'application/json',
  'User-Agent': 'BoosterBeacon/1.0'
}

// Scraping retailers get browser headers
{
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...'
}
```

### Intelligent Rate Limiting
- **Configurable Intervals**: Different minimum intervals for API vs scraping
- **Polite Delays**: Automatic enforcement of delays between requests
- **Request Tracking**: Monitors last request time to enforce intervals
- **Type-Aware**: API retailers get faster intervals, scrapers get longer delays

```typescript
// Rate limiting calculation
const baseInterval = 60000 / this.config.rateLimit.requestsPerMinute;

// Add extra delay for scraping retailers
if (this.config.type === 'scraping') {
  return Math.max(baseInterval, 2000); // Minimum 2 seconds
}
```

### Authentication Management
- **Automatic Injection**: API keys automatically added to requests
- **Retailer-Specific**: Different authentication methods per retailer
- **Secure Handling**: Keys never logged or exposed in errors

```typescript
// Best Buy: Query parameter
config.params.apikey = this.config.apiKey;

// Walmart: Custom headers
config.headers['WM_SVC.NAME'] = 'Walmart Open API';
config.headers['WM_CONSUMER.ID'] = this.config.apiKey;

// Generic: Bearer token
config.headers['Authorization'] = `Bearer ${this.config.apiKey}`;
```

### Error Handling & Retry Logic
- **Standardized Errors**: Consistent error types across all retailers
- **Automatic Retries**: Exponential backoff with jitter
- **Circuit Breaker**: Prevents cascading failures
- **Detailed Logging**: Comprehensive error context for debugging

```typescript
// Common error types
- RATE_LIMIT (429)
- AUTH (401/403) 
- NETWORK (connection issues)
- SERVER_ERROR (500)
- NOT_FOUND (404)
```

### Health Monitoring
- **Automatic Checks**: Regular health verification
- **Performance Metrics**: Response time and success rate tracking
- **Threshold-Based**: Different health criteria for API vs scraping
- **Circuit Breaker Integration**: Health status affects circuit breaker state

```typescript
// Health thresholds
API retailers: {
  successThreshold: 90%, // Higher threshold
  responseTimeThreshold: 5000ms
}

Scraping retailers: {
  successThreshold: 80%, // Lower threshold  
  responseTimeThreshold: 10000ms
}
```

### Pokemon TCG Product Filtering
- **Built-in Logic**: Automatic filtering for Pokemon TCG products
- **Keyword Detection**: Comprehensive keyword matching
- **Exclusion Rules**: Filters out non-TCG Pokemon products
- **Configurable**: Easy to extend with new keywords

```typescript
const pokemonKeywords = [
  'pokemon', 'pokémon', 'tcg', 'trading card', 'booster', 
  'elite trainer', 'battle deck', 'starter deck', 'theme deck',
  'collection box', 'tin', 'premium collection'
];

const excludeKeywords = [
  'video game', 'plush', 'figure', 'toy', 'clothing', 
  'accessory', 'keychain', 'backpack', 'lunch box'
];
```

### Utility Methods
- **Price Parsing**: Handles various price formats across retailers
- **Availability Status**: Standardizes availability indicators
- **Cart URL Generation**: Creates retailer-specific cart links
- **Response Logging**: Structured logging for monitoring

```typescript
// Price parsing examples
'$29.99' → 29.99
'29.99' → 29.99  
'$29.99 - $39.99' → 29.99 (lowest price)
'Member\'s Mark $29.99' → 29.99
```

## Implementation Guide

### Creating a New Retailer Service

```typescript
import { BaseRetailerService } from './BaseRetailerService';
import { RetailerConfig, ProductAvailabilityRequest, ProductAvailabilityResponse } from '../types/retailer';

export class NewRetailerService extends BaseRetailerService {
  constructor(config: RetailerConfig) {
    super(config);
    
    // Retailer-specific validation
    if (!config.apiKey && config.type === 'api') {
      throw new Error('API key required for this retailer');
    }
  }

  async checkAvailability(request: ProductAvailabilityRequest): Promise<ProductAvailabilityResponse> {
    const startTime = Date.now();
    
    try {
      // Use base class HTTP client
      const response = await this.makeRequest('/products/search', {
        params: { sku: request.sku }
      });
      
      // Parse response using base class utilities
      const product = this.parseProductData(response.data);
      const result = this.parseResponse(product, request);
      
      // Update metrics via base class
      this.updateMetrics(true, Date.now() - startTime);
      
      return result;
    } catch (error) {
      this.updateMetrics(false, Date.now() - startTime);
      throw error; // Base class handles error standardization
    }
  }

  async searchProducts(query: string): Promise<ProductAvailabilityResponse[]> {
    // Implementation using base class utilities
  }

  protected parseResponse(data: any, request: ProductAvailabilityRequest): ProductAvailabilityResponse {
    // Use base class utilities
    const inStock = data.available;
    const price = this.parsePrice(data.price);
    const availabilityStatus = this.determineAvailabilityStatus(inStock, data.status);
    
    return {
      productId: request.productId,
      retailerId: this.config.id,
      inStock,
      price,
      availabilityStatus,
      productUrl: data.url,
      cartUrl: this.buildCartUrl(data.url, this.config.id),
      lastUpdated: new Date(),
      metadata: data
    };
  }
}
```

### Configuration Example

```typescript
const newRetailerConfig: RetailerConfig = {
  id: 'new-retailer',
  name: 'New Retailer',
  slug: 'new-retailer',
  type: 'api', // or 'scraping'
  baseUrl: 'https://api.newretailer.com',
  apiKey: process.env.NEW_RETAILER_API_KEY,
  rateLimit: {
    requestsPerMinute: 60,
    requestsPerHour: 3600
  },
  timeout: 10000,
  retryConfig: {
    maxRetries: 3,
    retryDelay: 1000
  },
  isActive: true
};
```

## Testing

### Base Class Test Coverage
The BaseRetailerService includes comprehensive test coverage:

```typescript
describe('BaseRetailerService', () => {
  // HTTP client configuration (5 tests)
  // Rate limiting functionality (4 tests)  
  // Pokemon TCG filtering (8 tests)
  // Utility methods (6 tests)
  // Health checks (3 tests)
  // Metrics tracking (2 tests)
  // Error handling (3 tests)
  // Total: 21 tests
});
```

### Testing New Retailers

```typescript
describe('NewRetailerService', () => {
  let service: NewRetailerService;
  
  beforeEach(() => {
    service = new NewRetailerService(mockConfig);
  });

  it('should inherit base class functionality', () => {
    expect(service.getMetrics).toBeDefined();
    expect(service.getHealthStatus).toBeDefined();
    expect(service['isPokemonTcgProduct']).toBeDefined();
  });

  it('should implement retailer-specific methods', async () => {
    const result = await service.checkAvailability(mockRequest);
    expect(result.retailerId).toBe('new-retailer');
  });
});
```

## Performance Benefits

### Reduced Memory Footprint
- **Shared Code**: Common functionality loaded once
- **Efficient Caching**: Shared HTTP clients and connection pools
- **Optimized Parsing**: Reusable utility functions

### Improved Response Times
- **Connection Reuse**: HTTP keep-alive across all retailers
- **Intelligent Caching**: Shared caching strategies
- **Optimized Rate Limiting**: Efficient delay calculations

### Better Error Recovery
- **Consistent Retry Logic**: Standardized across all retailers
- **Circuit Breaker**: Prevents resource waste on failing services
- **Health Monitoring**: Proactive issue detection

## Monitoring and Metrics

### Automatic Metrics Collection
```typescript
interface RetailerMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  rateLimitHits: number;
  circuitBreakerTrips: number;
  lastRequestTime: Date;
  circuitBreakerState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}
```

### Health Status Reporting
```typescript
interface RetailerHealthStatus {
  retailerId: string;
  isHealthy: boolean;
  responseTime: number;
  successRate: number;
  lastChecked: Date;
  errors: string[];
  circuitBreakerState: string;
}
```

## Future Enhancements

### Planned Improvements
- **Smart Retry**: ML-based retry strategies
- **Dynamic Rate Limiting**: Adaptive rate limits based on retailer response
- **Advanced Caching**: Redis-based distributed caching
- **Request Queuing**: Priority-based request scheduling
- **A/B Testing**: Compare different integration strategies

### Extension Points
- **Custom Headers**: Retailer-specific header injection
- **Response Transformation**: Pluggable response processors  
- **Authentication Strategies**: Support for OAuth, JWT, etc.
- **Monitoring Hooks**: Custom metrics and alerting integration

## Best Practices

### When Extending BaseRetailerService
1. **Minimal Override**: Only override methods when necessary
2. **Call Super**: Always call parent methods when overriding
3. **Error Handling**: Let base class handle common errors
4. **Metrics**: Use base class metrics tracking
5. **Logging**: Follow base class logging patterns

### Configuration Guidelines
1. **Conservative Limits**: Start with lower rate limits
2. **Realistic Timeouts**: Account for network latency
3. **Proper Authentication**: Secure API key management
4. **Health Thresholds**: Set appropriate success rates
5. **Circuit Breaker**: Configure failure thresholds

### Testing Requirements
1. **Base Functionality**: Test inherited methods work correctly
2. **Retailer-Specific**: Focus tests on custom implementation
3. **Error Scenarios**: Test all error conditions
4. **Performance**: Verify rate limiting compliance
5. **Integration**: End-to-end testing with mock services

This BaseRetailerService architecture provides a robust, maintainable foundation for all retailer integrations while significantly reducing code duplication and improving consistency across the system.