# Retailer Integration System

The Retailer Integration System is a core component of BoosterBeacon that monitors product availability across multiple major retailers. This document covers the complete retailer integration functionality, compliance practices, and monitoring capabilities.

## Overview

The system supports four major retailers with different integration approaches:
- **Best Buy** - Official API integration
- **Walmart** - Official API integration  
- **Costco** - Polite web scraping
- **Sam's Club** - Polite web scraping

## Architecture

### RetailerIntegrationService
The main orchestration service that manages all retailer integrations with:
- Circuit breaker pattern for resilience
- Health monitoring and metrics collection
- Rate limiting and compliance enforcement
- Unified API for product availability checking

### Individual Retailer Services
Each retailer has a dedicated service implementing the `BaseRetailerService` interface:
- `BestBuyService` - API-based integration
- `WalmartService` - API-based integration
- `CostcoService` - Scraping-based integration
- `SamsClubService` - Scraping-based integration

## Compliance and Rate Limiting

### API-Based Retailers (Best Buy, Walmart)
- **Rate Limits**: 5 requests/minute, 100 requests/hour
- **Timeout**: 10 seconds
- **Retry Policy**: 3 attempts with 1-second delays
- **Authentication**: API keys required

### Scraping-Based Retailers (Costco, Sam's Club)
- **Rate Limits**: 2 requests/minute, 50 requests/hour (conservative)
- **Timeout**: 15 seconds (patient)
- **Retry Policy**: 2 attempts with 2-second delays
- **Politeness**: 2-second minimum delay between requests
- **User Agent**: Standard browser headers to avoid detection

## Circuit Breaker Pattern

### Configuration
- **Failure Threshold**: 5 consecutive failures trigger open state
- **Recovery Timeout**: 1 minute before attempting recovery
- **Success Threshold**: 3 consecutive successes to close circuit
- **Monitoring Period**: 5 minutes for failure rate calculation

### States
- **CLOSED**: Normal operation, requests pass through
- **OPEN**: Circuit is open, requests fail fast
- **HALF_OPEN**: Testing recovery, limited requests allowed

## API Endpoints

### Product Availability
```http
POST /api/v1/retailers/check-availability
Content-Type: application/json

{
  "productId": "uuid",
  "sku": "123456",
  "upc": "123456789012",
  "retailers": ["best-buy", "walmart"]
}
```

### Search Products
```http
GET /api/v1/retailers/search?query=pokemon+tcg&retailers=best-buy,walmart
```

### Health Status
```http
GET /api/v1/retailers/health
```

Returns:
```json
{
  "success": true,
  "data": [
    {
      "retailerId": "best-buy",
      "isHealthy": true,
      "responseTime": 150,
      "successRate": 95.5,
      "lastChecked": "2024-08-26T14:30:22Z",
      "errors": [],
      "circuitBreakerState": "CLOSED"
    }
  ]
}
```

### Retailer Metrics
```http
GET /api/v1/retailers/metrics
```

Returns:
```json
{
  "success": true,
  "data": [
    {
      "retailerId": "best-buy",
      "totalRequests": 1000,
      "successfulRequests": 955,
      "failedRequests": 45,
      "averageResponseTime": 200,
      "rateLimitHits": 5,
      "circuitBreakerTrips": 1,
      "lastRequestTime": "2024-08-26T14:30:22Z",
      "circuitBreakerState": "CLOSED"
    }
  ]
}
```

### Circuit Breaker Management
```http
POST /api/v1/retailers/:retailerId/circuit-breaker/reset
```

```http
GET /api/v1/retailers/circuit-breaker/metrics
```

## Retailer-Specific Implementation

### Best Buy Service
- **API Endpoint**: `https://api.bestbuy.com/v1`
- **Authentication**: API key required
- **Product Lookup**: By SKU, UPC, or search query
- **Response Format**: JSON with standardized product data
- **Special Features**: Store availability, pricing tiers

### Walmart Service  
- **API Endpoint**: `https://api.walmartlabs.com/v1`
- **Authentication**: API key required
- **Product Lookup**: By item ID, UPC, or search
- **Response Format**: JSON with product details
- **Special Features**: Rollback pricing, online/store availability

### Costco Service
- **Base URL**: `https://www.costco.com`
- **Method**: Web scraping with Cheerio
- **Rate Limiting**: 2 requests/minute maximum
- **Politeness**: 2-second delays between requests
- **Product Detection**: Pokemon TCG keyword filtering
- **Special Features**: Member pricing, bulk quantities

### Sam's Club Service
- **Base URL**: `https://www.samsclub.com`
- **Method**: Web scraping with Cheerio
- **Rate Limiting**: 2 requests/minute maximum
- **Politeness**: 2-second delays between requests
- **Product Detection**: Pokemon TCG keyword filtering
- **Special Features**: Member pricing, club-specific availability

## Error Handling

### Error Types
- **RATE_LIMIT**: Rate limit exceeded (429)
- **AUTH**: Authentication failure (401/403)
- **NOT_FOUND**: Product not found (404)
- **NETWORK**: Network connectivity issues
- **SERVER_ERROR**: Internal server errors (500)
- **TIMEOUT**: Request timeout
- **CIRCUIT_OPEN**: Circuit breaker is open

### Retry Logic
- **Exponential Backoff**: Delays increase with each retry
- **Jitter**: Random delay component to prevent thundering herd
- **Max Retries**: Configurable per retailer type
- **Retry Conditions**: Only retry on transient errors

## Health Monitoring

### Automatic Health Checks
- **Interval**: Every 5 minutes
- **Metrics Tracked**: Response time, success rate, error counts
- **Alerting**: Unhealthy retailers trigger notifications
- **Recovery**: Automatic recovery detection and reporting

