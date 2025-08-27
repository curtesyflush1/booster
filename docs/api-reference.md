# API Reference

This document provides a comprehensive reference for the BoosterBeacon API.

## Base URL

```
Production: https://api.boosterbeacon.com
Development: http://localhost:3000
```

## Authentication

All authenticated endpoints require a JWT token in the Authorization header:

```http
Authorization: Bearer <jwt_token>
```

## Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully",
  "timestamp": "2024-08-26T14:30:22Z"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error description",
  "message": "User-friendly error message",
  "timestamp": "2024-08-26T14:30:22Z"
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  },
  "message": "Data retrieved successfully",
  "timestamp": "2024-08-26T14:30:22Z"
}
```

## Core Endpoints

### Health Check
```http
GET /health
```
Returns system health status and uptime information.

**Response:**
```json
{
  "status": "healthy",
  "uptime": 3600,
  "environment": "production",
  "version": "1.0.0",
  "database": "connected",
  "redis": "connected"
}
```

### API Status
```http
GET /api/v1/status
```
Returns API version and status information.

## Watch Management

### Get User Watches
```http
GET /api/v1/watches
```

**Query Parameters:**
- `page` (integer, optional): Page number (default: 1)
- `limit` (integer, optional): Items per page (default: 20, max: 100)
- `is_active` (boolean, optional): Filter by active status
- `product_id` (UUID, optional): Filter by product ID
- `retailer_id` (UUID, optional): Filter by retailer ID

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "product_id": "uuid",
      "retailer_ids": ["uuid1", "uuid2"],
      "max_price": 29.99,
      "availability_type": "both",
      "zip_code": "12345",
      "radius_miles": 25,
      "alert_preferences": {
        "email": true,
        "push": true
      },
      "is_active": true,
      "alert_count": 5,
      "last_alerted": "2024-08-25T09:15:00Z",
      "created_at": "2024-08-20T10:00:00Z",
      "updated_at": "2024-08-25T09:15:00Z"
    }
  ],
  "pagination": { ... }
}
```

### Get Watch Details
```http
GET /api/v1/watches/:watchId
```

**Parameters:**
- `watchId` (UUID, required): Watch identifier

### Create Watch
```http
POST /api/v1/watches
```

**Request Body:**
```json
{
  "product_id": "uuid",
  "retailer_ids": ["uuid1", "uuid2"],
  "max_price": 29.99,
  "availability_type": "both",
  "zip_code": "12345",
  "radius_miles": 25,
  "alert_preferences": {
    "email": true,
    "push": true,
    "sms": false
  }
}
```

**Validation Rules:**
- `product_id`: Required, valid UUID
- `retailer_ids`: Optional array of UUIDs
- `max_price`: Optional, positive number ≤ 999999.99
- `availability_type`: Optional, one of: "online", "in_store", "both"
- `zip_code`: Optional, US format (12345 or 12345-6789)
- `radius_miles`: Optional, integer 1-500
- `alert_preferences`: Optional object

### Update Watch
```http
PUT /api/v1/watches/:watchId
```

**Request Body:** Same as create, all fields optional

### Delete Watch
```http
DELETE /api/v1/watches/:watchId
```

### Toggle Watch Status
```http
PATCH /api/v1/watches/:watchId/toggle
```
Toggles the `is_active` status of the watch.

### Get Watch Statistics
```http
GET /api/v1/watches/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 15,
    "active": 12,
    "totalAlerts": 47,
    "recentAlerts": 8,
    "topProducts": [
      {
        "product_id": "uuid",
        "alert_count": 12
      }
    ]
  }
}
```

### Export Watches
```http
GET /api/v1/watches/export
```

**Query Parameters:**
- `is_active` (boolean, optional): Filter by active status

**Response:** CSV file download

### Import Watches
```http
POST /api/v1/watches/import
```

**Request:** Multipart form data with CSV file
- `csv` (file, required): CSV file with watch data

