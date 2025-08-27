# Watch Management System

The Watch Management System is the core feature of BoosterBeacon that allows users to monitor Pokémon TCG product availability across multiple retailers. This document covers the complete watch management functionality.

## Overview

The system consists of two main components:
- **Individual Watches** - User-specific monitoring of individual products
- **Watch Packs** - Curated collections of related products for one-click subscriptions

## Individual Watches

### Features
- **Product Monitoring** - Track specific Pokémon TCG products across retailers
- **Retailer Filtering** - Choose which retailers to monitor (Best Buy, Walmart, etc.)
- **Price Thresholds** - Set maximum price alerts
- **Location-Based** - Monitor in-store availability by ZIP code and radius
- **Alert Preferences** - Customize notification channels and timing
- **Health Monitoring** - Track watch performance and identify issues

### API Endpoints

#### Get User Watches
```http
GET /api/v1/watches?page=1&limit=20&is_active=true&product_id=uuid&retailer_id=uuid
```
Returns paginated list of user's watches with optional filtering.

#### Create Watch
```http
POST /api/v1/watches
Content-Type: application/json

{
  "product_id": "uuid",
  "retailer_ids": ["uuid1", "uuid2"],
  "max_price": 29.99,
  "availability_type": "both", // "online", "in_store", "both"
  "zip_code": "12345",
  "radius_miles": 25,
  "alert_preferences": {
    "email": true,
    "push": true,
    "sms": false
  }
}
```

#### Update Watch
```http
PUT /api/v1/watches/:watchId
Content-Type: application/json

{
  "retailer_ids": ["uuid1"],
  "max_price": 24.99,
  "is_active": true
}
```

#### Delete Watch
```http
DELETE /api/v1/watches/:watchId
```

#### Toggle Watch Status
```http
PATCH /api/v1/watches/:watchId/toggle
```

### Bulk Operations

#### CSV Import
```http
POST /api/v1/watches/import
Content-Type: multipart/form-data

file: watches.csv
```

**CSV Format:**
```csv
product_id,retailer_ids,max_price,availability_type,zip_code,radius_miles,is_active
uuid1,"uuid2,uuid3",29.99,both,12345,25,true
uuid4,"uuid5",19.99,online,,,true
```

#### CSV Export
```http
GET /api/v1/watches/export?is_active=true
```
Returns CSV file with all user watches.

### Watch Statistics
```http
GET /api/v1/watches/stats
```

Returns:
```json
{
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
```

## Watch Packs

Watch Packs are curated collections of related products that users can subscribe to with one click. They automatically create individual watches for all products in the pack.

### Features
- **Curated Collections** - Pre-configured product bundles
- **Auto-Updates** - Packs can automatically include new products
- **One-Click Subscribe** - Instant monitoring of entire product sets
- **Customization** - Users can customize alert preferences per pack
- **Popularity Tracking** - Most subscribed packs are highlighted

### API Endpoints

#### Get Watch Packs
```http
GET /api/v1/watches/packs?page=1&limit=20&search=pokemon
```

#### Get Popular Watch Packs
```http
GET /api/v1/watches/packs/popular?limit=10
```

#### Get Watch Pack Details
```http
GET /api/v1/watches/packs/:packId
```
Supports both UUID and slug identifiers.

#### Subscribe to Watch Pack
```http
POST /api/v1/watches/packs/:packId/subscribe
Content-Type: application/json

{
  "customizations": {
    "alert_preferences": {
      "email": true,
      "push": true
    }
  }
}
```

#### Unsubscribe from Watch Pack
```http
DELETE /api/v1/watches/packs/:packId/subscribe
Content-Type: application/json

{
  "remove_watches": false // Keep individual watches
}
```

#### Get User Subscriptions
```http
GET /api/v1/watches/packs/subscriptions?page=1&limit=20&is_active=true
```

#### Get Detailed Subscriptions
```http
GET /api/v1/watches/packs/subscriptions/detailed
```
Returns subscriptions with full watch pack details.

#### Update Subscription Customizations
```http
PUT /api/v1/watches/packs/:packId/customizations
Content-Type: application/json

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

### Admin Operations (Future)

#### Create Watch Pack
```http
POST /api/v1/watches/packs
Content-Type: application/json

