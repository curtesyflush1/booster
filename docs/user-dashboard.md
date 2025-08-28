# User Dashboard System

The User Dashboard provides a comprehensive overview of a user's BoosterBeacon activity, including watch statistics, recent alerts, predictive insights, and portfolio tracking. This system is designed to give collectors actionable intelligence about their monitored products and market opportunities.

## ✅ Completed Features

### Dashboard Overview
- **Real-time Statistics**: Live metrics for watches, alerts, and engagement
- **Recent Alerts**: Latest product availability notifications
- **Watched Products**: Overview of monitored products with insights
- **Performance Metrics**: Click-through rates and response times

### Predictive Insights
- **Price Forecasting**: ML-powered price predictions for next week and month
- **Sell-out Risk Assessment**: Risk scoring with confidence intervals
- **ROI Estimation**: Short-term and long-term return on investment analysis
- **Hype Meter**: Community engagement and viral potential scoring

### Portfolio Tracking
- **Collection Value**: Total portfolio value and change tracking
- **Gap Analysis**: Missing sets and completion percentages
- **Performance Analytics**: Alert success rates and purchase tracking
- **Recommended Purchases**: AI-driven purchase recommendations

### Real-time Updates
- **Live Data**: Real-time updates since specific timestamps
- **New Alerts**: Fresh notifications and availability changes
- **Watch Updates**: Recent modifications to user's watches

## API Endpoints

### Get Dashboard Data
```http
GET /api/dashboard
```

**Authentication:** Required  
**Rate Limit:** 30 requests per minute

Returns comprehensive dashboard data including statistics, recent alerts, watched products, and insights.

**Response Structure:**
```json
{
  "success": true,
  "dashboard": {
    "stats": {
      "totalWatches": 15,
      "unreadAlerts": 3,
      "totalAlerts": 47,
      "successfulPurchases": 12,
      "clickThroughRate": 65.5,
      "recentAlerts": 8
    },
    "recentAlerts": [...],
    "watchedProducts": [...],
    "insights": {
      "topPerformingProducts": [...],
      "alertTrends": {...},
      "engagementMetrics": {...}
    }
  }
}
```

### Get Predictive Insights
```http
GET /api/dashboard/insights?productIds=uuid1,uuid2
```

**Query Parameters:**
- `productIds` (optional): Comma-separated product IDs (max 50)

Returns ML-powered predictions for specified products or user's watched products.

**Response Structure:**
```json
{
  "success": true,
  "insights": [
    {
      "productId": "uuid",
      "productName": "Pokémon Booster Box",
      "priceForcast": {
        "nextWeek": 92.50,
        "nextMonth": 98.75,
        "confidence": 0.78
      },
      "selloutRisk": {
        "score": 85,
        "timeframe": "2-3 days",
        "confidence": 0.82
      },
      "roiEstimate": {
        "shortTerm": 0.15,
        "longTerm": 0.45,
        "confidence": 0.65
      },
      "hypeScore": 78,
      "updatedAt": "2024-08-26T14:30:22Z"
    }
  ]
}
```

### Get Portfolio Data
```http
GET /api/dashboard/portfolio
```

Returns portfolio tracking data including collection analysis and performance metrics.

**Response Structure:**
```json
{
  "success": true,
  "portfolio": {
    "totalValue": 1250.00,
    "totalItems": 15,
    "valueChange": {
      "amount": 125.50,
      "percentage": 11.2,
      "period": "30d"
    },
    "topHoldings": [...],
    "gapAnalysis": {
      "missingSets": [...],
      "recommendedPurchases": [...]
    },
    "performance": {
      "alertsGenerated": 47,
      "successfulPurchases": 12,
      "missedOpportunities": 3,
      "averageResponseTime": "< 2 minutes"
    }
  }
}
```

### Get Real-time Updates
```http
GET /api/dashboard/updates?since=2024-08-26T14:00:00Z
```

**Query Parameters:**
- `since` (optional): ISO 8601 timestamp (max 30 days ago, cannot be future)

Returns new alerts and watch updates since the specified timestamp.

## Dashboard Components