**CSV Format:**
```csv
product_id,retailer_ids,max_price,availability_type,zip_code,radius_miles,is_active
uuid1,"uuid2,uuid3",29.99,both,12345,25,true
```

## Watch Packs

### Get Watch Packs
```http
GET /api/v1/watches/packs
```

**Query Parameters:**
- `page` (integer, optional): Page number
- `limit` (integer, optional): Items per page
- `search` (string, optional): Search term

### Get Popular Watch Packs
```http
GET /api/v1/watches/packs/popular
```

**Query Parameters:**
- `limit` (integer, optional): Number of packs (default: 10, max: 50)

### Get Watch Pack Details
```http
GET /api/v1/watches/packs/:packId
```

**Parameters:**
- `packId` (UUID or slug, required): Watch pack identifier

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Latest Pokémon Sets",
    "slug": "latest-pokemon-sets",
    "description": "Monitor the newest Pokémon TCG releases",
    "product_ids": ["uuid1", "uuid2", "uuid3"],
    "auto_update": true,
    "update_criteria": "category:latest",
    "subscriber_count": 1250,
    "is_active": true,
    "created_at": "2024-08-01T00:00:00Z",
    "updated_at": "2024-08-25T12:00:00Z"
  }
}
```

### Subscribe to Watch Pack
```http
POST /api/v1/watches/packs/:packId/subscribe
```

**Request Body:**
```json
{
  "customizations": {
    "alert_preferences": {
      "email": true,
      "push": true,
      "sms": false
    }
  }
}
```

### Unsubscribe from Watch Pack
```http
DELETE /api/v1/watches/packs/:packId/subscribe
```

**Request Body:**
```json
{
  "remove_watches": false
}
```

### Get User Subscriptions
```http
GET /api/v1/watches/packs/subscriptions
```

**Query Parameters:**
- `page` (integer, optional): Page number
- `limit` (integer, optional): Items per page
- `is_active` (boolean, optional): Filter by active status

### Get Detailed Subscriptions
```http
GET /api/v1/watches/packs/subscriptions/detailed
```
Returns subscriptions with full watch pack details.

### Update Subscription Customizations
```http
PUT /api/v1/watches/packs/:packId/customizations
```

**Request Body:**
```json
{
  "customizations": {
    "alert_preferences": {
      "email": false,
      "push": true,
      "sms": true
    }
  }
}
```

### Get Subscription Statistics
```http
GET /api/v1/watches/packs/subscriptions/stats
```

### Get Watch Pack Statistics
```http
GET /api/v1/watches/packs/:packId/stats
```

### Find Packs Containing Product
```http
GET /api/v1/watches/products/:productId/packs
```

## Health & Monitoring

### Get Watch Health
```http
GET /api/v1/watches/:watchId/health
```

**Response:**
```json
{
  "success": true,
  "data": {
    "watchId": "uuid",
    "productId": "uuid",
    "userId": "uuid",
    "isHealthy": true,
    "lastChecked": "2024-08-26T14:30:22Z",
    "lastAlerted": "2024-08-25T09:15:00Z",
    "alertCount": 5,
    "issues": []
  }
}
```

### Get All User Watches Health
```http
GET /api/v1/watches/health/all
```

### Get Watch Performance Metrics
```http
GET /api/v1/watches/metrics/performance
```

**Response:**
```json
{
  "success": true,
  "data": {
    "avgAlertsPerWatch": 3.2,
    "avgTimeBetweenAlerts": 48,
    "mostActiveWatches": [
      {
        "watchId": "uuid",
        "productId": "uuid",
        "alertCount": 15
      }
    ],
    "leastActiveWatches": [...]
  }
}
```

## Alert Management

### Get User Alerts
```http
GET /api/v1/alerts
```

**Query Parameters:**
- `page` (integer, optional): Page number (default: 1)
- `limit` (integer, optional): Items per page (default: 20, max: 100)
- `status` (string, optional): Filter by status ('pending', 'sent', 'failed', 'read')
- `type` (string, optional): Filter by type ('restock', 'price_drop', 'low_stock', 'pre_order')
- `unread_only` (boolean, optional): Show only unread alerts

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "product_id": "uuid",
      "retailer_id": "uuid",
      "watch_id": "uuid",
      "type": "restock",
      "priority": "high",
      "status": "sent",
      "data": {
        "product_name": "Pokémon Booster Box - Paldea Evolved",
        "retailer_name": "Best Buy",
        "availability_status": "in_stock",
        "product_url": "https://bestbuy.com/product",
        "cart_url": "https://bestbuy.com/cart/add",
        "price": 89.99,
        "original_price": 99.99,
        "stock_level": 15
      },
      "delivery_channels": ["web_push", "email"],
      "scheduled_for": null,
      "sent_at": "2024-08-26T14:30:22Z",
      "read_at": null,
      "clicked_at": null,
      "retry_count": 0,
      "failure_reason": null,
      "created_at": "2024-08-26T14:30:00Z",
      "updated_at": "2024-08-26T14:30:22Z"
    }
  ],
  "pagination": { ... }
}
```

