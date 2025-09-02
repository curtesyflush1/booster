# BoosterBeacon API Reference

## 🚀 Overview

BoosterBeacon provides a comprehensive REST API with real-time WebSocket capabilities, designed for production-scale operations with subscription-based access control and advanced ML-powered features.

## 🔐 Authentication

### JWT Authentication
All API endpoints require JWT authentication except where noted.

```http
Authorization: Bearer <jwt_token>
```

### Subscription-Based Access
Many endpoints require specific subscription tiers:
- **Free**: Basic alerting and monitoring
- **Pro**: Enhanced features, ML predictions, extended history
- **Premium**: Full access to all features, priority processing

## 📊 Core Endpoints

### Authentication

#### POST /api/auth/login
User login with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "subscription": {
        "plan": "premium",
        "status": "active"
      }
    },
    "token": "jwt_token",
    "refreshToken": "refresh_token"
  }
}
```

#### POST /api/auth/register
User registration with email verification.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "confirmPassword": "password123"
}
```

### Product Management

#### GET /api/products
Get products with advanced filtering and pagination.

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)
- `category`: Product category filter
- `retailer`: Retailer filter
- `availability`: Availability status filter
- `priceMin`: Minimum price filter
- `priceMax`: Maximum price filter
- `sortBy`: Sort field (name, price, availability, popularity)
- `sortOrder`: Sort direction (asc, desc)

**Response:**
```json
{
  "success": true,
  "data": {
    "products": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

#### GET /api/products/:id
Get detailed product information.

**Response:**
```json
{
  "success": true,
  "data": {
    "product": {
      "id": "uuid",
      "name": "Pokémon TCG Elite Trainer Box",
      "upc": "123456789012",
      "category": "elite_trainer_box",
      "retailers": [...],
      "priceHistory": [...],
      "availability": {
        "status": "in_stock",
        "lastChecked": "2024-09-15T10:30:00Z"
      }
    }
  }
}
```

### Alert Management

#### POST /api/alerts
Create a new product alert.

**Request:**
```json
{
  "productId": "uuid",
  "type": "restock",
  "conditions": {
    "priceThreshold": 49.99,
    "retailers": ["bestbuy", "walmart"]
  },
  "channels": ["email", "discord"]
}
```

#### GET /api/alerts
Get user's alerts with pagination.

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)
- `status`: Alert status filter (active, triggered, paused)
- `type`: Alert type filter

#### PUT /api/alerts/:id
Update alert configuration.

#### DELETE /api/alerts/:id
Delete an alert.

### ML Predictions (Premium/Pro Only)

#### GET /api/ml/predictions/price/:productId
Get price prediction for a product.

**Response:**
```json
{
  "success": true,
  "data": {
    "prediction": {
      "currentPrice": 49.99,
      "predictedPrice": 54.99,
      "confidence": 0.85,
      "trend": "increasing",
      "timeframe": "7_days"
    }
  }
}
```

#### GET /api/ml/predictions/risk/:productId
Get investment risk assessment.

#### GET /api/ml/predictions/roi/:productId
Get return on investment prediction.

#### GET /api/ml/insights/market
Get market insights and trending products.

### Real-Time Updates

#### WebSocket Connection
Connect to real-time updates via WebSocket.

**Connection URL:**
```
wss://api.boosterbeacon.com/ws
```

**Authentication:**
```json
{
  "type": "auth",
  "token": "jwt_token"
}
```

**Event Types:**
- `product_update`: Product availability changes
- `alert_triggered`: Alert activation
- `price_change`: Price updates
- `portfolio_update`: Portfolio changes

## 🔧 Admin Endpoints

### ML Model Management

GET /api/admin/ml/models/price/metadata

Returns metadata for the active price model used by the ML runner.

Response:
```
{
  "success": true,
  "data": {
    "trainedAt": "2025-09-02T11:40:00.000Z",
    "features": ["bias","recent","prev","trend","msrp","popNorm"],
    "coef": [1.23, 0.45, ...],
    "file": {
      "path": "/app/data/ml/price_model.json",
      "sizeBytes": 512,
      "modifiedAt": "2025-09-02T11:40:01.000Z"
    }
  }
}
```

POST /api/admin/ml/models/price/retrain

Triggers ETL + training synchronously and returns the updated model record with metrics.

Response:
```
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "price",
    "version": "v3",
    "status": "active",
    "metrics": { "rows": 12345, "r2": 0.82 },
    "model_path": "/app/data/ml/price_model.json",
    "training_started_at": "...",
    "training_completed_at": "...",
    "deployed_at": "..."
  },
  "message": "Model retraining completed"
}
```

### Catalog Management

#### POST /api/admin/catalog/ingestion/dry-run
Test catalog ingestion without database changes.

**Request:**
```json
{
  "retailers": ["bestbuy", "walmart"],
  "categories": ["booster_box", "elite_trainer_box"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "preview": {
      "productsToCreate": 25,
      "productsToUpdate": 10,
      "changes": [...]
    }
  }
}
```

#### POST /api/admin/catalog/ingestion/run
Execute catalog ingestion.

**Request:**
```json
{
  "retailers": ["bestbuy", "walmart"],
  "categories": ["booster_box", "elite_trainer_box"],
  "force": false
}
```

### User Management

#### GET /api/admin/users
Get all users with pagination and filtering.

**Query Parameters:**
- `page`: Page number
- `limit`: Items per page
- `subscription`: Subscription plan filter
- `status`: User status filter
- `search`: Email search

#### PUT /api/admin/users/:id/subscription
Update user subscription.

**Request:**
```json
{
  "plan": "premium",
  "status": "active",
  "stripeCustomerId": "cus_xxx"
}
```

### System Monitoring

#### GET /api/admin/health
Get system health status.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "services": {
      "database": "healthy",
      "redis": "healthy",
      "ml": "healthy"
    },
    "metrics": {
      "uptime": "7d 12h 30m",
      "memory": "45%",
      "cpu": "23%"
    }
  }
}
```

