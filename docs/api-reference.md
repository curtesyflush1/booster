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

## Product Search

### Search Products
```http
GET /api/v1/products/search
```

**Query Parameters:**
- `query` (string, optional): Search term for product name
- `category` (string, optional): Product category filter
- `retailer` (string, optional): Retailer filter
- `minPrice` (number, optional): Minimum price filter
- `maxPrice` (number, optional): Maximum price filter
- `inStockOnly` (boolean, optional): Show only in-stock products
- `sortBy` (string, optional): Sort field (`name`, `price`, `releaseDate`, `popularity`)
- `sortOrder` (string, optional): Sort direction (`asc`, `desc`)
- `page` (integer, optional): Page number (default: 1)
- `limit` (integer, optional): Results per page (default: 20, max: 100)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Pokémon TCG: Scarlet & Violet Booster Pack",
      "sku": "POK-SV-BP-001",
      "upc": "820650123456",
      "category": {
        "id": "uuid",
        "name": "Booster Packs",
        "slug": "booster-packs"
      },
      "set": "Scarlet & Violet",
      "series": "Scarlet & Violet Series",
      "releaseDate": "2023-03-31",
      "msrp": 4.99,
      "imageUrl": "https://example.com/product.jpg",
      "thumbnailUrl": "https://example.com/thumb.jpg",
      "description": "Contains 11 cards including 1 rare card",
      "metadata": {
        "cardCount": 11,
        "packType": "booster",
        "language": "en",
        "region": "US",
        "tags": ["new", "popular"]
      },
      "availability": [
        {
          "id": "uuid",
          "retailerId": "best-buy",
          "retailerName": "Best Buy",
          "inStock": true,
          "price": 4.49,
          "originalPrice": 4.99,
          "url": "https://bestbuy.com/product/123",
          "cartUrl": "https://bestbuy.com/cart/add/123",
          "lastChecked": "2024-08-26T14:30:22Z"
        }
      ],
      "createdAt": "2024-08-26T14:30:22Z",
      "updatedAt": "2024-08-26T14:30:22Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Get Product Details
```http
GET /api/v1/products/:productId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Pokémon TCG: Scarlet & Violet Booster Pack",
    "sku": "POK-SV-BP-001",
    "upc": "820650123456",
    "category": {
      "id": "uuid",
      "name": "Booster Packs",
      "slug": "booster-packs",
      "description": "Individual booster packs",
      "parentId": null
    },
    "set": "Scarlet & Violet",
    "series": "Scarlet & Violet Series",
    "releaseDate": "2023-03-31",
    "msrp": 4.99,
    "imageUrl": "https://example.com/product.jpg",
    "thumbnailUrl": "https://example.com/thumb.jpg",
    "description": "Contains 11 cards including 1 rare card",
    "metadata": {
      "cardCount": 11,
      "packType": "booster",
      "rarity": "common",
      "language": "en",
      "region": "US",
      "tags": ["new", "popular"]
    },
    "availability": [
      {
        "id": "uuid",
        "retailerId": "best-buy",
        "retailerName": "Best Buy",
        "inStock": true,
        "price": 4.49,
        "originalPrice": 4.99,
        "url": "https://bestbuy.com/product/123",
        "cartUrl": "https://bestbuy.com/cart/add/123",
        "lastChecked": "2024-08-26T14:30:22Z",
        "storeLocations": [
          {
            "id": "store-123",
            "name": "Best Buy - Downtown",
            "address": "123 Main St",
            "city": "Seattle",
            "state": "WA",
            "zipCode": "98101",
            "phone": "(555) 123-4567",
            "inStock": true,
            "quantity": 5
          }
        ]
      }
    ],
    "priceHistory": [
      {
        "date": "2024-08-26",
        "price": 4.49,
        "retailerId": "best-buy"
      }
    ],
    "createdAt": "2024-08-26T14:30:22Z",
    "updatedAt": "2024-08-26T14:30:22Z"
  }
}
```

### Get Product Categories
```http
GET /api/v1/products/categories
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Booster Packs",
      "slug": "booster-packs",
      "description": "Individual booster packs",
      "parentId": null,
      "imageUrl": "https://example.com/category.jpg"
    }
  ]
}
```