### Health Criteria
- **Response Time**: < 5 seconds for APIs, < 10 seconds for scraping
- **Success Rate**: > 90% for APIs, > 80% for scraping
- **Circuit Breaker**: Must be in CLOSED state
- **Recent Activity**: Must have processed requests recently

## Performance Optimization

### Caching Strategy
- **Response Caching**: Cache successful responses for 5 minutes
- **Error Caching**: Cache 404 errors for 1 hour
- **Health Status**: Cache health checks for 1 minute
- **Circuit Breaker**: In-memory state management

### Connection Pooling
- **Keep-Alive**: Reuse HTTP connections
- **Pool Size**: Configurable per retailer
- **Timeout Management**: Connection and request timeouts
- **DNS Caching**: Reduce DNS lookup overhead

## Security Considerations

### API Key Management
- **Environment Variables**: Store keys securely
- **Rotation**: Support for key rotation
- **Validation**: Verify keys on startup
- **Logging**: Never log sensitive credentials

### Scraping Ethics
- **Robots.txt**: Respect robots.txt directives
- **Rate Limiting**: Conservative request rates
- **User Agent**: Honest browser identification
- **Terms of Service**: Comply with retailer ToS

### Data Privacy
- **No PII**: Don't collect personal information
- **Minimal Data**: Only collect necessary product data
- **Retention**: Short-term caching only
- **Anonymization**: Remove identifying information

## Testing

### Unit Tests
- **Mock Responses**: Test with simulated retailer responses
- **Error Scenarios**: Test all error conditions
- **Rate Limiting**: Verify rate limit enforcement
- **Circuit Breaker**: Test all circuit breaker states

### Integration Tests
- **Mock Servers**: Simulate retailer APIs
- **End-to-End**: Test complete workflows
- **Performance**: Load testing with realistic traffic
- **Compliance**: Verify rate limiting compliance

### Compliance Tests
- **Rate Limit Enforcement**: Verify limits are respected
- **Polite Scraping**: Test delay implementation
- **Error Handling**: Graceful failure scenarios
- **Recovery**: Circuit breaker recovery testing

## Configuration

### Environment Variables
```bash
# API Keys
BEST_BUY_API_KEY=your_bestbuy_key
WALMART_API_KEY=your_walmart_key

# Rate Limiting
RETAILER_RATE_LIMIT_ENABLED=true
RETAILER_HEALTH_CHECK_INTERVAL=300000

# Circuit Breaker
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5
CIRCUIT_BREAKER_RECOVERY_TIMEOUT=60000
```

### Retailer Configuration
```typescript
interface RetailerConfig {
  id: string;
  name: string;
  slug: string;
  type: 'api' | 'scraping' | 'affiliate';
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
  headers?: Record<string, string>;
}
```

## Monitoring and Alerting

### Metrics Collection
- **Request Counts**: Total, successful, failed requests
- **Response Times**: Average, P95, P99 percentiles
- **Error Rates**: By error type and retailer
- **Circuit Breaker**: State changes and trip counts
- **Rate Limiting**: Limit hits and throttling events

### Alerting Rules
- **High Error Rate**: > 10% errors in 5 minutes
- **Slow Response**: > 5 second average response time
- **Circuit Breaker**: Open state for > 5 minutes
- **Rate Limit**: Excessive rate limit hits
- **Service Down**: Complete service unavailability

## Future Enhancements

### Planned Features
- **Additional Retailers**: Target, GameStop, local stores
- **Smart Retry**: ML-based retry strategies
- **Predictive Scaling**: Anticipate traffic spikes
- **Advanced Caching**: Redis-based distributed caching
- **Real-time Monitoring**: WebSocket-based status updates

### API Improvements
- **Batch Requests**: Multiple products in single request
- **Streaming**: Real-time availability updates
- **Webhooks**: Push notifications for availability changes
- **GraphQL**: Flexible query interface
- **Rate Limit Headers**: Expose rate limit status

## Troubleshooting

### Common Issues

#### High Error Rates
1. Check retailer API status
2. Verify API keys are valid
3. Review rate limiting settings
4. Check network connectivity

#### Circuit Breaker Stuck Open
1. Review error logs for root cause
2. Check retailer service health
3. Reset circuit breaker manually
4. Adjust failure thresholds if needed

#### Slow Response Times
1. Check retailer service performance
2. Review network latency
3. Optimize request payloads
4. Consider caching strategies

#### Rate Limit Violations
1. Review request patterns
2. Adjust rate limit settings
3. Implement request queuing
4. Contact retailer for limit increases

### Debugging Commands
```bash
# Check retailer health
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.boosterbeacon.com/api/v1/retailers/health"

# Reset circuit breaker
curl -X POST -H "Authorization: Bearer $TOKEN" \
  "https://api.boosterbeacon.com/api/v1/retailers/best-buy/circuit-breaker/reset"

# View metrics
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.boosterbeacon.com/api/v1/retailers/metrics"
```

## Compliance Statement

BoosterBeacon's retailer integration system is designed with compliance and ethical practices as top priorities:

- **Official APIs First**: We prioritize official retailer APIs over scraping
- **Respectful Rate Limits**: Conservative request rates that respect retailer infrastructure
- **Terms of Service**: Full compliance with retailer terms of service
- **No Automation**: Server-side integration is for monitoring only, not automated purchasing
- **Transparency**: Clear identification in requests and honest user agents
- **Data Minimization**: Collect only necessary product availability data

This system enables collectors to stay informed about product availability while maintaining respectful relationships with retail partners.