### Get Alert Details
```http
GET /api/v1/alerts/:alertId
```

### Mark Alert as Read
```http
PATCH /api/v1/alerts/:alertId/read
```

### Mark Alert as Clicked
```http
PATCH /api/v1/alerts/:alertId/clicked
```

### Bulk Mark Alerts as Read
```http
PATCH /api/v1/alerts/bulk-read
```

**Request Body:**
```json
{
  "alertIds": ["uuid1", "uuid2", "uuid3"]
}
```

### Get Alert Statistics
```http
GET /api/v1/alerts/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 150,
    "unread": 12,
    "byType": {
      "restock": 85,
      "price_drop": 45,
      "low_stock": 15,
      "pre_order": 5
    },
    "byStatus": {
      "sent": 135,
      "pending": 8,
      "failed": 4,
      "read": 120
    },
    "clickThroughRate": 65.5,
    "recentAlerts": 25
  }
}
```

### Get Alerts for Product
```http
GET /api/v1/alerts/product/:productId
```

**Query Parameters:**
- `days` (integer, optional): Number of days to look back (default: 30)
- `limit` (integer, optional): Maximum results (default: 100)

## Notification Preferences

### Get Notification Settings
```http
GET /api/v1/users/notifications
```

**Response:**
```json
{
  "success": true,
  "data": {
    "web_push": true,
    "email": true,
    "sms": false,
    "discord": false,
    "discord_webhook": null,
    "quiet_hours": {
      "enabled": true,
      "start_time": "22:00",
      "end_time": "08:00",
      "timezone": "America/New_York",
      "days": ["monday", "tuesday", "wednesday", "thursday", "friday"]
    }
  }
}
```

### Update Notification Settings
```http
PUT /api/v1/users/notifications
```

**Request Body:**
```json
{
  "web_push": true,
  "email": true,
  "sms": true,
  "discord": true,
  "discord_webhook": "https://discord.com/api/webhooks/...",
  "quiet_hours": {
    "enabled": true,
    "start_time": "22:00",
    "end_time": "08:00",
    "timezone": "America/New_York",
    "days": ["monday", "tuesday", "wednesday", "thursday", "friday"]
  }
}
```

### Add Phone Number for SMS
```http
POST /api/v1/users/phone
```

**Request Body:**
```json
{
  "phoneNumber": "+1234567890"
}
```

### Verify Phone Number
```http
POST /api/v1/users/phone/verify
```

**Request Body:**
```json
{
  "verificationCode": "123456"
}
```

### Test Notification Channels
```http
POST /api/v1/users/notifications/test
```

**Request Body:**
```json
{
  "channels": ["email", "sms", "discord"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "email": { "success": true },
    "sms": { "success": true },
    "discord": { "success": false, "error": "Webhook not configured" }
  }
}
```