### Barcode Lookup
```http
GET /api/v1/products/barcode/:upc
```

**Parameters:**
- `upc` (string, required): UPC barcode

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Pokémon TCG: Scarlet & Violet Booster Pack",
    "upc": "820650123456",
    "availability": [
      {
        "retailerId": "best-buy",
        "retailerName": "Best Buy",
        "inStock": true,
        "price": 4.49,
        "url": "https://bestbuy.com/product/123"
      }
    ]
  }
}
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
GET /api/alerts
```

**Query Parameters:**
- `page` (integer, optional): Page number (default: 1)
- `limit` (integer, optional): Items per page (default: 20, max: 100)
- `status` (string, optional): Filter by status ('pending', 'sent', 'failed', 'read')
- `type` (string, optional): Filter by type ('restock', 'price_drop', 'low_stock', 'pre_order')
- `unread_only` (boolean, optional): Show only unread alerts
- `search` (string, optional): Search product or retailer name
- `start_date` (string, optional): Filter alerts from date (ISO 8601)
- `end_date` (string, optional): Filter alerts to date (ISO 8601)

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
GET /api/alerts/:alertId
```

### Mark Alert as Read
```http
PATCH /api/alerts/:alertId/read
```

### Mark Alert as Clicked
```http
PATCH /api/alerts/:alertId/clicked
```

### Bulk Mark Alerts as Read
```http
PATCH /api/alerts/bulk/read
```

**Request Body:**
```json
{
  "alertIds": ["uuid1", "uuid2", "uuid3"]
}
```

### Get Alert Statistics
```http
GET /api/alerts/stats/summary
```

### Get Alert Analytics
```http
GET /api/alerts/analytics/engagement
```

**Query Parameters:**
- `days` (integer, optional): Number of days for analytics (default: 30, max: 365)

**Response:**
```json
{
  "success": true,
  "data": {
    "analytics": {
      "period": {
        "days": 30,
        "startDate": "2024-07-27T14:30:22Z",
        "endDate": "2024-08-26T14:30:22Z"
      },
      "summary": {
        "totalAlerts": 150,
        "sentAlerts": 145,
        "clickedAlerts": 95,
        "readAlerts": 120,
        "clickThroughRate": 65.5,
        "readRate": 80.0
      },
      "dailyBreakdown": [
        {
          "date": "2024-08-26",
          "total": 8,
          "sent": 8,
          "clicked": 5,
          "read": 6
        }
      ]
    }
  }
}
```