{
  "name": "Latest Pokémon Sets",
  "slug": "latest-pokemon-sets",
  "description": "Monitor the newest Pokémon TCG releases",
  "product_ids": ["uuid1", "uuid2", "uuid3"],
  "auto_update": true,
  "update_criteria": "category:latest AND release_date:>30days"
}
```

#### Update Watch Pack
```http
PUT /api/v1/watches/packs/:packId
```

#### Delete Watch Pack
```http
DELETE /api/v1/watches/packs/:packId
```

## Health Monitoring

The system includes comprehensive health monitoring to ensure watches are functioning properly.

### Watch Health
```http
GET /api/v1/watches/:watchId/health
```

Returns:
```json
{
  "watchId": "uuid",
  "productId": "uuid",
  "userId": "uuid",
  "isHealthy": true,
  "lastChecked": "2024-08-26T14:30:22Z",
  "lastAlerted": "2024-08-25T09:15:00Z",
  "alertCount": 5,
  "issues": []
}
```

### User Watches Health
```http
GET /api/v1/watches/health/all
```
Returns health status for all user watches.

### Performance Metrics
```http
GET /api/v1/watches/metrics/performance
```

Returns:
```json
{
  "avgAlertsPerWatch": 3.2,
  "avgTimeBetweenAlerts": 48,
  "mostActiveWatches": [...],
  "leastActiveWatches": [...]
}
```

### System Health (Admin)
```http
GET /api/v1/watches/admin/health/system
```

Returns system-wide watch health overview.

## Data Models

### Watch Model
```typescript
interface IWatch {
  id: string;
  user_id: string;
  product_id: string;
  retailer_ids: string[];
  max_price?: number;
  availability_type: 'online' | 'in_store' | 'both';
  zip_code?: string;
  radius_miles?: number;
  alert_preferences: Record<string, any>;
  is_active: boolean;
  alert_count: number;
  last_alerted?: Date;
  created_at: Date;
  updated_at: Date;
}
```

### Watch Pack Model
```typescript
interface IWatchPack {
  id: string;
  name: string;
  slug: string;
  description?: string;
  product_ids: string[];
  auto_update: boolean;
  update_criteria?: string;
  subscriber_count: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}
```

### User Watch Pack Model
```typescript
interface IUserWatchPack {
  id: string;
  user_id: string;
  watch_pack_id: string;
  customizations: Record<string, any>;
  is_active: boolean;
  subscribed_at: Date;
  updated_at: Date;
}
```

## Validation Rules

### Watch Validation
- **product_id**: Required, valid UUID
- **max_price**: Optional, positive number ≤ $999,999.99
- **availability_type**: Must be 'online', 'in_store', or 'both'
- **zip_code**: Optional, US format (12345 or 12345-6789)
- **radius_miles**: Optional, 1-500 miles
- **retailer_ids**: Array of valid UUIDs

### Watch Pack Validation
- **name**: Required, 1-100 characters
- **slug**: Required, lowercase alphanumeric with hyphens
- **product_ids**: Required array with at least one valid UUID
- **description**: Optional, ≤1000 characters

## Error Handling

The API returns consistent error responses:

```json
{
  "success": false,
  "message": "Validation failed",
  "error": "Product ID is required",
  "timestamp": "2024-08-26T14:30:22Z"
}
```

Common error codes:
- **400** - Validation errors, invalid input
- **401** - Authentication required
- **403** - Access denied (not owner)
- **404** - Resource not found
- **409** - Conflict (duplicate watch)
- **500** - Server error

## Performance Considerations

### Pagination
All list endpoints support pagination:
- Default: 20 items per page
- Maximum: 100 items per page
- Use `page` and `limit` query parameters

### Caching
- Watch pack data is cached for performance
- Health checks are rate-limited to prevent overload
- Statistics are computed efficiently with database aggregations

### Rate Limiting
- API endpoints are rate-limited per user
- Bulk operations have special limits
- Health monitoring has separate rate limits

## Security

### Authentication
All endpoints require valid JWT authentication except:
- Public watch pack listings
- Watch pack details (read-only)

### Authorization
- Users can only access their own watches
- Watch pack admin operations require admin role
- System health endpoints require admin access

### Input Sanitization
- All inputs are validated and sanitized
- SQL injection prevention with parameterized queries
- XSS prevention with proper encoding

## Integration Examples

### JavaScript/TypeScript
```typescript
// Create a watch
const response = await fetch('/api/v1/watches', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    product_id: 'uuid',
    retailer_ids: ['best-buy-uuid'],
    max_price: 29.99,
    availability_type: 'both'
  })
});

const watch = await response.json();
```

### cURL
```bash
# Get user watches
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.boosterbeacon.com/api/v1/watches?page=1&limit=10"

# Subscribe to watch pack
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"customizations":{"alert_preferences":{"email":true}}}' \
  "https://api.boosterbeacon.com/api/v1/watches/packs/latest-sets/subscribe"
```

## Future Enhancements

### Planned Features
- **Smart Recommendations** - AI-powered watch suggestions
- **Advanced Filtering** - Complex query capabilities
- **Batch Operations** - Multi-watch management
- **Watch Templates** - Reusable watch configurations
- **Social Features** - Share watch packs with friends
- **Analytics Dashboard** - Detailed performance insights

### API Versioning
The API uses versioning (`/api/v1/`) to ensure backward compatibility as new features are added.