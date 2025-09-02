# Dashboard API Consolidation

## Overview

The dashboard API consolidation feature reduces the number of initial API requests required to load the dashboard page from 3 separate calls to a single consolidated call, improving performance and reducing network overhead.

## Implementation

### New Endpoint

**GET `/api/dashboard/consolidated`**

This endpoint aggregates data from three existing endpoints:
- `/api/dashboard` - Basic dashboard statistics and recent alerts
- `/api/dashboard/portfolio` - Portfolio tracking data and performance metrics
- `/api/dashboard/insights` - Predictive insights and ML-powered analytics

### Response Format

```json
{
  "success": true,
  "data": {
    "dashboard": {
      "stats": {
        "totalWatches": 15,
        "unreadAlerts": 3,
        "totalAlerts": 45,
        "successfulPurchases": 12,
        "clickThroughRate": 78.5,
        "recentAlerts": 8
      },
      "recentAlerts": [...],
      "watchedProducts": [...],
      "insights": {
        "topPerformingProducts": [...],
        "alertTrends": {...},
        "engagementMetrics": {...}
      }
    },
    "portfolio": {
      "totalValue": 2450.00,
      "totalItems": 15,
      "valueChange": {
        "amount": 125.50,
        "percentage": 5.4,
        "period": "30d"
      },
      "topHoldings": [...],
      "gapAnalysis": {...},
      "performance": {...}
    },
    "insights": [
      {
        "productId": "prod-123",
        "productName": "Pokémon TCG: Paldea Evolved Booster Box",
        "priceForcast": {
          "nextWeek": 145.99,
          "nextMonth": 155.99,
          "confidence": 0.85
        },
        "selloutRisk": {
          "score": 78,
          "timeframe": "2-3 days",
          "confidence": 0.92
        },
        "roiEstimate": {
          "shortTerm": 15.5,
          "longTerm": 28.3,
          "confidence": 0.76
        },
        "hypeScore": 89,
        "purchaseSignals": {
          "averagePaidPrice": 139.99,
          "avgDeltaToMsrpPct": 0.07,
          "averageLeadTimeHours": 18.5,
          "sampleSize": 12
        },
        "updatedAt": "2025-08-28T18:30:00Z"
      }
    ],
    "timestamp": "2025-08-28T18:30:00Z"
  }
}
```

### Query Parameters

- `productIds` (optional): Comma-separated list of product IDs to get specific insights for
  - Example: `/api/dashboard/consolidated?productIds=prod1,prod2,prod3`

### Performance Benefits

1. **Reduced Network Requests**: 3 requests → 1 request
2. **Parallel Data Fetching**: All data is fetched in parallel on the backend
3. **Reduced Latency**: Single round-trip instead of multiple sequential calls
4. **Better Error Handling**: Consolidated error handling for all dashboard data

### Frontend Implementation

The frontend `DashboardPage` component has been updated to:

1. **Primary**: Use the new consolidated endpoint
2. **Fallback**: Automatically fall back to individual API calls if the consolidated endpoint fails
3. **Backward Compatibility**: Maintains compatibility with existing API structure

```typescript
// Primary approach - consolidated endpoint
const consolidatedResponse = await apiClient.get('/api/dashboard/consolidated');
const { dashboard, portfolio, insights } = consolidatedResponse.data;

// Fallback approach - individual calls
const [dashboardResponse, portfolioResponse, insightsResponse] = await Promise.all([
  apiClient.get('/api/dashboard'),
  apiClient.get('/api/dashboard/portfolio'),
  apiClient.get('/api/dashboard/insights')
]);
```

### Backend Implementation

The consolidated endpoint is implemented in the `DashboardController`:

```typescript
export const getConsolidatedDashboardData = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const userId = req.user.id;
  const { productIds } = req.query;
  const targetProductIds = parseProductIds(productIds);

  // Fetch all dashboard data in parallel for optimal performance
  const [dashboardData, portfolioData, insightsData] = await Promise.all([
    DashboardService.getDashboardData(userId),
    DashboardService.getPortfolioData(userId),
    DashboardService.getPredictiveInsights(userId, targetProductIds)
  ]);

  const consolidatedData = {
    dashboard: dashboardData,
    portfolio: portfolioData,
    insights: insightsData,
    timestamp: new Date().toISOString()
  };

  sendSuccessResponse(res, consolidatedData);
};
```

### Testing

The consolidated endpoint can be tested using:

```bash
# Test endpoint availability (should return 401 without auth)
curl -v http://localhost:3000/api/dashboard/consolidated

# Test with authentication
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/dashboard/consolidated

# Test with product IDs filter
curl -H "Authorization: Bearer <token>" "http://localhost:3000/api/dashboard/consolidated?productIds=prod1,prod2"
```

### Migration Notes

- **Backward Compatibility**: All existing endpoints remain functional
- **Gradual Migration**: Frontend includes fallback to individual calls
- **No Breaking Changes**: Existing API consumers are unaffected
- **Performance Monitoring**: Response times and error rates should be monitored

### Future Enhancements

1. **Caching**: Add Redis caching for frequently accessed dashboard data
2. **Streaming**: Consider Server-Sent Events for real-time dashboard updates
3. **Compression**: Implement response compression for large datasets
4. **Pagination**: Add pagination support for large insight datasets

### Purchase Signals & Privacy

- **Signals**: Insights now include `purchaseSignals` derived from user-reported purchases: `averagePaidPrice`, `avgDeltaToMsrpPct`, `averageLeadTimeHours`, and `sampleSize`.
- **Privacy**: We only store price and non-identifying metadata (product, retailer, quantity, salted hash of user ID). No personal information is collected or stored.