#### GET /api/admin/analytics
Get system analytics and performance metrics.

## 📈 Subscription Tiers

### Free Plan
- Basic product monitoring
- Email alerts (limited)
- Standard availability updates
- Basic portfolio tracking

### Pro Plan
- Enhanced alerting (all channels)
- ML price predictions
- Extended price history (30 days)
- Advanced filtering
- Priority processing (5x)

### Premium Plan
- Full ML suite (price, risk, ROI predictions)
- Unlimited alerts
- Real-time WebSocket updates
- Maximum priority processing (10x)
- Advanced analytics
- Market insights

## 🔄 Rate Limiting

### Standard Limits
- **Free**: 100 requests/hour
- **Pro**: 500 requests/hour
- **Premium**: 1000 requests/hour

### ML Endpoints
- **Pro**: 50 predictions/hour
- **Premium**: 200 predictions/hour

### Admin Endpoints
- **Admin**: 1000 requests/hour

## 🚨 Error Responses

### Standard Error Format
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": {
      "field": "email",
      "value": "invalid-email"
    }
  }
}
```

### Common Error Codes
- `AUTHENTICATION_ERROR`: Invalid or expired token
- `AUTHORIZATION_ERROR`: Insufficient permissions
- `VALIDATION_ERROR`: Invalid request data
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `SUBSCRIPTION_REQUIRED`: Higher plan required
- `RESOURCE_NOT_FOUND`: Requested resource not found
- `INTERNAL_ERROR`: Server error

## 📚 WebSocket Events

### Connection Events
```json
{
  "type": "connected",
  "timestamp": "2024-09-15T10:30:00Z"
}
```

### Product Updates
```json
{
  "type": "product_update",
  "data": {
    "productId": "uuid",
    "availability": {
      "status": "in_stock",
      "retailer": "bestbuy",
      "price": 49.99
    }
  }
}
```

### Alert Triggers
```json
{
  "type": "alert_triggered",
  "data": {
    "alertId": "uuid",
    "productId": "uuid",
    "triggeredAt": "2024-09-15T10:30:00Z",
    "conditions": {...}
  }
}
```

## 🔧 Development

### Local Development
```bash
# Start development server
npm run dev

# API will be available at http://localhost:3001
```

### Testing
```bash
# Run API tests
npm run test:backend

# Run with coverage
npm run test:coverage:backend
```

### Environment Variables
```bash
# Required
DATABASE_URL=postgresql://user:pass@localhost:5432/boosterbeacon
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_jwt_secret

# Optional
STRIPE_SECRET_KEY=sk_test_...
BESTBUY_API_KEY=your_bestbuy_key
WALMART_API_KEY=your_walmart_key
```

---

**Last Updated**: September 2024
**API Version**: 2.0
**Status**: Production Ready
