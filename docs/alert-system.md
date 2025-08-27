# Alert Processing & Delivery System

The Alert Processing & Delivery System is the core notification engine of BoosterBeacon that generates, processes, and delivers real-time alerts to users when their watched products become available or experience price changes.

## Overview

The system provides intelligent, multi-channel alert delivery with advanced features like deduplication, rate limiting, quiet hours, and priority-based scheduling. It supports four notification channels: Web Push, Email, SMS, and Discord.

## Architecture

### Core Components

#### AlertProcessingService
The main orchestration service that handles:
- Alert generation and validation
- Deduplication to prevent spam
- Rate limiting per user
- Priority calculation based on product popularity and alert type
- Quiet hours scheduling
- Retry logic for failed deliveries

#### AlertDeliveryService
Multi-channel delivery orchestrator that:
- Manages concurrent delivery across channels
- Handles delivery timeouts and failures
- Tracks delivery status and analytics
- Provides unified delivery results

#### Notification Services
Individual channel implementations:
- **WebPushService** - PWA push notifications
- **EmailService** - HTML email templates with SES
- **SMSService** - Text messages via Twilio
- **DiscordService** - Rich embeds via webhooks

## Alert Types

### Restock Alerts
Triggered when a previously out-of-stock product becomes available.

**Priority Calculation:**
- High: Popular products (popularity score > 500)
- Medium: Standard products
- Urgent: Extremely popular products (popularity score > 800)

### Price Drop Alerts
Triggered when a product's price decreases below the user's threshold or shows significant savings.

**Priority Calculation:**
- High: Price drops > 20%
- Medium: Price drops 10-20%
- Low: Price drops < 10%

### Low Stock Alerts
Triggered when a product has limited availability remaining.

**Priority:** Always High (urgency due to limited time)

### Pre-Order Alerts
Triggered when pre-orders become available for upcoming products.

**Priority:** Medium (advance notice, less time-sensitive)

## Alert Processing Flow

### 1. Alert Generation
```typescript
const alertData = {
  userId: 'user-uuid',
  productId: 'product-uuid',
  retailerId: 'retailer-uuid',
  watchId: 'watch-uuid', // Optional
  type: 'restock',
  data: {
    product_name: 'Pokémon Booster Box',
    retailer_name: 'Best Buy',
    availability_status: 'in_stock',
    product_url: 'https://bestbuy.com/product',
    cart_url: 'https://bestbuy.com/cart/add',
    price: 89.99,
    stock_level: 15
  }
};

const result = await AlertProcessingService.generateAlert(alertData);
```

### 2. Validation & Deduplication
- Validates user, product, and watch existence
- Checks for duplicate alerts within 15-minute window
- Ensures product is active and user account is valid

### 3. Rate Limiting
- Maximum 50 alerts per user per hour
- Prevents spam and ensures quality user experience
- Configurable limits based on subscription tier

### 4. Priority Calculation
```typescript
// Factors considered:
// - Alert type (restock, price_drop, etc.)
// - Product popularity score
// - Price drop percentage
// - Historical user engagement
```

### 5. Quiet Hours Check
- Respects user-defined quiet hours
- Schedules alerts for next active period
- Timezone-aware scheduling
- Configurable days of week

### 6. Multi-Channel Delivery
```typescript
const channels = ['web_push', 'email']; // Based on user preferences
const deliveryResult = await AlertDeliveryService.deliverAlert(alert, user, channels);
```

## Notification Channels

### Web Push Notifications
- **Availability:** All users
- **Features:** Rich notifications with action buttons, offline support
- **Delivery Time:** < 1 second
- **Click Actions:** Direct to product page or cart

```typescript
// Example payload
{
  title: "🔥 Pokémon Booster Box Back in Stock!",
  body: "Available at Best Buy for $89.99",
  icon: "/icons/logo-192.png",
  badge: "/icons/badge-72.png",
  actions: [
    { action: "view", title: "View Product" },
    { action: "cart", title: "Add to Cart" }
  ],
  data: {
    productUrl: "https://bestbuy.com/product",
    cartUrl: "https://bestbuy.com/cart/add"
  }
}
```

### Email Notifications
- **Availability:** All users
- **Features:** Rich HTML templates, responsive design, unsubscribe links
- **Delivery Time:** < 5 seconds
- **Templates:** Customized per alert type with product images and pricing

```html
<!-- Example email structure -->
<div class="alert-card">
  <h1>🔥 Product Back in Stock!</h1>
  <div class="product-info">
    <h2>Pokémon Booster Box - Paldea Evolved</h2>
    <p>Available at Best Buy</p>
    <div class="price">$89.99 <span class="original">$99.99</span></div>
  </div>
  <a href="cart-url" class="cta-button">Add to Cart</a>
</div>
```