### Delete Alert
```http
DELETE /api/alerts/:alertId
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

## Email Management

### Get Email Preferences
```http
GET /api/v1/email/preferences
```

**Response:**
```json
{
  "preferences": {
    "alertEmails": true,
    "marketingEmails": true,
    "weeklyDigest": false,
    "updatedAt": "2024-08-27T14:30:22Z"
  }
}
```

### Update Email Preferences
```http
PUT /api/v1/email/preferences
```

**Request Body:**
```json
{
  "alertEmails": true,
  "marketingEmails": false,
  "weeklyDigest": true
}
```

### Process Unsubscribe
```http
GET /api/v1/email/unsubscribe?token=<unsubscribe_token>
```

**Response:**
```json
{
  "message": "Successfully unsubscribed from alert emails",
  "emailType": "alerts"
}
```

### Get Email Statistics
```http
GET /api/v1/email/stats
```

**Response:**
```json
{
  "stats": {
    "totalSent": 150,
    "totalDelivered": 145,
    "totalBounced": 3,
    "totalComplained": 2,
    "deliveryRate": 96.67,
    "lastEmailSent": "2024-08-27T14:30:22Z"
  }
}
```

### Send Test Email
```http
POST /api/v1/email/send-test
```

**Request Body:**
```json
{
  "email": "test@example.com",
  "type": "welcome"
}
```

### Get Email Configuration
```http
GET /api/v1/email/config
```

**Response:**
```json
{
  "configuration": {
    "provider": "SES",
    "host": "email-smtp.us-east-1.amazonaws.com",
    "port": 587,
    "secure": true,
    "fromEmail": "alerts@boosterbeacon.com",
    "fromName": "BoosterBeacon",
    "authConfigured": true
  },
  "validation": {
    "isValid": true,
    "errors": [],
    "warnings": []
  }
}
```

### Test Email Configuration
```http
POST /api/v1/email/config/test
```

**Request Body:**
```json
{
  "email": "test@example.com"
}
```

## Machine Learning & Predictions

### Get Price Predictions
```http
GET /api/v1/ml/predictions/price/:productId
```

**Parameters:**
- `productId` (UUID, required): Product identifier

**Query Parameters:**
- `days` (integer, optional): Prediction horizon in days (default: 30, max: 365)
- `confidence` (number, optional): Confidence level (default: 0.95)

**Response:**
```json
{
  "success": true,
  "data": {
    "productId": "uuid",
    "predictions": [
      {
        "date": "2024-08-27",
        "predictedPrice": 29.99,
        "confidenceInterval": {
          "lower": 27.50,
          "upper": 32.48
        },
        "confidence": 0.95
      }
    ],
    "currentPrice": 24.99,
    "priceChange": {
      "amount": 5.00,
      "percentage": 20.0,
      "direction": "increase"
    },
    "modelAccuracy": 0.87,
    "lastUpdated": "2024-08-27T14:30:22Z"
  }
}
```

### Get Sell-out Risk Assessment
```http
GET /api/v1/ml/predictions/sellout/:productId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "productId": "uuid",
    "selloutRisk": {
      "score": 0.85,
      "level": "high",
      "timeToSellout": {
        "estimate": 72,
        "unit": "hours",
        "confidence": 0.78
      }
    },
    "stockVelocity": {
      "unitsPerHour": 15.5,
      "trend": "increasing"
    },
    "restockProbability": {
      "next7Days": 0.25,
      "next30Days": 0.65
    },
    "alertPriority": "urgent",
    "lastUpdated": "2024-08-27T14:30:22Z"
  }
}
```

### Get ROI Estimation
```http
GET /api/v1/ml/predictions/roi/:productId
```

**Query Parameters:**
- `timeHorizon` (integer, optional): Investment horizon in months (default: 12)
- `investmentAmount` (number, optional): Investment amount for analysis

**Response:**
```json
{
  "success": true,
  "data": {
    "productId": "uuid",
    "roiEstimate": {
      "expectedReturn": 0.35,
      "confidenceInterval": {
        "lower": 0.15,
        "upper": 0.55
      },
      "riskLevel": "medium",
      "investmentGrade": "B+"
    },
    "priceAppreciation": {
      "historical": {
        "1year": 0.28,
        "2year": 0.45,
        "5year": 1.25
      },
      "projected": {
        "6months": 0.18,
        "1year": 0.35,
        "2year": 0.62
      }
    },
    "marketFactors": {
      "rarity": 0.75,
      "demand": 0.82,
      "collectibility": 0.68
    },
    "lastUpdated": "2024-08-27T14:30:22Z"
  }
}
```

### Get Hype Meter
```http
GET /api/v1/ml/analytics/hype/:productId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "productId": "uuid",
    "hypeScore": {
      "overall": 0.78,
      "level": "high",
      "trend": "increasing"
    },
    "metrics": {
      "watchCount": 1250,
      "alertFrequency": 45.2,
      "communityEngagement": 0.65,
      "socialMentions": 892,
      "priceVolatility": 0.23
    },
    "viralPotential": {
      "score": 0.72,
      "factors": [
        "high_community_interest",
        "limited_availability",
        "price_momentum"
      ]
    },
    "lastUpdated": "2024-08-27T14:30:22Z"
  }
}
```

### Get Personalized Recommendations
```http
GET /api/v1/ml/recommendations/user
```

**Query Parameters:**
- `budget` (number, optional): Budget constraint for recommendations
- `riskTolerance` (string, optional): "conservative" | "moderate" | "aggressive"
- `category` (string, optional): Product category filter
- `limit` (integer, optional): Number of recommendations (default: 10)

**Response:**
```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "productId": "uuid",
        "score": 0.92,
        "reasoning": [
          "high_roi_potential",
          "portfolio_diversification",
          "price_momentum"
        ],
        "expectedRoi": 0.45,
        "riskLevel": "medium",
        "timeToAction": "urgent",
        "priceTarget": 29.99,
        "confidence": 0.87
      }
    ],
    "portfolioAnalysis": {
      "diversificationScore": 0.65,
      "riskBalance": "moderate",
      "gapAnalysis": [
        {
          "category": "Booster Boxes",
          "recommendation": "underweight",
          "suggestedAllocation": 0.25
        }
      ]
    },
    "lastUpdated": "2024-08-27T14:30:22Z"
  }
}
```

### Get Market Insights
```http
GET /api/v1/ml/insights/market
```

**Query Parameters:**
- `category` (string, optional): Product category filter
- `timeframe` (string, optional): "1d" | "7d" | "30d" | "90d" (default: "30d")

**Response:**
```json
{
  "success": true,
  "data": {
    "marketTrends": {
      "overallDirection": "bullish",
      "volatility": "moderate",
      "momentum": 0.68
    },
    "topMovers": {
      "gainers": [
        {
          "productId": "uuid",
          "priceChange": 0.25,
          "volume": 1250
        }
      ],
      "losers": [
        {
          "productId": "uuid",
          "priceChange": -0.15,
          "volume": 890
        }
      ]
    },
    "opportunities": [
      {
        "type": "arbitrage",
        "productId": "uuid",
        "potential": 0.18,
        "confidence": 0.82
      }
    ],
    "lastUpdated": "2024-08-27T14:30:22Z"
  }
}
```

### Get Portfolio Analysis
```http
GET /api/v1/ml/portfolio/analysis
```

**Response:**
```json
{
  "success": true,
  "data": {
    "portfolioValue": {
      "current": 2450.75,
      "change24h": 45.20,
      "changePercent": 1.88
    },
    "performance": {
      "totalReturn": 0.32,
      "annualizedReturn": 0.28,
      "sharpeRatio": 1.45,
      "maxDrawdown": 0.12
    },
    "allocation": [
      {
        "category": "Booster Boxes",
        "value": 1200.50,
        "percentage": 0.49,
        "recommendation": "maintain"
      }
    ],
    "riskMetrics": {
      "portfolioRisk": "moderate",
      "diversificationScore": 0.72,
      "concentrationRisk": 0.35
    },
    "recommendations": [
      {
        "action": "rebalance",
        "category": "Single Packs",
        "suggestedChange": -0.10,
        "reasoning": "overweight_position"
      }
    ],
    "lastUpdated": "2024-08-27T14:30:22Z"
  }
}
```

## Changelog

### v1.5.0 (2024-08-27)
- **Machine Learning Prediction System** - Complete ML analytics platform
- Price forecasting with confidence intervals and trend analysis
- Sell-out risk assessment with stock velocity and restock probability
- ROI estimation with investment grade classification and risk assessment
- Hype meter calculation with community sentiment and viral potential
- Personalized recommendations with portfolio optimization
- Market insights with trend analysis and opportunity identification
- **ML API Endpoints** - Comprehensive prediction and analytics APIs
- Advanced algorithms with time series forecasting and classification
- Real-time inference with sub-100ms response times
- Model performance monitoring with accuracy tracking

### v1.4.0 (2024-08-27)
- **Automated Checkout System** - Complete checkout automation
- Secure credential management with enterprise-grade encryption
- Intelligent form auto-fill with retailer-specific optimization
- End-to-end checkout process with safety checks and confirmation
- Purchase tracking with order confirmation detection
- Multi-retailer support with specialized strategies

### v1.3.0 (2024-08-27)
- **Frontend Application Foundation** - Complete React frontend implementation
- React 18+ with TypeScript and Vite build system
- PWA support with service worker and offline capabilities
- Pokémon-themed UI with Tailwind CSS components
- Advanced routing with protected routes and lazy loading
- Authentication context with JWT token management
- Error boundaries and comprehensive error handling
- **User Authentication UI** - Complete authentication interface
- Registration and login forms with advanced validation
- Password security features and strength validation
- Terms acceptance and newsletter subscription flows
- **Email System Enhancements** - Advanced email management
- Multiple SMTP configurations (SES, local SMTP, Ethereal)
- Email preferences and unsubscribe management
- Delivery analytics and bounce/complaint handling
- Template system with responsive HTML designs

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