## Retailer Integration

### Check Product Availability
```http
POST /api/v1/retailers/check-availability
```

**Request Body:**
```json
{
  "productId": "uuid",
  "sku": "123456",
  "upc": "123456789012",
  "retailers": ["best-buy", "walmart"]
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "productId": "uuid",
      "retailerId": "best-buy",
      "inStock": true,
      "price": 29.99,
      "originalPrice": 34.99,
      "availabilityStatus": "in_stock",
      "productUrl": "https://bestbuy.com/product",
      "cartUrl": "https://bestbuy.com/cart/add?sku=123456",
      "storeLocations": [],
      "lastUpdated": "2024-08-26T14:30:22Z",
      "metadata": {
        "sku": "123456",
        "name": "Pokemon TCG Product",
        "image": "https://example.com/image.jpg"
      }
    }
  ]
}
```

### Search Products Across Retailers
```http
GET /api/v1/retailers/search
```

**Query Parameters:**
- `query` (string, required): Search term
- `retailers` (string, optional): Comma-separated retailer IDs
- `limit` (integer, optional): Max results per retailer (default: 10)

### Get Retailer Health Status
```http
GET /api/v1/retailers/health
```

**Response:**
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

### Get Retailer Metrics
```http
GET /api/v1/retailers/metrics
```

**Response:**
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

### Reset Circuit Breaker
```http
POST /api/v1/retailers/:retailerId/circuit-breaker/reset
```

### Get Circuit Breaker Metrics
```http
GET /api/v1/retailers/circuit-breaker/metrics
```

## Admin Endpoints

### Get System Watch Health
```http
GET /api/v1/watches/admin/health/system
```
**Requires:** Admin authentication

### Cleanup Watches
```http
POST /api/v1/watches/admin/cleanup
```
**Requires:** Admin authentication

### Create Watch Pack
```http
POST /api/v1/watches/packs
```
**Requires:** Admin authentication

**Request Body:**
```json
{
  "name": "Latest Pokémon Sets",
  "slug": "latest-pokemon-sets",
  "description": "Monitor the newest Pokémon TCG releases",
  "product_ids": ["uuid1", "uuid2", "uuid3"],
  "auto_update": true,
  "update_criteria": "category:latest AND release_date:>30days"
}
```

### Update Watch Pack
```http
PUT /api/v1/watches/packs/:packId
```
**Requires:** Admin authentication

### Delete Watch Pack
```http
DELETE /api/v1/watches/packs/:packId
```
**Requires:** Admin authentication

## Error Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Validation error |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Access denied |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Resource already exists |
| 422 | Unprocessable Entity - Invalid data |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

## Rate Limits

| Endpoint Type | Limit |
|---------------|-------|
| General API | 1000 requests/hour |
| Watch Management | 500 requests/hour |
| Bulk Operations | 10 requests/hour |
| Health Checks | 100 requests/hour |

## Data Types

### Watch Object
```typescript
{
  id: string;                    // UUID
  user_id: string;              // UUID
  product_id: string;           // UUID
  retailer_ids: string[];       // Array of UUIDs
  max_price?: number;           // Optional price threshold
  availability_type: string;    // "online" | "in_store" | "both"
  zip_code?: string;           // Optional US ZIP code
  radius_miles?: number;       // Optional radius 1-500
  alert_preferences: object;   // Notification preferences
  is_active: boolean;          // Watch status
  alert_count: number;         // Number of alerts sent
  last_alerted?: Date;         // Last alert timestamp
  created_at: Date;            // Creation timestamp
  updated_at: Date;            // Last update timestamp
}
```