### SMS Notifications (Pro Only)
- **Availability:** Pro subscribers only
- **Features:** Concise text with direct links, delivery receipts
- **Delivery Time:** < 10 seconds
- **Character Limit:** 160 characters with smart truncation

```
🔥 Pokémon Booster Box back in stock at Best Buy - $89.99! https://bestbuy.com/cart/add
```

### Discord Notifications (Pro Only)
- **Availability:** Pro subscribers only
- **Features:** Rich embeds with images, multiple fields, webhook delivery
- **Delivery Time:** < 3 seconds
- **Customization:** Server-specific webhooks, bulk alerts

```typescript
// Example Discord embed
{
  title: "🔥 Product Back in Stock!",
  description: "Pokémon Booster Box - Paldea Evolved is now available at Best Buy",
  color: 0x4CAF50,
  fields: [
    { name: "🏪 Retailer", value: "Best Buy", inline: true },
    { name: "💵 Price", value: "$89.99", inline: true },
    { name: "⚡ Priority", value: "🔴 HIGH", inline: true }
  ],
  thumbnail: { url: "product-image-url" },
  timestamp: new Date().toISOString()
}
```

## User Preferences

### Notification Settings
```typescript
interface NotificationSettings {
  web_push: boolean;           // Always available
  email: boolean;              // Always available
  sms: boolean;                // Pro only
  discord: boolean;            // Pro only
  discord_webhook?: string;    // Discord webhook URL
}
```

### Quiet Hours Configuration
```typescript
interface QuietHours {
  enabled: boolean;
  start_time: string;          // "22:00"
  end_time: string;            // "08:00"
  timezone: string;            // "America/New_York"
  days: string[];              // ["monday", "tuesday", ...]
}
```

### Alert Preferences (Per Watch)
```typescript
interface AlertPreferences {
  notify_restock: boolean;     // Product back in stock
  notify_price_drop: boolean;  // Price decreases
  notify_low_stock: boolean;   // Limited availability
  notify_pre_order: boolean;   // Pre-orders available
}
```

## Delivery Tracking & Analytics

### Delivery Status Tracking
- **Sent:** Successfully delivered to channel
- **Failed:** Delivery failed (with reason)
- **Read:** User opened/viewed alert
- **Clicked:** User clicked through to product

### User Analytics
```typescript
interface UserAlertStats {
  total: number;               // Total alerts received
  unread: number;              // Unread alerts
  byType: Record<string, number>;     // Alerts by type
  byStatus: Record<string, number>;   // Alerts by status
  clickThroughRate: number;    // Percentage of alerts clicked
  recentAlerts: number;        // Alerts in last 7 days
}
```

### System Analytics
```typescript
interface SystemAlertStats {
  totalAlerts: number;         // System-wide alert count
  pendingAlerts: number;       // Alerts awaiting delivery
  failedAlerts: number;        // Failed deliveries
  avgDeliveryTime: number;     // Average delivery time (seconds)
  alertsByType: Record<string, number>;
  alertsByPriority: Record<string, number>;
}
```

## Error Handling & Resilience

### Retry Logic
- **Max Retries:** 3 attempts per alert
- **Backoff Strategy:** Exponential with jitter
- **Retry Conditions:** Transient failures only
- **Permanent Failures:** Invalid user data, disabled accounts

### Circuit Breaker Pattern
Applied to external services (Twilio, Discord, SES):
- **Failure Threshold:** 5 consecutive failures
- **Recovery Timeout:** 1 minute
- **Monitoring:** Real-time health status

### Graceful Degradation
- **Channel Failures:** Continue with available channels
- **Service Outages:** Queue alerts for retry
- **Rate Limits:** Respect external service limits
- **Fallbacks:** Web push as last resort

## Performance Optimization

### Concurrent Processing
- **Batch Processing:** Process multiple alerts simultaneously
- **Channel Parallelization:** Deliver to all channels concurrently
- **Connection Pooling:** Reuse HTTP connections
- **Timeout Management:** Prevent hanging requests

### Caching Strategy
- **User Preferences:** Cache for 5 minutes
- **Product Data:** Cache for 1 minute
- **Template Rendering:** Cache compiled templates
- **Delivery Status:** Real-time updates

### Database Optimization
- **Indexes:** Optimized queries for alert retrieval
- **Partitioning:** Separate old alerts for performance
- **Cleanup:** Automatic removal of old alerts (90+ days)
- **Aggregation:** Pre-calculated statistics

## Security & Privacy

