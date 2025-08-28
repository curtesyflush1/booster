# Price Comparison System

## Overview

The Price Comparison System is a comprehensive solution for cross-retailer price analysis, deal identification, and price drop alerts. It implements requirements 22.1-22.5 from the BoosterBeacon specification.

## Features

### 1. Cross-Retailer Price Comparison (Requirement 22.1)
- Aggregates pricing data from all supported retailers
- Provides real-time price comparisons for individual products
- Calculates average prices and price ranges
- Identifies the best deals across retailers

### 2. Deal Identification System (Requirement 22.2)
- Automatically identifies deals based on price drops and savings
- Calculates deal scores using multiple factors:
  - Savings percentage and amount
  - Historical price context
  - Product availability
  - Cart link availability
  - Data freshness
- Filters deals by minimum savings thresholds

### 3. Price Drop Alerts (Requirement 22.3)
- Monitors price changes across all retailers
- Sends alerts when significant price drops occur
- Respects user preferences for minimum savings
- Implements intelligent deduplication to prevent spam
- Supports different alert types: price_drop, best_deal, historical_low

### 4. Historical Price Tracking (Requirement 22.4)
- Tracks price history for all products across retailers
- Provides above/below average price indicators
- Identifies historical lows and price trends
- Supports configurable time ranges (1-365 days)

### 5. Deal Scoring for Pro Users (Requirement 22.5)
- Advanced deal scoring algorithm (0-100 scale)
- Considers multiple factors:
  - Price competitiveness (40 points)
  - Availability status (20 points)
  - Discount percentage (20 points)
  - Cart link availability (10 points)
  - Data freshness (10 points)
- Pro users get enhanced scoring and filtering options

## API Endpoints

### Public Endpoints

#### GET /api/price-comparison/products/:productId
Get price comparison for a single product.

**Query Parameters:**
- `includeHistory` (boolean): Include historical price context

**Response:**
```json
{
  "success": true,
  "data": {
    "productId": "string",
    "productName": "string",
    "retailers": [
      {
        "retailerId": "string",
        "retailerName": "string",
        "price": 4.99,
        "originalPrice": 6.99,
        "inStock": true,
        "availabilityStatus": "in_stock",
        "productUrl": "string",
        "cartUrl": "string",
        "dealScore": 85,
        "savings": 2.00,
        "savingsPercentage": 28.61
      }
    ],
    "bestDeal": { /* retailer object */ },
    "averagePrice": 5.24,
    "priceRange": { "min": 4.99, "max": 5.49 },
    "historicalContext": {
      "isAboveAverage": false,
      "isAtHistoricalLow": true,
      "averageHistoricalPrice": 5.49,
      "priceChangePercentage": -10.5
    }
  }
}
```

#### POST /api/price-comparison/products/batch
Get price comparisons for multiple products (max 50).

**Request Body:**
```json
{
  "productIds": ["id1", "id2"],
  "includeHistory": false
}
```

#### GET /api/price-comparison/products/:productId/history
Get price history for a product.

**Query Parameters:**
- `days` (1-365): Number of days to retrieve
- `retailerId` (optional): Filter by specific retailer

#### GET /api/price-comparison/deals
Get current deals across all products.

**Query Parameters:**
- `minSavings` (number): Minimum savings percentage (default: 10)
- `minScore` (number): Minimum deal score (default: 70)
- `includeOutOfStock` (boolean): Include out-of-stock items
- `retailers` (array): Filter by retailer IDs
- `limit` (1-100): Maximum results to return

#### GET /api/price-comparison/products/:productId/trends
Analyze price trends for a product.

**Query Parameters:**
- `days` (1-90): Analysis timeframe

### Authenticated Endpoints

#### GET /api/price-comparison/my-deals
Get best deals for the authenticated user's watchlist.

**Query Parameters:**
- `minSavings` (number): Minimum savings percentage (default: 5)
- `limit` (1-50): Maximum results to return

## Services

### PriceComparisonService
Core service for price comparison functionality.

**Key Methods:**
- `getProductPriceComparison()`: Get comprehensive price comparison
- `getMultipleProductComparisons()`: Batch price comparisons
- `identifyDeals()`: Find current deals with scoring
- `getProductPriceHistory()`: Retrieve historical pricing data
- `analyzePriceTrends()`: Analyze price movement patterns
- `getBestDealsForUser()`: Get personalized deals for user's watchlist

### PriceDropAlertService
Handles automated price monitoring and alert generation.

**Key Methods:**
- `monitorPriceChanges()`: Monitor all active watches for price changes
- `setUserPriceDropPreferences()`: Configure user alert preferences
- `getPriceDropStatistics()`: Get analytics for admin dashboard

## Deal Scoring Algorithm

The deal scoring system uses a 100-point scale:

1. **Price Competitiveness (0-40 points)**
   - Based on how close the price is to the minimum available price
   - Formula: `40 - (priceRatio - 1) * 40`

2. **Availability Bonus (0-20 points)**
   - In stock: 20 points
   - Low stock: 10 points
   - Out of stock: 0 points

3. **Discount Bonus (0-20 points)**
   - Based on savings percentage from original price
   - Capped at 20 points for very high discounts

4. **Cart Link Bonus (0-10 points)**
   - 10 points if direct cart link is available
   - 0 points for product page links only

5. **Freshness Bonus (0-10 points)**
   - 10 points if data is less than 1 hour old
   - 5 points if data is less than 6 hours old
   - 0 points for older data

## Price Drop Alert Types

### price_drop
Standard price drop alert when a product's price decreases significantly.

### best_deal
Alert when a product becomes the best deal across all retailers (Pro users only).

### historical_low
Alert when a product reaches its historical lowest price.

## Configuration

### Rate Limiting
- Public endpoints: 30-100 requests per 15 minutes
- Authenticated endpoints: 60 requests per 15 minutes
- Batch endpoints: 20 requests per 15 minutes

### User Preferences
Users can configure:
- Minimum savings percentage for alerts
- Minimum savings amount
- Alert cooldown periods
- Preferred notification channels

### Pro User Benefits
- Lower alert thresholds (30% reduction)
- Best deal alerts
- Enhanced deal scoring
- Priority processing
- Higher rate limits

## Database Schema

The system uses existing tables:
- `product_availability`: Current pricing and availability data
- `price_history`: Historical pricing records
- `watches`: User product subscriptions
- `alerts`: Generated price drop alerts

## Performance Considerations

- Batch processing for multiple product comparisons
- Intelligent caching of price comparison results
- Rate limiting to prevent API abuse
- Efficient database queries with proper indexing
- Circuit breaker pattern for external service failures

## Testing

The system includes comprehensive tests:
- Unit tests for service methods
- Controller tests for API endpoints
- Integration tests for complete workflows
- Performance tests for batch operations

## Future Enhancements

1. **Machine Learning Integration**
   - Predictive price forecasting
   - Personalized deal recommendations
   - Seasonal trend analysis

2. **Advanced Analytics**
   - Price volatility indicators
   - Market trend analysis
   - Competitor pricing insights

3. **Enhanced Notifications**
   - Smart notification timing
   - Personalized alert frequency
   - Multi-channel delivery optimization