### Watch Pack Object
```typescript
{
  id: string;                  // UUID
  name: string;               // Pack name (1-100 chars)
  slug: string;               // URL-friendly identifier
  description?: string;       // Optional description (≤1000 chars)
  product_ids: string[];      // Array of product UUIDs
  auto_update: boolean;       // Auto-update enabled
  update_criteria?: string;   // Update criteria string
  subscriber_count: number;   // Number of subscribers
  is_active: boolean;         // Pack status
  created_at: Date;           // Creation timestamp
  updated_at: Date;           // Last update timestamp
}
```

### Alert Object
```typescript
{
  id: string;                    // UUID
  user_id: string;              // UUID
  product_id: string;           // UUID
  retailer_id: string;          // UUID
  watch_id?: string;            // Optional watch UUID
  type: string;                 // "restock" | "price_drop" | "low_stock" | "pre_order"
  priority: string;             // "low" | "medium" | "high" | "urgent"
  status: string;               // "pending" | "sent" | "failed" | "read"
  data: {                       // Alert payload data
    product_name: string;
    retailer_name: string;
    availability_status: string;
    product_url: string;
    cart_url?: string;
    price?: number;
    original_price?: number;
    stock_level?: number;
    store_locations?: Array<{
      store_name: string;
      city: string;
      state: string;
    }>;
  };
  delivery_channels: string[];  // Channels used for delivery
  scheduled_for?: Date;         // Scheduled delivery time
  sent_at?: Date;              // Actual delivery time
  read_at?: Date;              // User read timestamp
  clicked_at?: Date;           // User click timestamp
  retry_count: number;         // Number of retry attempts
  failure_reason?: string;     // Failure description
  created_at: Date;            // Creation timestamp
  updated_at: Date;            // Last update timestamp
}
```

## SDK Examples

### JavaScript/TypeScript
```typescript
import { BoosterBeaconAPI } from '@boosterbeacon/sdk';

const api = new BoosterBeaconAPI({
  baseURL: 'https://api.boosterbeacon.com',
  token: 'your-jwt-token'
});

// Create a watch
const watch = await api.watches.create({
  product_id: 'uuid',
  retailer_ids: ['best-buy-uuid'],
  max_price: 29.99
});

// Subscribe to watch pack
await api.watchPacks.subscribe('latest-sets', {
  customizations: {
    alert_preferences: { email: true }
  }
});
```

### Python
```python
from boosterbeacon import BoosterBeaconAPI

api = BoosterBeaconAPI(
    base_url='https://api.boosterbeacon.com',
    token='your-jwt-token'
)

# Get user watches
watches = api.watches.list(page=1, limit=20)

# Create watch
watch = api.watches.create({
    'product_id': 'uuid',
    'retailer_ids': ['best-buy-uuid'],
    'max_price': 29.99
})
```

## Webhooks (Future)

The API will support webhooks for real-time notifications:

```http
POST /api/v1/webhooks
```

**Request Body:**
```json
{
  "url": "https://your-app.com/webhook",
  "events": ["watch.alert", "watch.created", "pack.subscribed"],
  "secret": "webhook-secret"
}
```

## Changelog

### v1.2.0 (2024-08-26)
- **Alert Processing & Delivery System** - Complete alert system implementation
- Multi-channel alert delivery (Web Push, Email, SMS, Discord)
- Intelligent alert processing with deduplication and rate limiting
- Quiet hours and user preference filtering
- Priority-based alert scheduling with automatic retry logic
- Comprehensive delivery tracking and analytics
- Template-based notifications with rich formatting
- Alert management API endpoints
- Notification preference management

### v1.1.0 (2024-08-26)
- **Retailer Integration System** - Complete multi-retailer monitoring
- Circuit breaker pattern for resilient API handling
- Polite scraping with rate limiting compliance
- Retailer health monitoring and performance metrics
- Support for Best Buy, Walmart, Costco, and Sam's Club
- Advanced error handling with retry logic

### v1.0.0 (2024-08-26)
- Initial API release
- Complete watch management system
- Watch packs functionality
- Health monitoring and metrics
- CSV import/export capabilities
- Comprehensive validation and error handling