### Data Protection
- **Minimal Data:** Only collect necessary information
- **Encryption:** Sensitive data encrypted at rest
- **Retention:** Automatic cleanup of old alerts
- **Anonymization:** Remove PII from logs

### Authentication & Authorization
- **JWT Tokens:** Secure API access
- **User Validation:** Verify alert ownership
- **Rate Limiting:** Prevent abuse
- **Input Sanitization:** Prevent injection attacks

### External Service Security
- **API Keys:** Secure credential storage
- **Webhook Validation:** Verify Discord webhooks
- **TLS:** Encrypted communication
- **Audit Logging:** Track all delivery attempts

## Configuration

### Environment Variables
```bash
# Email Service (Amazon SES)
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=us-east-1
SES_CONFIGURATION_SET=boosterbeacon-emails
FROM_EMAIL=alerts@boosterbeacon.com
FROM_NAME=BoosterBeacon

# SMS Service (Twilio)
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=+1234567890

# Discord Integration
DISCORD_BOT_TOKEN=your_discord_token

# Alert Processing
ALERT_DEDUPLICATION_WINDOW_MINUTES=15
ALERT_MAX_PER_USER_PER_HOUR=50
ALERT_MAX_RETRY_ATTEMPTS=3
ALERT_DELIVERY_TIMEOUT_MS=30000
```

### Service Configuration
```typescript
interface AlertConfig {
  deduplicationWindowMinutes: number;    // 15
  maxAlertsPerUserPerHour: number;      // 50
  maxRetryAttempts: number;             // 3
  deliveryTimeoutMs: number;            // 30000
  popularityThresholdHigh: number;      // 500
  popularityThresholdUrgent: number;    // 800
  priceDropThresholdHigh: number;       // 20 (percent)
}
```

## Testing

### Unit Tests
- **Alert Generation:** Test validation and priority calculation
- **Deduplication:** Verify duplicate detection logic
- **Rate Limiting:** Test user limits and enforcement
- **Channel Services:** Mock external service calls
- **Template Rendering:** Validate output formatting

### Integration Tests
- **End-to-End Flow:** Complete alert processing pipeline
- **Multi-Channel Delivery:** Test concurrent delivery
- **Error Scenarios:** Failure handling and recovery
- **Performance:** Load testing with realistic traffic
- **Compliance:** Verify rate limiting and politeness

### Mock Services
```typescript
// Example test setup
jest.mock('./notifications/emailService');
jest.mock('./notifications/smsService');
jest.mock('./notifications/discordService');

const mockEmailService = EmailService as jest.Mocked<typeof EmailService>;
mockEmailService.sendAlert.mockResolvedValue({
  channel: 'email',
  success: true,
  externalId: 'ses-message-id'
});
```

## Monitoring & Alerting

### Key Metrics
- **Delivery Rate:** Percentage of successful deliveries
- **Response Time:** Average delivery time per channel
- **Error Rate:** Failed deliveries by channel and reason
- **User Engagement:** Click-through rates and read rates
- **System Load:** Alert volume and processing capacity

### Health Checks
- **Service Availability:** Monitor external service health
- **Queue Depth:** Track pending alert backlog
- **Error Rates:** Alert on high failure rates
- **Performance:** Monitor delivery times
- **Capacity:** Track system resource usage

### Alerting Rules
- **High Error Rate:** > 5% delivery failures in 5 minutes
- **Slow Delivery:** > 30 second average delivery time
- **Queue Backup:** > 1000 pending alerts
- **Service Down:** External service unavailable
- **Rate Limit Hit:** Approaching external service limits

## Alert Management UI

### Alert Inbox
The alert inbox provides a comprehensive interface for managing all user alerts:

#### Features
- **Read/Unread Status:** Visual indicators and filtering for unread alerts
- **Bulk Operations:** Select multiple alerts for batch actions (mark as read, delete)
- **Advanced Filtering:** Filter by status, type, date range, and search terms
- **Pagination:** Efficient loading of large alert histories
- **Mobile Responsive:** Touch-friendly interface optimized for mobile devices

#### Alert Display
```typescript
interface AlertDisplay {
  id: string;
  type: AlertType;
  priority: AlertPriority;
  productName: string;
  retailerName: string;
  price: number;
  isRead: boolean;
  createdAt: string;
  timeAgo: string;
  actions: AlertAction[];
}
```

#### Filtering Options
- **Status Filter:** All, Pending, Sent, Failed, Read
- **Type Filter:** Restock, Price Drop, Low Stock, Pre-order
- **Date Range:** Custom start and end dates
- **Search:** Product name or retailer name
- **Read Status:** All alerts or unread only

### Alert Analytics Dashboard