### Statistics Overview
- **Total Watches**: Number of active product monitors
- **Unread Alerts**: New notifications requiring attention
- **Total Alerts**: Lifetime alert count for the user
- **Successful Purchases**: Tracked purchase completions
- **Click-through Rate**: Percentage of alerts acted upon
- **Recent Alerts**: Alerts from the last 24 hours

### Recent Alerts Section
- **Alert Type**: Restock, price drop, low stock, or pre-order
- **Product Information**: Name, image, and current price
- **Retailer Details**: Store name and availability status
- **Action Buttons**: Direct links to product or cart pages
- **Timestamp**: When the alert was generated

### Watched Products Grid
- **Product Cards**: Visual representation of monitored items
- **Watch Status**: Active/inactive indicator
- **Alert Count**: Number of alerts generated for each product
- **Insights Preview**: Quick view of hype score and risk assessment
- **Quick Actions**: Edit watch settings or view full insights

### Predictive Insights Panel
- **Price Forecasting**: Visual charts showing predicted price movements
- **Risk Assessment**: Color-coded sell-out risk indicators
- **ROI Analysis**: Investment potential with confidence intervals
- **Hype Meter**: Community engagement visualization
- **Confidence Scores**: ML model accuracy indicators

### Portfolio Analytics
- **Value Tracking**: Total collection value with change indicators
- **Performance Metrics**: Success rates and response times
- **Gap Analysis**: Missing items from popular sets
- **Recommendations**: AI-suggested purchases with priority levels
- **Top Holdings**: Most valuable or active monitored products

## Configuration

### Dashboard Settings
The dashboard behavior is controlled by configuration in `backend/src/config/dashboardConfig.ts`:

```typescript
export const DASHBOARD_CONFIG = {
  DEFAULT_RECENT_ALERTS_LIMIT: 10,
  DEFAULT_WATCHED_PRODUCTS_LIMIT: 20,
  DEFAULT_PREDICTIVE_INSIGHTS_LIMIT: 50,
  DEFAULT_TOP_PRODUCTS_LIMIT: 10,
  UPDATES_DEFAULT_TIMEFRAME_MINUTES: 60,
  INSIGHTS_ALERT_HISTORY_DAYS: 30,
  
  PRICE_FORECAST: {
    NEXT_WEEK_VARIANCE: { MIN: 0.95, MAX: 1.05 },
    NEXT_MONTH_VARIANCE: { MIN: 0.90, MAX: 1.20 },
    MIN_CONFIDENCE: 0.5,
    MAX_CONFIDENCE: 0.95
  },
  
  SELLOUT_RISK: {
    ALERT_MULTIPLIER: 5,
    HIGH_RISK_THRESHOLD: 10,
    TIMEFRAMES: {
      HIGH: "2-3 days",
      NORMAL: "1-2 weeks"
    }
  },
  
  ROI_ESTIMATE: {
    SHORT_TERM_RANGE: { MIN: -0.1, MAX: 0.3 },
    LONG_TERM_RANGE: { MIN: 0.0, MAX: 0.8 }
  }
};
```

### Rate Limiting
Dashboard endpoints are rate-limited to prevent abuse:
- **Limit**: 30 requests per minute per user
- **Window**: 1 minute sliding window
- **Response**: HTTP 429 with retry-after header

### Validation
Input validation is applied to all dashboard endpoints:
- **Product IDs**: Alphanumeric format validation, maximum 50 IDs
- **Date Parameters**: ISO 8601 format, reasonable date ranges
- **Authentication**: JWT token required for all endpoints

## Frontend Integration

### React Components
The dashboard is implemented using React components:

```typescript
// Dashboard main component
const UserDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [insights, setInsights] = useState<ProductInsights[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  
  // Load dashboard data on mount
  useEffect(() => {
    loadDashboardData();
  }, []);
  
  return (
    <div className="dashboard-container">
      <StatisticsOverview stats={dashboardData?.stats} />
      <RecentAlerts alerts={dashboardData?.recentAlerts} />
      <WatchedProducts products={dashboardData?.watchedProducts} />
      <PredictiveInsights insights={insights} />
      <PortfolioAnalytics portfolio={portfolio} />
    </div>
  );
};
```

### Real-time Updates
The dashboard supports real-time updates using WebSocket connections:

```typescript
// WebSocket integration for live updates
const useRealtimeUpdates = () => {
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3000/dashboard-updates');
    
    ws.onmessage = (event) => {
      const update = JSON.parse(event.data);
      // Update dashboard state with new data
      setLastUpdate(new Date());
    };
    
    return () => ws.close();
  }, []);
};
```

### State Management
Dashboard state is managed using React Context:

```typescript
interface DashboardContextType {
  dashboardData: DashboardData | null;
  insights: ProductInsights[];
  portfolio: PortfolioData | null;
  loading: boolean;
  error: string | null;
  refreshDashboard: () => Promise<void>;
}

export const DashboardContext = createContext<DashboardContextType | null>(null);
```

## Performance Considerations

### Caching Strategy
- **Dashboard Data**: Cached for 5 minutes to reduce database load
- **Predictive Insights**: Cached for 1 hour due to ML computation cost
- **Portfolio Data**: Cached for 15 minutes for balance of freshness and performance

### Database Optimization
- **Indexed Queries**: All dashboard queries use appropriate database indexes
- **Parallel Execution**: Multiple data sources fetched concurrently
- **Query Optimization**: Efficient joins and aggregations for statistics

### Response Time Targets
- **Dashboard Data**: < 500ms response time
- **Predictive Insights**: < 1000ms response time
- **Portfolio Data**: < 750ms response time
- **Real-time Updates**: < 100ms response time

## Security

### Authentication
- **JWT Tokens**: Required for all dashboard endpoints
- **Token Validation**: Automatic token refresh handling
- **Session Management**: Secure session handling with expiration

### Authorization
- **User Isolation**: Users can only access their own dashboard data
- **Data Filtering**: All queries filtered by authenticated user ID
- **Input Sanitization**: All user inputs validated and sanitized

### Privacy
- **Data Minimization**: Only necessary data included in responses
- **Sensitive Information**: No sensitive data exposed in dashboard APIs
- **Audit Logging**: All dashboard access logged for security monitoring

## Error Handling

### Common Error Responses
```json
{
  "success": false,
  "error": {
    "code": "INVALID_PRODUCT_IDS",
    "message": "Invalid product ID format: invalid-id",
    "timestamp": "2024-08-26T14:30:22Z"
  }
}
```

### Error Codes
- `INVALID_PRODUCT_IDS`: Product ID format validation failed
- `TOO_MANY_PRODUCT_IDS`: More than 50 product IDs provided
- `INVALID_DATE_FORMAT`: Date parameter format invalid
- `FUTURE_DATE_NOT_ALLOWED`: Date parameter in the future
- `DATE_TOO_OLD`: Date parameter more than 30 days ago
- `RATE_LIMIT_EXCEEDED`: Too many requests in time window

### Error Recovery
- **Graceful Degradation**: Dashboard shows partial data if some components fail
- **Retry Logic**: Automatic retry for transient failures
- **User Feedback**: Clear error messages with suggested actions

## Monitoring and Analytics

### Performance Metrics
- **Response Times**: Average and 95th percentile response times
- **Error Rates**: Error frequency by endpoint and error type
- **Usage Patterns**: Most accessed dashboard components
- **User Engagement**: Time spent on dashboard and interaction rates

### Business Metrics
- **Dashboard Adoption**: Percentage of users accessing dashboard
- **Feature Usage**: Most popular dashboard features
- **Conversion Rates**: Dashboard usage to purchase conversion
- **User Retention**: Dashboard usage correlation with user retention

## Future Enhancements

### Planned Features
- **Customizable Widgets**: User-configurable dashboard layout
- **Advanced Filtering**: More granular data filtering options
- **Export Functionality**: PDF and CSV export of dashboard data
- **Mobile Optimization**: Enhanced mobile dashboard experience
- **Collaborative Features**: Shared dashboards and watchlists

### Technical Improvements
- **GraphQL Integration**: More efficient data fetching
- **Progressive Web App**: Offline dashboard capabilities
- **Push Notifications**: Real-time dashboard notifications
- **Advanced Caching**: Redis-based caching for better performance
- **Machine Learning**: More sophisticated predictive models

---

The User Dashboard system provides collectors with comprehensive insights into their BoosterBeacon activity, combining real-time data with predictive analytics to help users make informed decisions about their Pokémon TCG collecting strategy.