#### Engagement Metrics
- **Total Alerts:** Lifetime alert count
- **Click-Through Rate:** Percentage of alerts clicked
- **Read Rate:** Percentage of alerts read
- **Daily Breakdown:** Activity charts with trend analysis

#### Analytics Components
```typescript
interface AlertAnalytics {
  period: {
    days: number;
    startDate: string;
    endDate: string;
  };
  summary: {
    totalAlerts: number;
    sentAlerts: number;
    clickedAlerts: number;
    readAlerts: number;
    clickThroughRate: number;
    readRate: number;
  };
  dailyBreakdown: DailyMetrics[];
}
```

#### Visual Components
- **Summary Cards:** Key metrics with trend indicators
- **Daily Activity Chart:** Bar chart showing alert volume over time
- **Engagement Insights:** Performance analysis and recommendations
- **Period Selection:** 7 days, 30 days, 90 days, 1 year

### API Endpoints

#### Alert Management
```typescript
// Get user alerts with filtering
GET /api/alerts?page=1&limit=20&status=sent&type=restock&unread_only=true

// Get specific alert
GET /api/alerts/:id

// Mark alert as read
PATCH /api/alerts/:id/read

// Mark alert as clicked
PATCH /api/alerts/:id/clicked

// Bulk mark as read
PATCH /api/alerts/bulk/read
Body: { alertIds: string[] }

// Delete alert
DELETE /api/alerts/:id

// Get alert statistics
GET /api/alerts/stats/summary

// Get engagement analytics
GET /api/alerts/analytics/engagement?days=30
```

#### Response Formats
```typescript
// Alert list response
interface AlertListResponse {
  alerts: Alert[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Alert statistics response
interface AlertStatsResponse {
  stats: {
    total: number;
    unread: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    clickThroughRate: number;
    recentAlerts: number;
  };
}
```

## Future Enhancements

### Planned Features
- **Smart Scheduling:** ML-based optimal delivery timing
- **Personalization:** User behavior-based customization
- **Rich Media:** Product images in notifications
- **Interactive Alerts:** In-notification actions
- **Advanced Analytics:** Conversion tracking and ROI analysis

### Channel Expansions
- **Slack Integration:** Workspace notifications
- **Microsoft Teams:** Enterprise notifications
- **Telegram:** Alternative messaging platform
- **Mobile Apps:** Native push notifications
- **Voice Alerts:** Alexa/Google Assistant integration

### Advanced Features
- **Predictive Alerts:** Anticipate restocks
- **Social Sharing:** Share alerts with community
- **Alert Scheduling:** User-defined delivery times
- **Template Customization:** User-defined templates
- **Analytics Dashboard:** Detailed engagement metrics

## Troubleshooting

### Common Issues

#### High Delivery Failures
1. Check external service status (SES, Twilio, Discord)
2. Verify API credentials and quotas
3. Review error logs for specific failure reasons
4. Check network connectivity and DNS resolution

#### Slow Alert Processing
1. Monitor database performance and query times
2. Check alert queue depth and processing capacity
3. Review concurrent processing limits
4. Optimize database indexes and queries

#### Missing Alerts
1. Verify watch configuration and active status
2. Check quiet hours settings and timezone
3. Review rate limiting and deduplication logic
4. Confirm user notification preferences

#### Template Rendering Issues
1. Validate template syntax and data binding
2. Check for missing product or user data
3. Review character limits for SMS templates
4. Test template rendering with sample data

### Debugging Commands
```bash
# Check alert processing status
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.boosterbeacon.com/api/v1/alerts/stats"

# Test notification channels
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"channels": ["email", "sms"]}' \
  "https://api.boosterbeacon.com/api/v1/users/notifications/test"

# View recent alerts
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.boosterbeacon.com/api/v1/alerts?limit=10&status=failed"
```

## Best Practices

### For Developers
- **Error Handling:** Always handle external service failures gracefully
- **Logging:** Include correlation IDs for tracking across services
- **Testing:** Mock external services in tests
- **Performance:** Use connection pooling and caching
- **Security:** Never log sensitive user data or API keys

### For Users
- **Notification Preferences:** Configure channels based on urgency needs
- **Quiet Hours:** Set appropriate quiet periods for better experience
- **Watch Management:** Keep watches updated and remove unused ones
- **Engagement:** Click through alerts to improve relevance algorithms

### For Administrators
- **Monitoring:** Set up comprehensive alerting for system health
- **Capacity Planning:** Monitor alert volume trends
- **Cost Management:** Track external service usage and costs
- **User Support:** Provide clear documentation and troubleshooting guides

This alert system provides a robust, scalable foundation for real-time notifications while maintaining high performance, reliability, and user experience standards.